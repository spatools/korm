define(["require", "exports", "underscore", "promise/extensions", "../mapping"], function(require, exports, _, promiseExt, mapping) {
    var MemoryStore = (function () {
        function MemoryStore(context) {
            this.memory = {};
            this.context = context;
        }
        MemoryStore.prototype.reset = function () {
            var _this = this;
            return promiseExt.timeout().then(function () {
                _this.memory = {};
            });
        };

        MemoryStore.prototype.getAll = function (setName, query) {
            var self = this;
            return promiseExt.timeout().then(function () {
                var result = _.values(self.getMemorySet(setName));

                if (query) {
                    result = query.apply(result);

                    if (query.selects.size() > 0) {
                        result = self.applySelectsRange(result, query.selects());
                    }

                    if (query.expands.size() > 0) {
                        return self.applyExpandsRange(setName, query.expands(), result);
                    }
                }

                return result;
            });
        };
        MemoryStore.prototype.getOne = function (setName, key, query) {
            var _this = this;
            return promiseExt.timeout().then(function () {
                var table = _this.getMemorySet(setName), item = table[key];

                if (item && query) {
                    if (query.selects.size() > 0) {
                        item = _this.applySelects(item, query.selects());
                    }

                    if (query.expands.size() > 0) {
                        return _this.applyExpands(setName, query.expands(), item);
                    }
                }

                return item;
            });
        };

        MemoryStore.prototype.add = function (setName, item) {
            return this.update(setName, item);
        };
        MemoryStore.prototype.update = function (setName, item) {
            var _this = this;
            return promiseExt.timeout().then(function () {
                var table = _this.getMemorySet(setName), key = _this.getKey(setName, item);

                table[key] = _this.toJS(setName, item);
            });
        };
        MemoryStore.prototype.remove = function (setName, key) {
            var _this = this;
            return promiseExt.timeout().then(function () {
                var table = _this.getMemorySet(setName);
                delete table[key];
            });
        };

        MemoryStore.prototype.addRange = function (setName, items) {
            return this.updateRange(setName, items);
        };
        MemoryStore.prototype.updateRange = function (setName, items) {
            var _this = this;
            return promiseExt.timeout().then(function () {
                var table = _this.getMemorySet(setName), key;

                _.each(items, function (item) {
                    key = _this.getKey(setName, item);
                    table[key] = _this.toJS(setName, item);
                });
            });
        };
        MemoryStore.prototype.removeRange = function (setName, keys) {
            var _this = this;
            return promiseExt.timeout().then(function () {
                var table = _this.getMemorySet(setName);
                _.each(keys, function (key) {
                    delete table[key];
                });
            });
        };

        MemoryStore.prototype.getKey = function (setName, item) {
            var dataset = this.context.getSet(setName);
            return item ? dataset.getKey(item) : dataset.key;
        };
        MemoryStore.prototype.getMemorySet = function (setName) {
            if (!this.memory[setName])
                this.memory[setName] = {};

            return this.memory[setName];
        };
        MemoryStore.prototype.toJS = function (setName, entity) {
            var dataset = this.context.getSet(setName);
            return dataset.toJS(entity, true);
        };

        MemoryStore.prototype.applySelects = function (item, selects) {
            var args = [item, "$type", "odata.type", "EntityState"].concat(selects);
            return _.pick.apply(_, args);
        };
        MemoryStore.prototype.applySelectsRange = function (items, selects) {
            var _this = this;
            return _.map(items, function (item) {
                return _this.applySelects(item, selects);
            });
        };

        MemoryStore.prototype.applyExpands = function (setName, expands, item, _set) {
            var _this = this;
            var dataset = _set || this.context.getSet(setName), conf = mapping.getMappingConfiguration(item, dataset), promises = _.filterMap(conf.relations, function (relation) {
                if (_.contains(expands, relation.propertyName)) {
                    return promiseExt.timeout().then(function () {
                        var q = relation.toQuery(item, dataset, _this.context.getSet(relation.controllerName));

                        return _this.getAll(relation.controllerName, q).then(function (entities) {
                            if (relation.type === 1 /* one */)
                                entities = entities[0];

                            item[relation.propertyName] = entities;
                        });
                    });
                }
            });

            return Promise.all(promises).then(function () {
                return item;
            });
        };
        MemoryStore.prototype.applyExpandsRange = function (setName, expands, result) {
            var _this = this;
            var dataset = this.context.getSet(setName), promises = _.map(result, function (item) {
                return _this.applyExpands(setName, expands, item, dataset);
            });

            return Promise.all(promises).then(function () {
                return result;
            });
        };
        return MemoryStore;
    })();

    
    return MemoryStore;
});
