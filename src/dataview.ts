/// <reference path="../_definitions.d.ts" />
/// <amd-dependency path="koutils/extenders" />

import ko = require("knockout");
import _ = require("underscore");
import Promise = require("promise");

import mapping = require("./mapping");
import dataset = require("./dataset");
import query = require("./query");
import ko_ = require("kounderscore");
import utils = require("koutils/utils");

//#region Interfaces 

export interface DataView<T, TKey> extends DataViewFunctions<T, TKey>, KnockoutUnderscoreArrayFunctions<T>, KnockoutComputed<T> {
    set: dataset.DataSet<T, TKey>;
    query: query.ODataQuery;
    lastResult: KnockoutObservableArray<T>;
}

export interface DataViewFunctions<T, TKey> {
    /** Refresh the view from the server */
    refresh(mode?: string): Promise<any>;
    /** Load a remote entity by key */
    load(key: TKey, mode?: string): Promise<T>;

    /** Synchronize data store with remote source content filtered with view's query */
    sync(): Promise<void>;

    /** Add entity to view, if buffer is false, entity will be instantly post on the server */
    add(entity: T): Promise<any>;
    /** Update entity on view, if buffer is false, entity will be instantly put on the server */
    update(entity: T): void;
    /** Remove entity from dataset, if buffer is false, entity will be instantly deleted on the server */
    remove(entity: T): void;

    findByKey(key: TKey): any;

    /** Save changes of an entity to the server */
    saveEntity(entity: T): Promise<T>;
    /** Reset entity to its original state */
    resetEntity(entity: T): void;

    /** Get a report of changes in the dataview */
    getChanges(): any;
    /** Commits all Pending Operations (PUT, DELETE, POST) */
    saveChanges(): Promise<any>;
}

//#endregion

//#region Model

/** Creates a data view for the given data set */
export function create<T, TKey>(dataSet: dataset.DataSet<T, TKey>, _query?: query.ODataQuery): DataView<T, TKey> {
    var self = {
        query: _query || new query.ODataQuery(),
        set: dataSet,
        lastResult: ko.observableArray()
    };

    var result = <any>ko.pureComputed(function () {
        if (self.query.pageSize() > 0 && !self.set.isSynchronized() && self.lastResult.size() > 0) {
            return self.lastResult();
        }

        return self.query.apply(self.set.toArray(), true);
    }).extend({ notify: utils.arrayEquals });

    _.extend(result, self, dataViewFunctions);

    return result;
}

var dataViewFunctions: DataViewFunctions<any, any> = {
    /** Refresh the view from the server */
    refresh: function (mode?: string): Promise<any> {
        var self = <DataView<any, any>>this;
        return self.set.refresh(mode, self.query).then(function (data) {
            if (self.query.pageSize() > 0)
                self.lastResult(data);

            return data;
        });
    },
    /** Load a remote entity by key */
    load: function (key: any, mode?: string): Promise<any> {
        return this.set.load(key, mode, this.query);
    },

    /** Synchronize data store with remote source content filtered with view's query */
    sync: function(): Promise<void> {
        return this.set.sync(this.query);
    },

    /** Add entity to view, if buffer is false, entity will be instantly post on the server */
    add: function (entity: any): Promise<any> {
        return this.set.add(entity);
    },
    /** Update entity on view, if buffer is false, entity will be instantly put on the server */
    update: function (entity: any): Promise<any> {
        return this.set.update(entity);
    },
    /** Remove entity from dataset, if buffer is false, entity will be instantly deleted on the server */
    remove: function (entity: any): Promise<any> {
        return this.set.remove(entity);
    },

    findByKey: function (key: any): any {
        return this.set.findByKey(key);
    },

    /** Save changes of an entity to the server */
    saveEntity: function (entity: any): Promise<any> {
        return this.set.saveEntity(entity);
    },
    /** Reset entity to its original state */
    resetEntity: function (entity: any): Promise<any> {
        return this.set.resetEntity(entity);
    },

    /** Get a report of changes in the dataview */
    getChanges: function (): any {
        return this.groupBy(e => e.EntityState());
    },
    /** Commits all Pending Operations (PUT, DELETE, POST) */
    saveChanges: function (): Promise<any> {
        /// <summary>Commits all Pending Operations (PUT, DELETE, POST)</summary>
        /// <returnss type="$.Deffered">return a deffered object for async operations</returnss>
        var changes = this.getChanges(),
            set = (<DataView<any, any>>this).set,
            states = mapping.entityStates,
            promises = _.union(
                _.map(changes[states.added], e => set._remoteCreate(e)),
                _.map(changes[states.modified], e => set._remoteUpdate(e)),
                _.map(changes[states.removed], e => set._remoteRemove(e))
            );

        return Promise.all(promises);
    }
};

ko_.addTo(dataViewFunctions);

//#endregion
