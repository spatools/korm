/// <reference path="../../../typings/knockout/knockout.d.ts" />
/// <reference path="../bower_components/promizr/promise.d.ts" />

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
    getMappingConfiguration(type: string): mapping.Configuration;
    addMappingConfiguration(config: mapping.Configuration): DataContext;
    getSets(): dataset.DataSet<any, any>[];
    getSet<T, TKey>(name: string): dataset.DataSet<T, TKey>;
    addSet<T, TKey>(name: string, keyProperty: string, defaultType: string): dataset.DataSet<T, TKey>;
    reset(): void;
    resetStore(): Promise<void>;
    setRefreshMode(mode: string): void;
    setLocalStore(storeType: string): Promise<any>;
    setLocalStore(storeType: stores.IDataStore): Promise<any>;
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
export interface DataSet<T, TKey> extends KnockoutUnderscoreArrayFunctions<T>, KnockoutUnderscoreObjectsFunctions<T>, KnockoutObservable<T[]>, DataSetFunctions<T, TKey> {
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
    setLocalStore(store: stores.IDataStore): void;
    setAdapter(adapter: adapters.IAdapter): void;
    reset(): void;
    createView(): dataview.DataView<T, TKey>;
    createView(query: query.ODataQuery): dataview.DataView<T, TKey>;
    refresh(): Promise<T[]>;
    refresh(query: query.ODataQuery): Promise<T[]>;
    refresh(mode: string): Promise<T[]>;
    refresh(mode: string, query: query.ODataQuery): Promise<T[]>;
    query(): Promise<T[]>;
    query(query: query.ODataQuery): Promise<T[]>;
    query(mode: string): Promise<T[]>;
    query(mode: string, query: query.ODataQuery): Promise<T[]>;
    load(key: TKey): Promise<T>;
    load(key: TKey, query: query.ODataQuery): Promise<T>;
    load(key: TKey, mode: string): Promise<T>;
    load(key: TKey, mode: string, query: query.ODataQuery): Promise<T>;
    sync(): Promise<void>;
    sync(query: query.ODataQuery): Promise<void>;
    refreshRelation<U>(entity: T, propertyName: string): Promise<U>;
    refreshRelation<U>(entity: T, propertyName: string, query: query.ODataQuery): Promise<U>;
    refreshRelation<U>(entity: T, propertyName: string, mode: string): Promise<U>;
    refreshRelation<U>(entity: T, propertyName: string, mode: string, query: query.ODataQuery): Promise<U>;
    refreshRelation<U>(entity: T, propertyName: string, mode: string, query: query.ODataQuery, nostore: boolean): Promise<U>;
    executeAction(action: string, params?: any, entity?: T): Promise<any>;
    getKey(entity: T): TKey;
    findByKey(key: TKey): T;
    add(entity: T): Promise<T>;
    addRange(entities: T[]): Promise<T[]>;
    update(entity: T): Promise<T>;
    updateRange(entities: T[]): Promise<T[]>;
    remove(entity: T): Promise<T>;
    removeRange(entities: T[]): Promise<T[]>;
    resetEntity(entity: T): Promise<any>;
    disposeEntity(entity: T): void;
    isAttached(entity: T): boolean;
    attach(entity: T): Promise<T>;
    attach(entity: T, store: boolean): Promise<T>;
    attachRange(entities: T[]): Promise<T[]>;
    attachRange(entities: T[], store: boolean): Promise<T[]>;
    detach(entity: T): void;
    detachRange(entityKeys: TKey[]): void;
    attachOrUpdate(data: any): Promise<T>;
    attachOrUpdate(data: any, commit: boolean): Promise<T>;
    attachOrUpdate(data: any, commit: boolean, expand: boolean): Promise<T>;
    attachOrUpdate(data: any, commit: boolean, expand: boolean, store: boolean): Promise<T>;
    attachOrUpdateRange(data: any): Promise<T>;
    attachOrUpdateRange(data: any, commit: boolean): Promise<T>;
    attachOrUpdateRange(data: any, commit: boolean, expand: boolean): Promise<T>;
    attachOrUpdateRange(data: any, commit: boolean, expand: boolean, store: boolean): Promise<T>;
    store(entity: any): Promise<any>;
    storeRange(entities: any[]): Promise<any[]>;
    toJS(entity: T): any;
    toJS(entity: T, keepstate: boolean): any;
    toJSRange(entity: T[]): any[];
    toJSRange(entity: T[], keepstate: boolean): any[];
    toJSON(entity: T): string;
    toJSON(entity: T, keepstate: boolean): string;
    fromJSRange(data: any[]): Promise<T[]>;
    fromJSRange(data: any[], state: mapping.entityStates): Promise<T[]>;
    fromJSRange(data: any[], state: mapping.entityStates, expand: boolean): Promise<T[]>;
    fromJSRange(data: any[], state: mapping.entityStates, expand: boolean, store: boolean): Promise<T[]>;
    fromJS(data: any): Promise<T>;
    fromJS(data: any, state: mapping.entityStates): Promise<T>;
    fromJS(data: any, state: mapping.entityStates, expand: boolean): Promise<T>;
    fromJS(data: any, state: mapping.entityStates, expand: boolean, store: boolean): Promise<T>;
    fromJSON(json: string): T;
    fromJSON(json: string, state: mapping.entityStates): Promise<T>;
    fromJSON(json: string, state: mapping.entityStates, expand: boolean): Promise<T>;
    fromJSON(json: string, state: mapping.entityStates, expand: boolean, store: boolean): Promise<T>;
    saveEntity(entity: T): Promise<T>;
    getChanges(): DataSetChanges<T>;
    getChanges(entities: T[]): DataSetChanges<T>;
    saveChanges(): Promise<any>;
    saveChanges(entities: T[]): Promise<any>;
    _remoteCreate(entity: T): Promise<T>;
    _remoteUpdate(entity: T): Promise<T>;
    _remoteRemove(entity: T): Promise<T>;
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
    refresh(mode?: string): Promise<any>;
    load(key: TKey, mode?: string): Promise<T>;
    sync(): Promise<void>;
    add(entity: T): Promise<any>;
    update(entity: T): void;
    remove(entity: T): void;
    findByKey(key: TKey): any;
    saveEntity(entity: T): Promise<T>;
    resetEntity(entity: T): void;
    getChanges(): any;
    saveChanges(): Promise<any>;
}
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
export enum relationTypes {
    many = 0,
    one = 1,
    remote = 2,
}
export enum entityStates {
    unchanged = 0,
    added = 1,
    modified = 2,
    removed = 3,
}
export var typeProperties: string[];
export var defaultRules: KnockoutMappingOptions;
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
export class Configurations {
    private configurations;
    getConfiguration(type: string): Configuration;
    addConfiguration(configuration: Configuration): Configurations;
    addConfigurations(configs: Configuration[]): Configurations;
    removeConfiguration(type: string): Configurations;
}
export function getMappingConfiguration<T, TKey>(entity: {}, dataSet: dataset.DataSet<T, TKey>): Configuration;
export function addMappingProperties<T, TKey>(model: any, dataSet: dataset.DataSet<T, TKey>, config?: Configuration, initialState?: entityStates, data?: any): any;
export function refreshRelations<T, TKey>(entity: any, dataSet: dataset.DataSet<T, TKey>): Promise<T>;
export function duplicateEntity<T, TKey>(entity: any, dataSet: dataset.DataSet<T, TKey>): T;
export function updateEntity<T, TKey>(entity: any, data: any, commit: boolean, expand: boolean, store: boolean, dataSet: dataset.DataSet<T, TKey>): Promise<T>;
export function updateEntities<T, TKey>(entities: any[], datas: any[], commit: boolean, expand: boolean, store: boolean, dataSet: dataset.DataSet<T, TKey>): Promise<T[]>;
export function resetEntity<T, TKey>(entity: any, dataSet: dataset.DataSet<T, TKey>): T;
export function disposeEntity<T, TKey>(entity: any, dataSet: dataset.DataSet<T, TKey>): void;
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
    toQueryString(): string;
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
    toQueryString(): string;
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
    orderby(field: any, ascending?: any): ODataQuery;
    expand(...fields: string[]): ODataQuery;
    select(...fields: string[]): ODataQuery;
    and(): ODataQuery;
    or(): ODataQuery;
    toQueryString(): string;
    toLocalFilter(): (item) => boolean;
    toLocalSorting(): (item1, item2) => number;
    applyFilters<T>(array: T[]): T[];
    applySorting<T>(array: T[]): T[];
    applyPaging<T>(array: T[], correctPageNum?: boolean): T[];
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
    refresh(mode?: string): Promise<TForeign[]>;
    sync(): Promise<void>;
    update(): void;
    change(newEntity: TForeign, deleteOld?: boolean): Promise<any>;
    save(): Promise<TForeign>;
}
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
    refresh(): Promise<TForeign[]>;
    add(entity: TForeign): Promise<TForeign>;
    update(entity: TForeign): Promise<any>;
}
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
