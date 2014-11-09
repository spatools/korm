/// <reference path="../_definitions.d.ts" />
define(["require", "exports", "knockout", "underscore", "./query"], function (require, exports, ko, _, _query) {
    //#region Common Methods
    function create(localSet, foreignSet, relation, entity) {
        switch (relation.type) {
            case 0:
                return collection(localSet, foreignSet, relation, entity);
            case 1:
                return foreign(localSet, foreignSet, relation, entity);
            case 2:
                return remote(localSet, foreignSet, relation, entity);
        }
    }
    exports.create = create;
    /** Create an observable relation to many entities */
    function collection(localSet, foreignSet, relation, parent) {
        var self = {
            propertyName: relation.propertyName,
            parent: parent,
            localSet: localSet,
            foreignSet: foreignSet,
            localId: localSet.key,
            foreignId: relation.foreignKey,
            ensureRemote: relation.ensureRemote
        };
        var result = foreignSet.createView(relation.toQuery(parent, localSet, foreignSet));
        _.extend(result, self, collectionViewFunctions);
        return result;
    }
    exports.collection = collection;
    var collectionViewFunctions = {
        /** Refresh foreign entities from the server */
        refresh: function (mode) {
            var self = this;
            if (self.ensureRemote) {
                return self.localSet.refreshRelation(self.parent, self.propertyName, mode, self.query);
            }
            else {
                return self.set.refresh(mode, self.query).then(function (data) {
                    if (self.query.pageSize() > 0)
                        self.lastResult(data);
                    return data;
                });
            }
        },
        /** Add entity to foreign entities and set it good value in foreign key, if buffer is false, entity will be instantly post on the server */
        add: function (entity) {
            entity[this.foreignId](ko.unwrap(this.parent[this.localId]));
            return this.set.add(entity);
        }
    };
    /** Create an observable relation to one item */
    function foreign(localSet, foreignSet, relation, parent) {
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
        var result = self.view._first();
        _.extend(result, self, foreignViewFunctions);
        return result;
    }
    exports.foreign = foreign;
    var foreignViewFunctions = {
        /** Refresh the foreign entity from the server */
        refresh: function (mode) {
            var self = this;
            if (self.ensureRemote) {
                return self.foreignSet.refreshRelation(self.parent, self.propertyName, mode, self.view.query);
            }
            else {
                return self.view.refresh(mode);
            }
        },
        /** Synchronize foreign with local store */
        sync: function () {
            return this.view.sync();
        },
        /** Update entity into dataSet, if buffer is false, changes will be instantly committed to the server */
        update: function () {
            var entity = this();
            if (entity)
                this.view.update(entity);
        },
        /** Change actual related entity with new one and delete if specified */
        change: function (newEntity, deleteOld) {
            if (deleteOld === void 0) { deleteOld = false; }
            var self = this, entity = this(), op = this.foreignSet.isAttached(newEntity) ? newEntity : this.foreignSet.add(newEntity);
            return Promise.cast(op).then(function () {
                self.parent[self.localId](ko.unwrap(newEntity[self.foreignId]));
                if (deleteOld && entity)
                    return self.foreignSet.remove(entity);
            }).then(function () { return newEntity; });
        },
        /** Save changes of foreign entity to the server */
        save: function () {
            var entity = this();
            return Promise.cast(entity && this.view.saveEntity(entity));
        }
    };
    /** Create an observable relation to many entities */
    function remote(localSet, foreignSet, relation, parent) {
        var self = {
            propertyName: relation.propertyName,
            parent: parent,
            localSet: localSet,
            foreignSet: foreignSet,
            query: new _query.ODataQuery()
        };
        var result = ko.observableArray();
        _.extend(result, self, exports.remoteViewFunctions);
        return result;
    }
    exports.remote = remote;
    exports.remoteViewFunctions = {
        /** Refresh foreign entities from the server */
        refresh: function (mode) {
            var self = this;
            if (!mode)
                mode = self.localSet.refreshMode;
            if (mode === "local") {
                return Promise.resolve([]);
            }
            return self.localSet.refreshRelation(self.parent, self.propertyName, mode, self.query, true).then(function (result) {
                self(result);
                return result;
            });
        },
        /** Add entity to foreign entities and set it good value in foreign key, if buffer is false, entity will be instantly post on the server */
        add: function (entity) {
            return Promise.resolve(entity); // TODO !
        },
        /** Update entity on relation, if buffer is false, entity will be instantly put on the server */
        update: function (entity) {
            return Promise.resolve(entity); // TODO !
        },
        /** Remove entity from relation, if buffer is false, entity will be instantly delete on the server */
        remove: function (entity) {
            return Promise.resolve(entity); // TODO !
        }
    };
});
