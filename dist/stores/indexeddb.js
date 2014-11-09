/// <reference path="../../_definitions.d.ts" />
define(["require", "exports", "underscore", "promise/extensions", "../mapping", "../query"], function (require, exports, _, promiseExt, mapping, _query) {
    var cachePrefix = "__KORM_DATA__", win = window;
    var IndexedDBStore = (function () {
        function IndexedDBStore(context) {
            this.database = "__KORM_DATA__";
            this.prefix = "";
            this.version = 0;
            this.db = null;
            this.context = context;
            win.indexedDB = win.indexedDB || win.webkitIndexedDB || win.mozIndexedDB || win.msIndexedDB;
            win.IDBTransaction = win.IDBTransaction || win.webkitIDBTransaction || win.msIDBTransaction;
            win.IDBKeyRange = win.IDBKeyRange || win.webkitIDBKeyRange || win.msIDBKeyRange;
        }
        //#region Public Methods
        IndexedDBStore.prototype.reset = function () {
            var _this = this;
            if (this.db)
                this.db.close();
            return new Promise(function (resolve, reject) {
                var req = indexedDB.deleteDatabase(_this.database);
                req.onsuccess = function () { return resolve(undefined); };
                req.onerror = reject;
            });
        };
        IndexedDBStore.prototype.getAll = function (setName, query) {
            var _this = this;
            return this.getStoreTable(setName, query).then(function (result) {
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
        IndexedDBStore.prototype.getOne = function (setName, key, query) {
            var _this = this;
            return this.getEntity(setName, key).then(function (entity) {
                if (entity && query) {
                    if (query.selects.size() > 0) {
                        entity = _this.applySelects(entity, query.selects());
                    }
                    if (query.expands.size() > 0) {
                        return _this.applyExpands(setName, query.expands(), entity);
                    }
                }
                return entity;
            });
        };
        IndexedDBStore.prototype.add = function (setName, item) {
            return this.update(setName, item);
        };
        IndexedDBStore.prototype.update = function (setName, item) {
            var _this = this;
            return this.ensureDatabase().then(function (db) {
                return new Promise(function (resolve, reject) {
                    var key = _this.getKey(setName, item), storeName = _this.prefix + setName, store = db.transaction(storeName, "readwrite").objectStore(storeName), request = store.put(_this.toJS(setName, item));
                    request.onerror = reject;
                    request.onsuccess = function (e) { return resolve(e.target.result); };
                });
            });
        };
        IndexedDBStore.prototype.remove = function (setName, key) {
            var _this = this;
            return this.ensureDatabase().then(function (db) {
                return new Promise(function (resolve, reject) {
                    var storeName = _this.prefix + setName, store = db.transaction(storeName, "readwrite").objectStore(storeName), request = store.delete(key);
                    request.onerror = reject;
                    request.onsuccess = function (e) { return resolve(e.target.result); };
                });
            });
        };
        IndexedDBStore.prototype.addRange = function (setName, items) {
            return this.updateRange(setName, items);
        };
        IndexedDBStore.prototype.updateRange = function (setName, items) {
            var _this = this;
            return this.ensureDatabase().then(function (db) {
                return new Promise(function (resolve, reject) {
                    var storeName = _this.prefix + setName, transaction = db.transaction(storeName, "readwrite"), store = transaction.objectStore(storeName);
                    transaction.onerror = reject;
                    transaction.oncomplete = function (e) { return resolve(undefined); };
                    _.each(_this.toJSRange(setName, items), function (item) { return store.put(item); });
                });
            });
        };
        IndexedDBStore.prototype.removeRange = function (setName, keys) {
            var _this = this;
            return this.ensureDatabase().then(function (db) {
                return new Promise(function (resolve, reject) {
                    var storeName = _this.prefix + setName, transaction = db.transaction(storeName, "readwrite"), store = transaction.objectStore(storeName);
                    transaction.onerror = reject;
                    transaction.oncomplete = function (e) { return resolve(undefined); };
                    _.each(keys, function (key) { return store.delete(key); });
                });
            });
        };
        //#endregion
        //#region Database Methods
        IndexedDBStore.prototype.createUpgradeNeeded = function (reject) {
            var _this = this;
            return function (e) {
                var _db = e.target.result;
                // A versionchange transaction is started automatically.
                e.target.transaction.onerror = reject;
                _.each(_this.context.getSets(), function (dataset) {
                    var tableName = _this.prefix + dataset.setName;
                    if (!_db.objectStoreNames.contains(tableName)) {
                        var store = _db.createObjectStore(tableName, { keyPath: dataset.key });
                        _.each(_this.indexes[dataset.setName], function (index) {
                            store.createIndex(index, index, { unique: false });
                        });
                    }
                });
            };
        };
        IndexedDBStore.prototype.checkDatabaseVersion = function () {
            var dbVersion = parseInt(this.db.version, 10);
            if (dbVersion > this.version)
                this.version = dbVersion;
            return _.all(this.context.getSets(), function (set) {
                return this.db.objectStoreNames.contains(this.prefix + set.setName);
            }, this);
        };
        IndexedDBStore.prototype.checkDatabaseConnection = function () {
            var _this = this;
            return this.initIndexes().then(function () {
                return new Promise(function (resolve, reject) {
                    var request = _this.version ? indexedDB.open(_this.database, _this.version) : indexedDB.open(_this.database);
                    request.onupgradeneeded = _this.createUpgradeNeeded(reject);
                    request.onsuccess = function (e) {
                        _this.db = e.target.result;
                        if (_this.checkDatabaseVersion()) {
                            resolve(_this.db);
                        }
                        else {
                            _this.db.close();
                            _this.upgradeDatabase().then(resolve, reject);
                        }
                    };
                    request.onerror = reject;
                    request.onblocked = reject;
                });
            });
        };
        IndexedDBStore.prototype.upgradeDatabase = function () {
            var _this = this;
            return new Promise(function (resolve, reject) {
                var request = indexedDB.open(_this.database, ++_this.version);
                request.onupgradeneeded = _this.createUpgradeNeeded(reject);
                request.onsuccess = function (e) {
                    _this.db = e.target.result;
                    resolve(_this.db);
                };
                request.onblocked = reject;
                request.onerror = reject;
            });
        };
        /** Ensure correct database is opened */
        IndexedDBStore.prototype.ensureDatabase = function () {
            return Promise.cast(this.db || this.checkDatabaseConnection());
        };
        //#endregion
        //#region Private Methods
        IndexedDBStore.prototype.initIndexes = function () {
            var _this = this;
            if (this.indexes) {
                return Promise.resolve(undefined);
            }
            this.indexes = {};
            return promiseExt.timeout().then(function () {
                _.each(_this.context.getSets(), function (dataset) {
                    var conf = mapping.getMappingConfiguration(null, dataset);
                    _.each(conf.relations, function (relation) {
                        if (relation.type === 1 /* one */) {
                            if (!_this.indexes[dataset.setName]) {
                                _this.indexes[dataset.setName] = [];
                            }
                            _this.indexes[dataset.setName].push(relation.foreignKey);
                        }
                        else if (relation.type === 0 /* many */) {
                            if (!_this.indexes[relation.controllerName]) {
                                _this.indexes[relation.controllerName] = [];
                            }
                            _this.indexes[relation.controllerName].push(relation.foreignKey);
                        }
                    });
                });
            });
        };
        IndexedDBStore.prototype.getStoreTable = function (setName, query) {
            var _this = this;
            return this.ensureDatabase().then(function (db) {
                return new Promise(function (resolve, reject) {
                    var entities = [], storeName = _this.prefix + setName, store = db.transaction(storeName, "readonly").objectStore(storeName), cursor = _this.createCursor(setName, store, query);
                    cursor.onsuccess = function (e) {
                        var _cursor = e.target.result;
                        if (_cursor) {
                            entities.push(_cursor.value);
                            _cursor.continue();
                        }
                        else
                            resolve(entities);
                    };
                    cursor.onerror = reject;
                });
            });
        };
        IndexedDBStore.prototype.createCursor = function (setName, store, query) {
            var ids = this.indexes[setName], op = _query.operator, key = this.getKey(setName), idx, range;
            // Add primary key in ids to filter
            ids.push(key);
            // If no query or no filter
            if (query && query.filters.size() > 0) {
                var operators = [op.equal, op.greaterThan, op.greaterThanOrEqual, op.lessThan, op.lessThanOrEqual], filters = query.filters.filter(function (f) { return !_.isString(f) && _.contains(ids, f.field()) && _.contains(operators, f.operator()); });
                if (filters.length > 0) {
                    if (filters.length === 1) {
                        var filter = filters[0], operator = filter.operator();
                        // If it's the primary key, don't query index
                        if (filter.field() !== key) {
                            idx = filter.field();
                        }
                        if (operator === op.equal) {
                            range = win.IDBKeyRange.only(filter.value());
                        }
                        else {
                            var method = operator.indexOf("g") === 0 ? "upperBound" : "lowerBound", open = operator.indexOf("t") !== -1; // gt / lt
                            range = win.IDBKeyRange[method](filter.value(), open);
                        }
                    }
                    else if (filters.length === 2 && filters[0].field() === filters[1].field()) {
                        var lowerFilter = filters[0].operator().indexOf("l") === 0 ? filters[0] : filters[1], upperFilter = lowerFilter === filters[0] ? filters[1] : filters[0], lower = lowerFilter.value(), upper = upperFilter.value(), lowerOpen = lowerFilter.operator().indexOf("t") !== -1, upperOpen = upperFilter.operator().indexOf("t") !== -1; // gt / lt
                        // If it's the primary key, don't query index
                        if (filters[0].field() !== key) {
                            idx = filters[0].field();
                        }
                        range = win.IDBKeyRange.bound(lower, upper, lowerOpen, upperOpen);
                    }
                }
            }
            if (idx) {
                return store.index(idx).openCursor(range);
            }
            else {
                return store.openCursor(range);
            }
        };
        IndexedDBStore.prototype.getEntity = function (setName, key) {
            var _this = this;
            return this.ensureDatabase().then(function (db) {
                return new Promise(function (resolve, reject) {
                    var storeName = _this.prefix + setName, store = db.transaction(_this.prefix + setName, "readonly").objectStore(storeName), request = store.get(key);
                    request.onerror = reject;
                    request.onsuccess = function (e) { return resolve(e.target.result); };
                });
            });
        };
        /* return set key or item key if specified */
        IndexedDBStore.prototype.getKey = function (setName, item) {
            var dataset = this.context.getSet(setName);
            return item ? dataset.getKey(item) : dataset.key;
        };
        IndexedDBStore.prototype.toJS = function (setName, item) {
            var dataset = this.context.getSet(setName), result = dataset.toJS(item, true), key = dataset.key;
            if (!result[key]) {
                result[key] = dataset.getKey(item);
            }
            return result;
        };
        IndexedDBStore.prototype.toJSRange = function (setName, items) {
            var dataset = this.context.getSet(setName), results = dataset.toJSRange(items, true), key = dataset.key;
            return _.map(results, function (result, i) {
                if (!result[key]) {
                    result[key] = dataset.getKey(items[i]);
                }
                return result;
            });
        };
        IndexedDBStore.prototype.applySelects = function (item, selects) {
            var args = [item, "$type", "odata.type", "EntityState"].concat(selects);
            return _.pick.apply(_, args);
        };
        IndexedDBStore.prototype.applySelectsRange = function (items, selects) {
            var _this = this;
            return _.map(items, function (item) { return _this.applySelects(item, selects); });
        };
        IndexedDBStore.prototype.applyExpands = function (setName, expands, item, _set) {
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
            return Promise.all(promises).then(function () { return item; });
        };
        IndexedDBStore.prototype.applyExpandsRange = function (setName, expands, result) {
            var _this = this;
            var dataset = this.context.getSet(setName), promises = _.map(result, function (item) { return _this.applyExpands(setName, expands, item, dataset); });
            return Promise.all(promises).then(function () { return result; });
        };
        return IndexedDBStore;
    })();
    return IndexedDBStore;
});
