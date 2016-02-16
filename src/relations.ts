/// <reference path="../_definitions.d.ts" />

import ko = require("knockout");
import _ = require("underscore");
import utils = require("koutils/utils");

import dataset = require("./dataset");
import dataview = require("./dataview");
import mapping = require("./mapping");
import _query = require("./query");

//#region Common Methods

export function create<T, TKey, TForeign, TForeignKey>(localSet: dataset.DataSet<T, TKey>, foreignSet: dataset.DataSet<TForeign, TForeignKey>, relation: mapping.Relation, entity: any): any {
    switch (relation.type) {
        case 0: //mapping.relationTypes.many:
            return collection(localSet, foreignSet, relation, entity);
        case 1: //mapping.relationTypes.one:
            return foreign(localSet, foreignSet, relation, entity);
        case 2: //mapping.relationTypes.remote:
            return remote(localSet, foreignSet, relation, entity);
    }
}

//#endregion

//#region Collection View 

export interface RelationCollectionView<T, TKey, TForeign, TForeignKey> extends dataview.DataView<TForeign, TForeignKey> {
    propertyName: string;
    parent: any;

    localSet: dataset.DataSet<T, TKey>;
    foreignSet: dataset.DataSet<TForeign, TForeignKey>;
    localId: string;
    foreignId: string;

    ensureRemote: boolean;
}
export interface CollectionView<T, TForeign> extends RelationCollectionView<T, any, TForeign, any> { }
export interface Collection<TForeign> extends CollectionView<any, TForeign> { }

/** Create an observable relation to many entities */
export function collection<T, TKey, TForeign, TForeignKey>(localSet: dataset.DataSet<T, TKey>, foreignSet: dataset.DataSet<TForeign, TForeignKey>, relation: mapping.Relation, parent: any): RelationCollectionView<T, TKey, TForeign, TForeignKey> {
    var self = {
        propertyName: relation.propertyName,
        parent: parent,

        localSet: localSet,
        foreignSet: foreignSet,
        localId: localSet.key,
        foreignId: relation.foreignKey,

        ensureRemote: relation.ensureRemote
    };

    var result: any = foreignSet.createView(relation.toQuery(parent, localSet, foreignSet));
    _.extend(result, self, collectionViewFunctions);

    return result;
}

var collectionViewFunctions = {
    /** Refresh foreign entities from the server */
    refresh: function (mode?: string): Promise<any[]> {
        var self = <Collection<any>>this;
        if (self.ensureRemote) {
            return self.localSet.refreshRelation(self.parent, self.propertyName, mode, self.query);
        }
        else {
            return self.set.refresh(mode, self.query).then(data => {
                if (self.query.pageSize() > 0)
                    self.lastResult(data);

                return data;
            });
        }
    },
    /** Add entity to foreign entities and set it good value in foreign key, if buffer is false, entity will be instantly post on the server */
    add: function (entity: any): Promise<any> {
        entity[this.foreignId](ko.unwrap(this.parent[this.localId]));
        return this.set.add(entity);
    }
};

//#endregion

//#region Foreign View

export interface RelationForeignView<T, TKey, TForeign, TForeignKey> extends RelationForeignViewFunctions<T, TKey, TForeign, TForeignKey> {
    (): T;

    propertyName: string;
    parent: any;

    localSet: dataset.DataSet<T, TKey>;
    foreignSet: dataset.DataSet<TForeign, TForeignKey>;
    localId: string;
    foreignId: string;

    view: dataview.DataView<TForeign, TForeignKey>;
    ensureRemote: boolean;
}
export interface ForeignView<T, TForeign> extends RelationForeignView<T, any, TForeign, any> { }
export interface Foreign<TForeign> extends ForeignView<any, TForeign> { }

export interface RelationForeignViewFunctions<T, TKey, TForeign, TForeignKey> {
    /** Refresh the foreign entity from the server */
    refresh(mode?: string): Promise<TForeign[]>;
    /** Synchronize foreign with local store */
    sync(): Promise<void>;
    /** Update entity into dataSet, if buffer is false, changes will be instantly committed to the server */
    update(): void;
    /** Change actual related entity with new one and delete if specified */
    change(newEntity: TForeign, deleteOld?: boolean): Promise<any>;
    /** Save changes of foreign entity to the server */
    save(): Promise<TForeign>;
}

/** Create an observable relation to one item */
export function foreign<T, TKey, TForeign, TForeignKey>(localSet: dataset.DataSet<T, TKey>, foreignSet: dataset.DataSet<TForeign, TForeignKey>, relation: mapping.Relation, parent: any): RelationForeignView<T, TKey, TForeign, TForeignKey> {
    var self = {
        propertyName: relation.propertyName,
        parent: parent,

        localSet: localSet,
        foreignSet: foreignSet,
        localId: relation.foreignKey,
        foreignId: foreignSet.key,

        view: foreignSet.createView(relation.toQuery(parent, localSet, foreignSet)),
        ensureRemote: relation.ensureRemote
    };

    var result: any = self.view._first();
    _.extend(result, self, foreignViewFunctions);

    return result;
}

var foreignViewFunctions: RelationForeignViewFunctions<any, any, any, any> = {
    /** Refresh the foreign entity from the server */
    refresh: function (mode?: string): Promise<any> {
        var self = <Foreign<any>>this;
        if (self.ensureRemote) {
            return self.foreignSet.refreshRelation(self.parent, self.propertyName, mode, self.view.query);
        }
        else {
            return self.view.refresh(mode);
        }
    },
    /** Synchronize foreign with local store */
    sync: function (): Promise<void> {
        return this.view.sync();
    },
    /** Update entity into dataSet, if buffer is false, changes will be instantly committed to the server */
    update: function (): void {
        var entity = this();
        if (entity)
            this.view.update(entity);
    },
    /** Change actual related entity with new one and delete if specified */
    change: function (newEntity: any, deleteOld: boolean = false): Promise<any> {
        var self = this,
            entity = this(),
            op = this.foreignSet.isAttached(newEntity) ? newEntity : this.foreignSet.add(newEntity);

        return Promise.resolve(op)
            .then(function () {
                self.parent[self.localId](ko.unwrap(newEntity[self.foreignId]));

                if (deleteOld && entity)
                    return self.foreignSet.remove(entity);
            })
            .then(() => newEntity);
    },
    /** Save changes of foreign entity to the server */
    save: function (): Promise<any> {
        var entity = this();
        return Promise.resolve(entity && this.view.saveEntity(entity));
    }
};

//#endregion

//#region RemoteView

export interface RelationRemoteView<T, TKey, TForeign, TForeignKey> extends KnockoutObservableArray<TForeign>, RelationRemoteViewFunctions<T, TKey, TForeign, TForeignKey> {
    propertyName: string;
    parent: any;

    localSet: dataset.DataSet<T, TKey>;
    foreignSet: dataset.DataSet<TForeign, TForeignKey>;

    query: _query.ODataQuery;
}
export interface RemoteView<T, TForeign> extends RelationRemoteView<T, any, TForeign, any> { }
export interface Remote<TForeign> extends RemoteView<any, TForeign> { }

export interface RelationRemoteViewFunctions<T, TKey, TForeign, TForeignKey> {
    /** Refresh foreign entities from the server */
    refresh(): Promise<TForeign[]>;
    /** Add entity to view, if buffer is false, entity will be instantly post on the server */
    add(entity: TForeign): Promise<TForeign>;
    /** Update entity on view, if buffer is false, entity will be instantly put on the server */
    update(entity: TForeign): Promise<any>;
    /** Remove entity from dataset, if buffer is false, entity will be instantly deleted on the server */
    //remove(entity: TForeign): Promise<any>;
}

/** Create an observable relation to many entities */
export function remote<T, TKey, TForeign, TForeignKey>(localSet: dataset.DataSet<T, TKey>, foreignSet: dataset.DataSet<TForeign, TForeignKey>, relation: mapping.Relation, parent: any): RelationRemoteView<T, TKey, TForeign, TForeignKey> {
    var self = {
        propertyName: relation.propertyName,
        parent: parent,

        localSet: localSet,
        foreignSet: foreignSet,

        query: new _query.ODataQuery()
    };

    var result: any = ko.observableArray();
    _.extend(result, self, remoteViewFunctions);

    return result;
}

export var remoteViewFunctions: RelationRemoteViewFunctions<any, any, any, any> = {
    /** Refresh foreign entities from the server */
    refresh: function (mode?: string): Promise<any[]> {
        var self = <Remote<any>>this;
        if (!mode) mode = self.localSet.refreshMode;

        if (mode === "local") {
            return Promise.resolve([]);
        }

        return self.localSet.refreshRelation<any[]>(self.parent, self.propertyName, mode, self.query, true).then((result) => {
            self(result);
            return result;
        });
    },
    /** Add entity to foreign entities and set it good value in foreign key, if buffer is false, entity will be instantly post on the server */
    add: function (entity: any): Promise<any> {
        return Promise.resolve(entity); // TODO !
    },
    /** Update entity on relation, if buffer is false, entity will be instantly put on the server */
    update: function (entity: any): Promise<any> {
        return Promise.resolve(entity); // TODO !
    },
    /** Remove entity from relation, if buffer is false, entity will be instantly delete on the server */
    // remove: function (entity: any): Promise<any> {
    //     return Promise.resolve(entity); // TODO !
    // }
};

//#endregion
