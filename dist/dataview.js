/// <reference path="../_definitions.d.ts" />
/// <amd-dependency path="koutils/extenders" />
define(["require", "exports", "knockout", "underscore", "promise", "./mapping", "./query", "kounderscore", "koutils/utils", "koutils/extenders"], function (require, exports, ko, _, Promise, mapping, query, ko_, utils) {
    //#endregion
    //#region Model
    /** Creates a data view for the given data set */
    function create(dataSet, _query) {
        var self = {
            query: _query || new query.ODataQuery(),
            set: dataSet,
            lastResult: ko.observableArray()
        };
        var result = ko.pureComputed(function () {
            if (self.query.pageSize() > 0 && !self.set.isSynchronized() && self.lastResult.size() > 0) {
                return self.lastResult();
            }
            return self.query.apply(self.set.toArray(), true);
        }).extend({ notify: utils.arrayEquals });
        _.extend(result, self, dataViewFunctions);
        return result;
    }
    exports.create = create;
    var dataViewFunctions = {
        /** Refresh the view from the server */
        refresh: function (mode) {
            var self = this;
            return self.set.refresh(mode, self.query).then(function (data) {
                if (self.query.pageSize() > 0)
                    self.lastResult(data);
                return data;
            });
        },
        /** Load a remote entity by key */
        load: function (key, mode) {
            return this.set.load(key, mode, this.query);
        },
        /** Synchronize data store with remote source content filtered with view's query */
        sync: function () {
            return this.set.sync(this.query);
        },
        /** Add entity to view, if buffer is false, entity will be instantly post on the server */
        add: function (entity) {
            return this.set.add(entity);
        },
        /** Update entity on view, if buffer is false, entity will be instantly put on the server */
        update: function (entity) {
            return this.set.update(entity);
        },
        /** Remove entity from dataset, if buffer is false, entity will be instantly deleted on the server */
        remove: function (entity) {
            return this.set.remove(entity);
        },
        findByKey: function (key) {
            return this.set.findByKey(key);
        },
        /** Save changes of an entity to the server */
        saveEntity: function (entity) {
            return this.set.saveEntity(entity);
        },
        /** Reset entity to its original state */
        resetEntity: function (entity) {
            return this.set.resetEntity(entity);
        },
        /** Get a report of changes in the dataview */
        getChanges: function () {
            return this.groupBy(function (e) { return e.EntityState(); });
        },
        /** Commits all Pending Operations (PUT, DELETE, POST) */
        saveChanges: function () {
            /// <summary>Commits all Pending Operations (PUT, DELETE, POST)</summary>
            /// <returnss type="$.Deffered">return a deffered object for async operations</returnss>
            var changes = this.getChanges(), set = this.set, states = mapping.entityStates, promises = _.union(_.map(changes[1 /* added */], function (e) { return set._remoteCreate(e); }), _.map(changes[2 /* modified */], function (e) { return set._remoteUpdate(e); }), _.map(changes[3 /* removed */], function (e) { return set._remoteRemove(e); }));
            return Promise.all(promises);
        }
    };
    ko_.addTo(dataViewFunctions);
});
//#endregion
