/// <reference path="../_definitions.d.ts" />

import _ = require("underscore");
import Promise = require("promise");

import mapping = require("./mapping");
import stores = require("./stores");
import adapters = require("./adapters");
import dataset = require("./dataset");

export class DataContext {
    private sets: {[key: string]: dataset.DataSet<any, any>} = {};

    public store: stores.IDataStore;
    public adapter: adapters.IAdapter = adapters.getDefaultAdapter();

    public buffer: boolean = false;
    public autoLazyLoading: boolean = false;
    public mapping = new mapping.Configurations();
    public refreshMode = "remote";

    constructor() {
        this.store = stores.getDefaultStore(this);
    }

    /** Get Mapping Configuration for specified type */
    public getMappingConfiguration(type: string): mapping.Configuration {
        return this.mapping.getConfiguration(type);
    }
    /** Add a mapping configuration to this data context */
    public addMappingConfiguration(config: mapping.Configuration): DataContext {
        this.mapping.addConfiguration(config);
        return this;
    }

    /** Get all sets defined in current context */
    public getSets(): dataset.DataSet<any, any>[] {
        return _.values(this.sets);
    }
    /** Get set from name */
    public getSet<T, TKey>(name: string): dataset.DataSet<T, TKey> {
        return this.sets[name];
    }
    /** Add a new Data Set to current Data Context */
    public addSet<T, TKey>(name: string, keyProperty: string, defaultType: string): dataset.DataSet<T, TKey> {
        if (!this.sets[name])
            this[name] = this.sets[name] = dataset.create<T, TKey>(name, keyProperty, defaultType, this);

        return this.sets[name];
    }

    public reset(): void {
        _.each(this.sets, dataset => { dataset.reset(); });
    }
    public resetStore(): Promise<void> {
        return this.store.reset();
    }

    /** Change refresh mode for all sets */
    public setRefreshMode(mode: string): void {
        this.refreshMode = mode;
        _.each(this.sets, dataset => { dataset.refreshMode = mode; });
    }

    /** change local store type */
    public setLocalStore(storeType: string): Promise<any>;
    public setLocalStore(storeType: stores.IDataStore): Promise<any>;
    public setLocalStore(storeType: any): Promise<any> {
        var op = _.isString(storeType) ? stores.getStore(storeType, this) : storeType.init().then(() => storeType);

        return Promise.resolve<stores.IDataStore>(op).then(store => {
            this.store = store;
            _.each(this.sets, dataset => dataset.setLocalStore(store));
        });
    }

    /** change remote adapter type */
    public setAdapter(adapterType: string): Promise<any>;
    public setAdapter(adapterType: adapters.IAdapter): Promise<any>;
    public setAdapter(adapterType: any): Promise<any> {
        var op = _.isString(adapterType) ? adapters.getAdapter(adapterType) : adapterType;

        return Promise.resolve<adapters.IAdapter>(op).then(adapter => {
            this.adapter = adapter;
            _.each(this.sets, set => set.setAdapter(adapter));
        });
    }
}

export function create(storeType: string = "memory", adapterType: string = "odata", buffer: boolean = false, autoLazyLoading: boolean = false): Promise<DataContext> {
    var context = new DataContext();

    context.buffer = buffer;
    context.autoLazyLoading = autoLazyLoading;

    return Promise.all([context.setLocalStore(storeType), context.setAdapter(adapterType)])
        .then(() => context);
}
