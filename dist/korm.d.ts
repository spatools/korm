/// <reference path="../../../typings/knockout/knockout.d.ts" />
/// <reference path="../bower_components/promise-ext/src/promise.d.ts" />

declare module "korm/adapters" {
import query = require("korm/query");
export interface IAdapterConstructor {
    new (): IAdapter;
}
export interface IAdapter {
    getAll(controller: string, query?: query.ODataQuery): Promise<IAdapterResult>;
    getOne(controler: string, id: any, query?: query.ODataQuery): Promise<any>;
    getRelation?(controller: string, relationName: string, id: any, query?: query.ODataQuery): Promise<IAdapterResult>;
    post(controller: string, data: any): Promise<any>;
    put(controller: string, id: any, data: any): Promise<any>;
    remove(controller: string, id: any): Promise<any>;
    batch?(controller: string, changes: any): Promise<any>;
    action?(controller: string, action: string, parameters: any, id?: any): Promise<any>;
}
export interface IAdapterResult {
    data: any;
    count: number;
}
export function getDefaultAdapter(): IAdapter;
export function getAdapter(name: string): Promise<IAdapter>;
}

declare module "korm/context" {
import Promise = require("promise");
import mapping = require("korm/mapping");
import stores = require("korm/stores");
import adapters = require("korm/adapters");
import dataset = require("korm/dataset");
export class DataContext {
    private sets;
    store: stores.IDataStore;
    adapter: adapters.IAdapter;
    buffer: boolean;
    autoLazyLoading: boolean;
    mapping: mapping.Configurations;
    refreshMode: string;
    constructor();
    /** Get Mapping Configuration for specified type */
    getMappingConfiguration(type: string): mapping.Configuration;
    /** Add a mapping configuration to this data context */
    addMappingConfiguration(config: mapping.Configuration): DataContext;
    /** Get all sets defined in current context */
    getSets(): dataset.DataSet<any, any>[];
    /** Get set from name */
    getSet<T, TKey>(name: string): dataset.DataSet<T, TKey>;
    /** Add a new Data Set to current Data Context */
    addSet<T, TKey>(name: string, keyProperty: string, defaultType: string): dataset.DataSet<T, TKey>;
    reset(): void;
    resetStore(): Promise<void>;
    /** Change refresh mode for all sets */
    setRefreshMode(mode: string): void;
    /** change local store type */
    setLocalStore(storeType: string): Promise<any>;
    setLocalStore(storeType: stores.IDataStore): Promise<any>;
    /** change remote adapter type */
    setAdapter(adapterType: string): Promise<any>;
    setAdapter(adapterType: adapters.IAdapter): Promise<any>;
}
export function create(storeType?: string, adapterType?: string, buffer?: boolean, autoLazyLoading?: boolean): Promise<DataContext>;
}

declare module "korm/dataset" {
import mapping = require("korm/mapping");
import stores = require("korm/stores");
import context = require("korm/context");
import dataview = require("korm/dataview");
import adapters = require("korm/adapters");
import query = require("korm/query");
export interface DataSet<T, TKey> extends KnockoutUnderscoreArrayFunctions<T>, KnockoutUnderscoreObjectsFunctions<T>, KnockoutObservable<Array<T>>, DataSetFunctions<T, TKey> {
    setName: string;
    key: string;
    defaultType: string;
    context: context.DataContext;
    adapter: adapters.IAdapter;
    localstore: stores.IDataStore;
    refreshMode: string;
    localCount: KnockoutComputed<number>;
    remoteCount: KnockoutObservable<number>;
    realCount: KnockoutComputed<number>;
    isSynchronized: KnockoutComputed<boolean>;
}
export interface DataSetChanges<T> {
    unchanged?: T[];
    added?: T[];
    modified?: T[];
    removed?: T[];
}
export interface DataSetFunctions<T, TKey> {
    /** Change local store */
    setLocalStore(store: stores.IDataStore): void;
    /** Change remote adapter */
    setAdapter(adapter: adapters.IAdapter): void;
    /** Reset this dataset by detaching all entities */
    reset(): void;
    /** Create a new view of the current set with specified query */
    createView(): dataview.DataView<T, TKey>;
    createView(query: query.ODataQuery): dataview.DataView<T, TKey>;
    /** Refresh dataset from remote source */
    refresh(): Promise<T[]>;
    refresh(query: query.ODataQuery): Promise<T[]>;
    refresh(mode: string): Promise<T[]>;
    refresh(mode: string, query: query.ODataQuery): Promise<T[]>;
    /** Query server to refresh dataset */
    query(): Promise<T[]>;
    query(query: query.ODataQuery): Promise<T[]>;
    query(mode: string): Promise<T[]>;
    query(mode: string, query: query.ODataQuery): Promise<T[]>;
    /** Load an entity by id from the remote source */
    load(key: TKey): Promise<T>;
    load(key: TKey, query: query.ODataQuery): Promise<T>;
    load(key: TKey, mode: string): Promise<T>;
    load(key: TKey, mode: string, query: query.ODataQuery): Promise<T>;
    /** Synchronize data store with remote source content */
    sync(): Promise<void>;
    sync(query: query.ODataQuery): Promise<void>;
    /** Get relation by ensuring using specific remote action and not filter */
    refreshRelation<U>(entity: T, propertyName: string): Promise<U>;
    refreshRelation<U>(entity: T, propertyName: string, query: query.ODataQuery): Promise<U>;
    refreshRelation<U>(entity: T, propertyName: string, mode: string): Promise<U>;
    refreshRelation<U>(entity: T, propertyName: string, mode: string, query: query.ODataQuery): Promise<U>;
    refreshRelation<U>(entity: T, propertyName: string, mode: string, query: query.ODataQuery, nostore: boolean): Promise<U>;
    /** Execute action on remote source */
    executeAction(action: string, params?: any, entity?: T): Promise<any>;
    /** Gets the key associated with an entity */
    getKey(entity: T): TKey;
    /** Finds a matching entity in the set (by key) */
    findByKey(key: TKey): T;
    /** Add entity to dataset, if buffer is false, entity will be instantly post on the server */
    add(entity: T): Promise<T>;
    /** Add entities to dataset, if buffer is false, entities will be instantly post on the server */
    addRange(entities: T[]): Promise<T[]>;
    /** Update entity on dataset, if buffer is false, entity will be instantly put on the server */
    update(entity: T): Promise<T>;
    /** Update entities on dataset, if buffer is false, entities will be instantly put on the server */
    updateRange(entities: T[]): Promise<T[]>;
    /** Remove entity from dataset, if buffer is false, entity will be instantly deleted on the server */
    remove(entity: T): Promise<T>;
    /** Remove entities from dataset, if buffer is false, entities will be instantly deleted on the server */
    removeRange(entities: T[]): Promise<T[]>;
    /** Reset entity to its original state */
    resetEntity(entity: T): Promise<any>;
    /** Dispose and clean entity */
    disposeEntity(entity: T): void;
    /** Get whether entity is attached or not */
    isAttached(entity: T): boolean;
    /** Attach an entity to the dataSet (commits immediately if buffer is false) */
    attach(entity: T): Promise<T>;
    attach(entity: T, store: boolean): Promise<T>;
    /** Attach an Array of entities to the dataSet */
    attachRange(entities: T[]): Promise<T[]>;
    attachRange(entities: T[], store: boolean): Promise<T[]>;
    /** Stop an entity from being tracked by the dataSet */
    detach(entity: T): void;
    /** Stop an array of entities from being tracked by the dataSet */
    detachRange(entityKeys: TKey[]): void;
    /** Attach or update entity if existing with current data and commit changes if commit is set to true */
    attachOrUpdate(data: any): Promise<T>;
    attachOrUpdate(data: any, commit: boolean): Promise<T>;
    attachOrUpdate(data: any, commit: boolean, expand: boolean): Promise<T>;
    attachOrUpdate(data: any, commit: boolean, expand: boolean, store: boolean): Promise<T>;
    /** Attach or update entities if existing with current data and commit changes if commit is set to true */
    attachOrUpdateRange(data: any): Promise<T>;
    attachOrUpdateRange(data: any, commit: boolean): Promise<T>;
    attachOrUpdateRange(data: any, commit: boolean, expand: boolean): Promise<T>;
    attachOrUpdateRange(data: any, commit: boolean, expand: boolean, store: boolean): Promise<T>;
    /** Store entity to local store without attaching to datacontext */
    store(entity: any): Promise<any>;
    /** Store entities to local store without attaching to datacontext */
    storeRange(entities: any[]): Promise<any[]>;
    /** Create a JS object from given entity */
    toJS(entity: T): any;
    toJS(entity: T, keepstate: boolean): any;
    /** Create a JS array from given entities */
    toJSRange(entity: T[]): any[];
    toJSRange(entity: T[], keepstate: boolean): any[];
    /** Serialize given entity to JSON */
    toJSON(entity: T): string;
    toJSON(entity: T, keepstate: boolean): string;
    /** Instanciate entities from a JS array */
    fromJSRange(data: any[]): Promise<T[]>;
    fromJSRange(data: any[], state: mapping.entityStates): Promise<T[]>;
    fromJSRange(data: any[], state: mapping.entityStates, expand: boolean): Promise<T[]>;
    fromJSRange(data: any[], state: mapping.entityStates, expand: boolean, store: boolean): Promise<T[]>;
    /** Instanciate an entity from a JS object */
    fromJS(data: any): Promise<T>;
    fromJS(data: any, state: mapping.entityStates): Promise<T>;
    fromJS(data: any, state: mapping.entityStates, expand: boolean): Promise<T>;
    fromJS(data: any, state: mapping.entityStates, expand: boolean, store: boolean): Promise<T>;
    /** Instanciate an entity from a JSON string */
    fromJSON(json: string): T;
    fromJSON(json: string, state: mapping.entityStates): Promise<T>;
    fromJSON(json: string, state: mapping.entityStates, expand: boolean): Promise<T>;
    fromJSON(json: string, state: mapping.entityStates, expand: boolean, store: boolean): Promise<T>;
    /** Save changes of an entity to the server */
    saveEntity(entity: T): Promise<T>;
    /** Get a report of changes in the dataSet */
    getChanges(): DataSetChanges<T>;
    /** Get a report of changes in given entities */
    getChanges(entities: T[]): DataSetChanges<T>;
    /** Commits all Pending Operations (PUT, DELETE, POST) */
    saveChanges(): Promise<any>;
    /** Commits all Pending Operations in given entities (PUT, DELETE, POST) */
    saveChanges(entities: T[]): Promise<any>;
    /** Submits an Entity to the Server (internal use) */
    _remoteCreate(entity: T): Promise<T>;
    /** Updates an Item to the Server (internal use */
    _remoteUpdate(entity: T): Promise<T>;
    /** Deletes an Item from the Server (internal use) */
    _remoteRemove(entity: T): Promise<T>;
    /** Deletes an Item from the Server (internal use) */
    _remoteBatch(changes: DataSetChanges<T>): Promise<void>;
}
export function create<T, TKey>(setName: string, keyPropertyName: string, defaultType: string, dataContext: context.DataContext): DataSet<T, TKey>;
}

declare module "korm/dataview" {
import Promise = require("promise");
import dataset = require("korm/dataset");
import query = require("korm/query");
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
/** Creates a data view for the given data set */
export function create<T, TKey>(dataSet: dataset.DataSet<T, TKey>, _query?: query.ODataQuery): DataView<T, TKey>;
}

declare module "korm/guid" {
export var empty: string;
export function generate(): string;
export function generateTemp(): string;
export function generateMin(): string;
export function isGuid(guid: string): boolean;
export function isTemp(guid: string): boolean;
}

declare module "korm/mapping" {
import Promise = require("promise");
import dataset = require("korm/dataset");
import query = require("korm/query");
/** Enumeration representing relations types */
export enum relationTypes {
    many = 0,
    one = 1,
    remote = 2,
}
/** Enumeration for differents entity states */
export enum entityStates {
    unchanged = 0,
    added = 1,
    modified = 2,
    removed = 3,
}
/** Default types properties (internal usage) */
export var typeProperties: string[];
/** Default mapping rules (internal usage) */
export var defaultRules: KnockoutMappingOptions;
/** Class representing a relation for an entity set */
export class Relation {
    propertyName: string;
    type: relationTypes;
    controllerName: string;
    foreignKey: string;
    ensureRemote: boolean;
    constructor(propertyName: string, type: relationTypes, controllerName: string, foreignKey: string, ensureRemote?: boolean);
    toQuery(item: any, localSet: dataset.DataSet<any, any>, foreignSet: dataset.DataSet<any, any>): query.ODataQuery;
}
export interface ConfigurationOptions {
    type: string;
    baseType?: string;
    model?: any;
    rules?: KnockoutMappingOptions;
    relations?: Relation[];
    actions?: string[];
}
/** Class representing a mapping configuration for serialization / deserialization scenarios */
export class Configuration {
    _rules: KnockoutMappingOptions;
    type: string;
    baseType: string;
    model: any;
    rules: KnockoutMappingOptions;
    relations: Relation[];
    actions: string[];
    constructor(options: ConfigurationOptions);
    constructor(type: string);
    constructor(type: string, object: any, relations?: Relation[], rules?: KnockoutMappingOptions, actions?: string[], baseType?: string);
}
/** Abstract mapping configurations for dataContext */
export class Configurations {
    private configurations;
    /** Get configuration by type */
    getConfiguration(type: string): Configuration;
    /** Add a mapping configuration */
    addConfiguration(configuration: Configuration): Configurations;
    /** Add an array of mapping configurations */
    addConfigurations(configs: Configuration[]): Configurations;
    /** Remove a configuration by type */
    removeConfiguration(type: string): Configurations;
}
export function getMappingConfiguration<T, TKey>(entity: {}, dataSet: dataset.DataSet<T, TKey>): Configuration;
/** Add mapping properties to an entity */
export function addMappingProperties<T, TKey>(model: any, dataSet: dataset.DataSet<T, TKey>, config?: Configuration, initialState?: entityStates, data?: any): any;
/** Refresh all entity relations */
export function refreshRelations<T, TKey>(entity: any, dataSet: dataset.DataSet<T, TKey>): Promise<T>;
/** Duplicate specified entity and return copy */
export function duplicateEntity<T, TKey>(entity: any, dataSet: dataset.DataSet<T, TKey>): T;
/** Update specified entity with given data */
export function updateEntity<T, TKey>(entity: any, data: any, commit: boolean, expand: boolean, store: boolean, dataSet: dataset.DataSet<T, TKey>): Promise<T>;
/** Update specified set of entities with given data array */
export function updateEntities<T, TKey>(entities: any[], datas: any[], commit: boolean, expand: boolean, store: boolean, dataSet: dataset.DataSet<T, TKey>): Promise<T[]>;
/** Reset specified entity with last remote data */
export function resetEntity<T, TKey>(entity: any, dataSet: dataset.DataSet<T, TKey>): T;
export function mapEntitiesFromJS<T, TKey>(datas: any[], initialState: entityStates, expand: boolean, store: boolean, dataSet: dataset.DataSet<T, TKey>): Promise<T[]>;
export function mapEntityFromJS<T, TKey>(data: any, initialState: entityStates, expand: boolean, store: boolean, dataSet: dataset.DataSet<T, TKey>): Promise<T>;
export function mapEntityToJS<T, TKey>(entity: any, keepState: boolean, dataSet: dataset.DataSet<T, TKey>): any;
export function mapEntitiesToJS<T, TKey>(entities: any[], keepState: boolean, dataSet: dataset.DataSet<T, TKey>): any;
export function mapEntityFromJSON<T, TKey>(json: string, initialState: entityStates, expand: boolean, store: boolean, dataSet: dataset.DataSet<T, TKey>): Promise<T>;
export function mapEntityToJSON<T, TKey>(entity: any, keepstate: boolean, dataSet: dataset.DataSet<T, TKey>): string;
}

declare module "korm/query" {
export var operator: {
    equal: string;
    notEqual: string;
    greaterThan: string;
    greaterThanOrEqual: string;
    lessThan: string;
    lessThanOrEqual: string;
    and: string;
    or: string;
    not: string;
};
export var mathOperator: {
    add: string;
    sub: string;
    mul: string;
    div: string;
    mod: string;
};
export var math: {
    round: string;
    floor: string;
    ceiling: string;
};
export var string: {
    substringof: string;
    endswith: string;
    startswith: string;
    length: string;
    indexof: string;
    replace: string;
    substring: string;
    substringTo: string;
    tolower: string;
    toupper: string;
    trim: string;
    concat: string;
};
export var date: {
    day: string;
    hour: string;
    minute: string;
    month: string;
    second: string;
    year: string;
};
export var type: {
    isof: string;
    propisof: string;
};
export class Filter {
    field: KnockoutObservable<string>;
    operator: KnockoutObservable<string>;
    value: KnockoutObservable<any>;
    constructor(field: any, operator?: any, value?: any);
    /** Creates a String acceptable for odata Query String $filter */
    toQueryString(): string;
    /** Return a function to filter entities using underscore */
    toUnderscoreQuery(): (item: any) => boolean;
    getValueType(value?: any): string;
    formatValue(value?: any): string;
    getItemField(item: any, field: string): any;
}
export class FunctionFilter extends Filter {
    fn: KnockoutObservable<string>;
    private _field;
    args: KnockoutObservable<any>;
    field: KnockoutObservable<string>;
    constructor(fn: any, field: any, args?: any, operator?: any, value?: any);
    getItemField(item: any, field: string): any;
    private formatField();
}
export class Ordering {
    field: KnockoutObservable<string>;
    ascending: KnockoutObservable<boolean>;
    constructor(field: any, ascending?: any);
    /** Creates a String acceptable for odata Query String $orderby */
    toQueryString(): string;
    /** Create a sorting function to sort entities locally */
    toSortFunction(): (item1: any, item2: any) => number;
}
export class ODataQuery {
    pageNum: KnockoutObservable<number>;
    pageSize: KnockoutObservable<number>;
    ordersby: KnockoutObservableArray<Ordering>;
    filters: KnockoutObservableArray<any>;
    total: KnockoutObservable<boolean>;
    includeDeleted: KnockoutObservable<boolean>;
    selects: KnockoutObservableArray<string>;
    expands: KnockoutObservableArray<string>;
    constructor(options?: any);
    addFilter(field: any, type: any, value: any): ODataQuery;
    addOrdering(field: any, ascending: any): ODataQuery;
    where(field: string): ODataQuery;
    where(field: string, operator: string, value: any): ODataQuery;
    where(fn: string, field: string): ODataQuery;
    where(fn: string, field: string, args: any[]): ODataQuery;
    where(fn: string, field: string, operator: string, value: string): ODataQuery;
    where(fn: string, field: string, args: any[], operator: string, value: string): ODataQuery;
    /** Order by specified field */
    orderby(field: any, ascending?: any): ODataQuery;
    expand(...fields: string[]): ODataQuery;
    select(...fields: string[]): ODataQuery;
    and(): ODataQuery;
    or(): ODataQuery;
    /** Creates an OData Query string (includes $filter, $skip, $top, $orderby) */
    toQueryString(): string;
    /** Returns a function for local filtering */
    toLocalFilter(): (item: any) => boolean;
    /** Returns a function for local sorting */
    toLocalSorting(): (item1: any, item2: any) => number;
    /** Filter specified array */
    applyFilters<T>(array: T[]): T[];
    /** Sort specified array */
    applySorting<T>(array: T[]): T[];
    /** Apply paging to specified array */
    applyPaging<T>(array: T[], correctPageNum?: boolean): T[];
    /** Apply this query to specified array */
    apply<T>(array: T[], correctPageNum?: boolean): T[];
}
}

declare module "korm/relations" {
import dataset = require("korm/dataset");
import dataview = require("korm/dataview");
import mapping = require("korm/mapping");
import _query = require("korm/query");
export function create<T, TKey, TForeign, TForeignKey>(localSet: dataset.DataSet<T, TKey>, foreignSet: dataset.DataSet<TForeign, TForeignKey>, relation: mapping.Relation, entity: any): any;
export interface RelationCollectionView<T, TKey, TForeign, TForeignKey> extends dataview.DataView<TForeign, TForeignKey> {
    propertyName: string;
    parent: any;
    localSet: dataset.DataSet<T, TKey>;
    foreignSet: dataset.DataSet<TForeign, TForeignKey>;
    localId: string;
    foreignId: string;
    ensureRemote: boolean;
}
export interface CollectionView<T, TForeign> extends RelationCollectionView<T, any, TForeign, any> {
}
export interface Collection<TForeign> extends CollectionView<any, TForeign> {
}
/** Create an observable relation to many entities */
export function collection<T, TKey, TForeign, TForeignKey>(localSet: dataset.DataSet<T, TKey>, foreignSet: dataset.DataSet<TForeign, TForeignKey>, relation: mapping.Relation, parent: any): RelationCollectionView<T, TKey, TForeign, TForeignKey>;
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
export interface ForeignView<T, TForeign> extends RelationForeignView<T, any, TForeign, any> {
}
export interface Foreign<TForeign> extends ForeignView<any, TForeign> {
}
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
export function foreign<T, TKey, TForeign, TForeignKey>(localSet: dataset.DataSet<T, TKey>, foreignSet: dataset.DataSet<TForeign, TForeignKey>, relation: mapping.Relation, parent: any): RelationForeignView<T, TKey, TForeign, TForeignKey>;
export interface RelationRemoteView<T, TKey, TForeign, TForeignKey> extends KnockoutObservableArray<TForeign>, RelationRemoteViewFunctions<T, TKey, TForeign, TForeignKey> {
    propertyName: string;
    parent: any;
    localSet: dataset.DataSet<T, TKey>;
    foreignSet: dataset.DataSet<TForeign, TForeignKey>;
    query: _query.ODataQuery;
}
export interface RemoteView<T, TForeign> extends RelationRemoteView<T, any, TForeign, any> {
}
export interface Remote<TForeign> extends RemoteView<any, TForeign> {
}
export interface RelationRemoteViewFunctions<T, TKey, TForeign, TForeignKey> {
    /** Refresh foreign entities from the server */
    refresh(): Promise<TForeign[]>;
    /** Add entity to view, if buffer is false, entity will be instantly post on the server */
    add(entity: TForeign): Promise<TForeign>;
    /** Update entity on view, if buffer is false, entity will be instantly put on the server */
    update(entity: TForeign): Promise<any>;
}
/** Create an observable relation to many entities */
export function remote<T, TKey, TForeign, TForeignKey>(localSet: dataset.DataSet<T, TKey>, foreignSet: dataset.DataSet<TForeign, TForeignKey>, relation: mapping.Relation, parent: any): RelationRemoteView<T, TKey, TForeign, TForeignKey>;
export var remoteViewFunctions: RelationRemoteViewFunctions<any, any, any, any>;
}

declare module "korm/stores" {
import context = require("korm/context");
import query = require("korm/query");
export interface IDataStoreConstructor {
    new (context: context.DataContext): IDataStore;
}
export interface IDataStore {
    context: context.DataContext;
    reset(): Promise<void>;
    getAll(setName: string, query?: query.ODataQuery): Promise<any[]>;
    getOne(setName: string, key: any, query?: query.ODataQuery): Promise<any>;
    add(setName: string, item: any): Promise<void>;
    update(setName: string, item: any): Promise<void>;
    remove(setName: string, key: any): Promise<void>;
    addRange(setName: string, items: any[]): Promise<void>;
    updateRange(setName: string, items: any[]): Promise<void>;
    removeRange(setName: string, keys: any[]): Promise<void>;
}
export function getDefaultStore(context: context.DataContext): IDataStore;
export function getStore(name: string, context: context.DataContext): Promise<IDataStore>;
}
