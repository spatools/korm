define(["require", "exports", "underscore", "promise/extensions", "../mapping"], function(require, exports, _, promiseExt, mapping) {
    var cachePrefix = "__SPA_DATA__";

    var LocalStorageStore = (function () {
        function LocalStorageStore(context) {
            this.context = context;
        }
        LocalStorageStore.prototype.reset = function () {
            return promiseExt.forEach(this.context.getSets(), function (dataset) {
                localStorage.removeItem(cachePrefix + dataset.setName);
            });
        };

        LocalStorageStore.prototype.getAll = function (setName, query) {
            var _this = this;
            return this.getStoreTable(setName).then(function (table) {
                var result = _.values(table);

                if (query) {
                    result = query.apply(result);

                    if (query.selects.size() > 0) {
                        result = _this.applySelectsRange(result, query.selects());
                    }

                    if (query.expands.size() > 0) {
                        return _this.applyExpandsRange(setName, query.expands(), result);
                    }
                }

                return Promise.resolve(result);
            });
        };
        LocalStorageStore.prototype.getOne = function (setName, key, query) {
            var _this = this;
            return this.getStoreTable(setName).then(function (table) {
                var item = table[key];

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

        LocalStorageStore.prototype.add = function (setName, item) {
            return this.update(setName, item);
        };
        LocalStorageStore.prototype.update = function (setName, item) {
            var _this = this;
            return this.getStoreTable(setName).then(function (table) {
                var key = _this.getKey(setName, item);
                table[key] = _this.toJS(setName, item);
                return _this.setStoreTable(setName, table);
            });
        };
        LocalStorageStore.prototype.remove = function (setName, key) {
            var _this = this;
            return this.getStoreTable(setName).then(function (table) {
                if (table[key]) {
                    delete table[key];
                    return _this.setStoreTable(setName, table);
                }
            });
        };

        LocalStorageStore.prototype.addRange = function (setName, items) {
            return this.updateRange(setName, items);
        };
        LocalStorageStore.prototype.updateRange = function (setName, items) {
            var _this = this;
            return this.getStoreTable(setName).then(function (table) {
                _.each(items, function (item) {
                    var key = _this.getKey(setName, item);
                    table[key] = _this.toJS(setName, item);
                });

                return _this.setStoreTable(setName, table);
            });
        };
        LocalStorageStore.prototype.removeRange = function (setName, keys) {
            var _this = this;
            return this.getStoreTable(setName).then(function (table) {
                _.each(keys, function (key) {
                    if (table[key])
                        delete table[key];
                });

                return _this.setStoreTable(setName, table);
            });
        };

        LocalStorageStore.prototype.getStoreTable = function (setName) {
            return promiseExt.timeout().then(function () {
                return JSON.parse(localStorage.getItem(cachePrefix + setName)) || {};
            });
        };
        LocalStorageStore.prototype.setStoreTable = function (setName, setValue) {
            return promiseExt.timeout().then(function () {
                localStorage.setItem(cachePrefix + setName, JSON.stringify(setValue));
            });
        };

        LocalStorageStore.prototype.getKey = function (setName, item) {
            var dataset = this.context.getSet(setName);
            return item ? dataset.getKey(item) : dataset.key;
        };
        LocalStorageStore.prototype.toJS = function (setName, entity) {
            var dataset = this.context.getSet(setName);
            return dataset.toJS(entity, true);
        };

        LocalStorageStore.prototype.applySelects = function (item, selects) {
            var args = [item, "$type", "odata.type", "EntityState"].concat(selects);
            return _.pick.apply(_, args);
        };
        LocalStorageStore.prototype.applySelectsRange = function (items, selects) {
            var _this = this;
            return _.map(items, function (item) {
                return _this.applySelects(item, selects);
            });
        };

        LocalStorageStore.prototype.applyExpands = function (setName, expands, item, _set) {
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
        LocalStorageStore.prototype.applyExpandsRange = function (setName, expands, result) {
            var _this = this;
            var dataset = this.context.getSet(setName), promises = _.map(result, function (item) {
                return _this.applyExpands(setName, expands, item, dataset);
            });

            return Promise.all(promises).then(function () {
                return result;
            });
        };
        return LocalStorageStore;
    })();

    
    return LocalStorageStore;
});
