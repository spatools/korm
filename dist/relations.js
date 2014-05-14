define(["require", "exports", "knockout", "underscore", "./query"], function(require, exports, ko, _, _query) {
    function create(localSet, foreignSet, relation, entity) {
        switch (relation.type) {
            case 0:
                return exports.collection(localSet, foreignSet, relation, entity);
            case 1:
                return exports.foreign(localSet, foreignSet, relation, entity);
            case 2:
                return exports.remote(localSet, foreignSet, relation, entity);
        }
    }
    exports.create = create;

    

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
        refresh: function (mode) {
            var self = this;
            if (self.ensureRemote) {
                return self.localSet.refreshRelation(self.parent, self.propertyName, mode, self.query);
            } else {
                return self.set.refresh(mode, self.query).then(function (data) {
                    if (self.query.pageSize() > 0)
                        self.lastResult(data);

                    return data;
                });
            }
        },
        add: function (entity) {
            entity[this.foreignId](ko.unwrap(this.parent[this.localId]));
            return this.set.add(entity);
        }
    };

    

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
        refresh: function (mode) {
            var self = this;
            if (self.ensureRemote) {
                return self.foreignSet.refreshRelation(self.parent, self.propertyName, mode, self.view.query);
            } else {
                return self.view.refresh(mode);
            }
        },
        sync: function () {
            return this.view.sync();
        },
        update: function () {
            var entity = this();
            if (entity)
                this.view.update(entity);
        },
        change: function (newEntity, deleteOld) {
            if (typeof deleteOld === "undefined") { deleteOld = false; }
            var self = this, entity = this(), op = this.foreignSet.isAttached(newEntity) ? newEntity : this.foreignSet.add(newEntity);

            return Promise.cast(op).then(function () {
                self.parent[self.localId](ko.unwrap(newEntity[self.foreignId]));

                if (deleteOld && entity)
                    return self.foreignSet.remove(entity);
            }).then(function () {
                return newEntity;
            });
        },
        save: function () {
            var entity = this();
            return Promise.cast(entity && this.view.saveEntity(entity));
        }
    };

    

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
        add: function (entity) {
            return Promise.resolve(entity);
        },
        update: function (entity) {
            return Promise.resolve(entity);
        },
        remove: function (entity) {
            return Promise.resolve(entity);
        }
    };
});
