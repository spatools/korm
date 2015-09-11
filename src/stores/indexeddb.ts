/// <reference path="../../_definitions.d.ts" />

import _ = require("underscore");
import promizr = require("promizr");
import utils = require("koutils/utils");

import stores = require("../stores");
import context = require("../context");
import dataset = require("../dataset");
import mapping = require("../mapping");
import _query = require("../query");

var cachePrefix = "__KORM_DATA__",
    win = <any>window,

    indexedDB = win.indexedDB || win.mozIndexedDB || win.webkitIndexedDB || win.msIndexedDB || win.indexedDBShim,
    IDBTransaction = win.IDBTransaction || win.webkitIDBTransaction || win.msIDBTransaction || (win.indexedDBShim && win.indexedDBShim.modules.IDBTransaction),
    IDBKeyRange = win.IDBKeyRange || win.webkitIDBKeyRange || win.msIDBKeyRange || (win.indexedDBShim && win.indexedDBShim.modules.IDBKeyRange);

class IndexedDBStore implements stores.IDataStore {
    private database: string = "__KORM_DATA__";
    private prefix: string = "";
    private version: number = 1;
    private db: IDBDatabase = null;
    private indexes: { [key: string]: string[] };
    public context: context.DataContext;

    constructor(context: context.DataContext) {
        this.context = context;
    }

    //#region Public Methods

    reset(): Promise<void> {
        if (this.db)
            this.db.close();

        return new Promise<void>((resolve, reject) => {
            var req = indexedDB.deleteDatabase(this.database);
            req.onsuccess = () => resolve(undefined);
            req.onerror = reject;
        });
    }

    getAll(setName: string, query?: _query.ODataQuery): Promise<any[]> {
        return this.getStoreTable(setName, query).then(result => {
            if (query) {
                result = query.apply(result);

                if (query.selects.size() > 0) {
                    result = this.applySelectsRange(result, query.selects());
                }

                if (query.expands.size() > 0) {
                    return this.applyExpandsRange(setName, query.expands(), result);
                }
            }

            return Promise.resolve(result);
        });
    }
    getOne(setName: string, key: any, query?: _query.ODataQuery): Promise<any> {
        return this.getEntity(setName, key).then(entity => {
            if (entity && query) {
                if (query.selects.size() > 0) {
                    entity = this.applySelects(entity, query.selects());
                }

                if (query.expands.size() > 0) {
                    return this.applyExpands(setName, query.expands(), entity);
                }
            }

            return entity;
        });
    }

    add(setName: string, item: any): Promise<void> {
        return this.update(setName, item);
    }
    update(setName: string, item: any): Promise<void> {
        return this.ensureDatabase().then(db => {
            return new Promise<void>((resolve, reject) => {
                var key = this.getKey(setName, item),
                    storeName = this.prefix + setName,
                    store = db.transaction(storeName, "readwrite").objectStore(storeName),
                    request = store.put(this.toJS(setName, item));

                request.onerror = reject;
                request.onsuccess = (e: IDBEvent) => resolve(e.target.result);
            });
        });
    }
    remove(setName: string, key: any): Promise<void> {
        return this.ensureDatabase().then(db => {
            return new Promise<void>((resolve, reject) => {
                var storeName = this.prefix + setName,
                    store = db.transaction(storeName, "readwrite").objectStore(storeName),
                    request = store.delete(key);

                request.onerror = reject;
                request.onsuccess = (e: IDBEvent) => resolve(e.target.result);
            });
        });
    }

    addRange(setName: string, items: any[]): Promise<void> {
        return this.updateRange(setName, items);
    }
    updateRange(setName: string, items: any[]): Promise<void> {
        return this.ensureDatabase().then(db => {
            return new Promise<void>((resolve, reject) => {
                var storeName = this.prefix + setName,
                    transaction = db.transaction(storeName, "readwrite"),
                    store = transaction.objectStore(storeName);

                transaction.onerror = reject;
                transaction.oncomplete = e => resolve(undefined);

                _.each(this.toJSRange(setName, items), item => store.put(item));
            });
        });
    }
    removeRange(setName: string, keys: any[]): Promise<void> {
        return this.ensureDatabase().then(db => {
            return new Promise<void>((resolve, reject) => {
                var storeName = this.prefix + setName,
                    transaction = db.transaction(storeName, "readwrite"),
                    store = transaction.objectStore(storeName);

                transaction.onerror = reject;
                transaction.oncomplete = e => resolve(undefined);

                _.each(keys, key => store.delete(key));
            });
        });
    }

    //#endregion

    //#region Database Methods

    private createUpgradeNeeded(reject: PromiseRejectFunction): (e: IDBVersionChangeEvent) => any {
        return (e: IDBVersionChangeEvent) => {
            var _db: IDBDatabase = e.target.result;

            // A versionchange transaction is started automatically.
            e.target.transaction.onerror = reject;

            _.each(this.context.getSets(), dataset => {
                var tableName = this.prefix + dataset.setName;
                if (!_db.objectStoreNames.contains(tableName)) {
                    var store = _db.createObjectStore(tableName, { keyPath: dataset.key });
                    _.each(this.indexes[dataset.setName], index => {
                        store.createIndex(index, index, { unique: false });
                    });
                }
            });
        };
    }
    private checkDatabaseVersion(): boolean {
        var dbVersion = parseInt(this.db.version, 10);
        if (dbVersion > this.version)
            this.version = dbVersion;

        return _.all(this.context.getSets(), function (set: dataset.DataSet<any, string>) {
            return this.db.objectStoreNames.contains(this.prefix + set.setName);
        }, this);
    }
    private checkDatabaseConnection(): Promise<IDBDatabase> {
        return this.initIndexes().then<IDBDatabase>(() => {
            return new Promise((resolve, reject) => {
                var request = this.version ? indexedDB.open(this.database, this.version) : indexedDB.open(this.database);

                request.onupgradeneeded = this.createUpgradeNeeded(reject);
                request.onsuccess = (e: IDBEvent) => {
                    this.db = e.target.result;

                    if (this.checkDatabaseVersion()) {
                        resolve(this.db);
                    }
                    else {
                        this.db.close();
                        this.upgradeDatabase().then(resolve, reject);
                    }
                };

                request.onerror = reject;
                request.onblocked = reject;
            });
        });
    }
    private upgradeDatabase(): Promise<IDBDatabase> {
        return new Promise((resolve, reject) => {
            var request = indexedDB.open(this.database, ++this.version);

            request.onupgradeneeded = this.createUpgradeNeeded(reject);
            request.onsuccess = (e: IDBEvent) => {
                this.db = e.target.result;
                resolve(this.db);
            };

            request.onblocked = reject;
            request.onerror = reject;
        });
    }

    /** Ensure correct database is opened */
    private ensureDatabase(): Promise<IDBDatabase> {
        return Promise.resolve(this.db || this.checkDatabaseConnection());
    }

    //#endregion

    //#region Private Methods

    private initIndexes(): Promise<void> {
        if (this.indexes) {
            return Promise.resolve(undefined);
        }

        this.indexes = {};
        return promizr.timeout().then(() => {
            _.each(this.context.getSets(), dataset => {
                var conf = mapping.getMappingConfiguration(null, dataset);

                _.each(conf.relations, relation => {
                    if (relation.type === mapping.relationTypes.one) {
                        if (!this.indexes[dataset.setName]) {
                            this.indexes[dataset.setName] = [];
                        }

                        this.indexes[dataset.setName].push(relation.foreignKey);
                    }
                    else if (relation.type === mapping.relationTypes.many) {
                        if (!this.indexes[relation.controllerName]) {
                            this.indexes[relation.controllerName] = [];
                        }

                        this.indexes[relation.controllerName].push(relation.foreignKey);
                    }
                });
            });
        });
    }
    private getStoreTable(setName: string, query?: _query.ODataQuery): Promise<any[]> {
        return this.ensureDatabase().then<any[]>(db => {
            return new Promise((resolve, reject) => {
                var entities = [],
                    storeName = this.prefix + setName,
                    store = db.transaction(storeName, "readonly").objectStore(storeName),
                    cursor = this.createCursor(setName, store, query);

                cursor.onsuccess = function (e: any) {
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
    }
    private createCursor(setName: string, store: IDBObjectStore, query?: _query.ODataQuery): IDBRequest {
        var ids = this.indexes[setName] || [],
            op = _query.operator,
            key = this.getKey(setName),

            idx: string,
            range: IDBKeyRange;

        // Add primary key in ids to filter
        ids.push(key);

        // If no query or no filter
        if (query && query.filters.size() > 0) {
            var operators = [op.equal, op.greaterThan, op.greaterThanOrEqual, op.lessThan, op.lessThanOrEqual],

                filters: _query.Filter[] = query.filters.filter((f: any) =>
                    !_.isString(f) &&
                    _.contains(ids, f.field()) &&
                    _.contains(operators, f.operator())
                );

            if (filters.length > 0) {
                if (filters.length === 1) {
                    var filter = filters[0],
                        operator = filter.operator();

                    // If it's the primary key, don't query index
                    if (filter.field() !== key) {
                        idx = filter.field();
                    }

                    if (operator === op.equal) {
                        range = win.IDBKeyRange.only(filter.value());
                    }
                    else {
                        var method = operator.indexOf("g") === 0 ? "upperBound" : "lowerBound", // ge, gt / le, lt
                            open = operator.indexOf("t") !== -1; // gt / lt

                        range = win.IDBKeyRange[method](filter.value(), open);
                    }
                }

                // a < entity < b
                else if (filters.length === 2 && filters[0].field() === filters[1].field()) {

                    var lowerFilter = filters[0].operator().indexOf("g") === 0 ? filters[0] : filters[1],
                        upperFilter = lowerFilter === filters[0] ? filters[1] : filters[0],

                        lower = lowerFilter.value(),
                        upper = upperFilter.value(),

                        lowerOpen = lowerFilter.operator().indexOf("t") !== -1, // gt / lt
                        upperOpen = upperFilter.operator().indexOf("t") !== -1; // gt / lt

                    // If it's the primary key, don't query index
                    if (filters[0].field() !== key) {
                        idx = filters[0].field();
                    }

                    range = win.IDBKeyRange.bound(lower, upper, lowerOpen, upperOpen);
                }
            }
        }

        if (range) {
            return idx ? store.index(idx).openCursor(range) : store.openCursor(range);
        }
        else {
            return idx ? store.index(idx).openCursor() : store.openCursor();
        }
    }
    private getEntity(setName: string, key: any): Promise<any> {
        return this.ensureDatabase().then(db => {
            return new Promise((resolve, reject) => {
                var storeName = this.prefix + setName,
                    store = db.transaction(this.prefix + setName, "readonly").objectStore(storeName),
                    request = store.get(key);

                request.onerror = reject;
                request.onsuccess = (e: IDBEvent) => resolve(e.target.result);
            });
        });
    }

    /* return set key or item key if specified */
    private getKey(setName: string, item?: any): any {
        var dataset = this.context.getSet(setName);
        return item ? dataset.getKey(item) : dataset.key;
    }
    private toJS(setName: string, item: any): any {
        var dataset = this.context.getSet(setName),
            result = dataset.toJS(item, true),
            key = dataset.key;

        if (!result[key]) {
            result[key] = dataset.getKey(item);
        }

        return result;
    }
    private toJSRange(setName: string, items: any[]): any[] {
        var dataset = this.context.getSet(setName),
            results = dataset.toJSRange(items, true),
            key = dataset.key;

        return _.map(results, (result, i) => {
            if (!result[key]) {
                result[key] = dataset.getKey(items[i]);
            }

            return result;
        });
    }

    private applySelects(item: any, selects: string[]): any {
        var args = [item, "$type", "odata.type", "EntityState"].concat(selects);
        return _.pick.apply(_, args);
    }
    private applySelectsRange(items: any[], selects: string[]): any {
        return _.map(items, item => this.applySelects(item, selects));
    }

    private applyExpands(setName: string, expands: string[], item: any, _set?: dataset.DataSet<any, any>): Promise<any> {
        var dataset = _set || this.context.getSet(setName),
            conf = mapping.getMappingConfiguration(item, dataset),

            promises = _.filterMap(conf.relations, (relation: mapping.Relation) => {
                if (_.contains(expands, relation.propertyName)) {
                    return promizr.timeout().then(() => {
                        var q = relation.toQuery(item, dataset, this.context.getSet(relation.controllerName));

                        return this.getAll(relation.controllerName, q).then(entities => {
                            if (relation.type === mapping.relationTypes.one)
                                entities = entities[0];

                            item[relation.propertyName] = entities;
                        });
                    });
                }
            });

        return Promise.all(promises).then(() => item);
    }
    private applyExpandsRange(setName: string, expands: string[], result: any[]): Promise<any[]> {
        var dataset = this.context.getSet(setName),
            promises = _.map(result, item => this.applyExpands(setName, expands, item, dataset));

        return Promise.all(promises).then(() => result);
    }

    //#endregion
}

export = IndexedDBStore;
