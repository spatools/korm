define(["require", "exports", "knockout", "underscore", "promise", "./mapping", "./query", "kounderscore", "koutils/utils", "koutils/extenders"], function (require, exports, ko, _, Promise, mapping, query, ko_, utils) {
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
        refresh: function (mode) {
            var self = this;
            return self.set.refresh(mode, self.query).then(function (data) {
                if (self.query.pageSize() > 0)
                    self.lastResult(data);
                return data;
            });
        },
        load: function (key, mode) {
            return this.set.load(key, mode, this.query);
        },
        sync: function () {
            return this.set.sync(this.query);
        },
        add: function (entity) {
            return this.set.add(entity);
        },
        update: function (entity) {
            return this.set.update(entity);
        },
        remove: function (entity) {
            return this.set.remove(entity);
        },
        findByKey: function (key) {
            return this.set.findByKey(key);
        },
        saveEntity: function (entity) {
            return this.set.saveEntity(entity);
        },
        resetEntity: function (entity) {
            return this.set.resetEntity(entity);
        },
        getChanges: function () {
            return this.groupBy(function (e) { return e.EntityState(); });
        },
        saveChanges: function () {
            var changes = this.getChanges(), set = this.set, states = mapping.entityStates, promises = _.union(_.map(changes[states.added], function (e) { return set._remoteCreate(e); }), _.map(changes[states.modified], function (e) { return set._remoteUpdate(e); }), _.map(changes[states.removed], function (e) { return set._remoteRemove(e); }));
            return Promise.all(promises);
        }
    };
    ko_.addTo(dataViewFunctions);
});
