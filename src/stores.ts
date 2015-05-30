/// <reference path="../_definitions.d.ts" />

import ko = require("knockout");
import _ = require("underscore");
import utils = require("koutils/utils");
import promizr = require("promizr");

import context = require("./context");
import query = require("./query");
import MemoryStore = require("./stores/memory");

var stores: { [key: string]: IDataStoreConstructor } = {
    "memory": MemoryStore
};

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

export function getDefaultStore(context: context.DataContext): IDataStore {
    return new MemoryStore(context);
}

function loadStore(name: string): Promise<IDataStoreConstructor> {
    if (stores[name]) {
        return Promise.resolve(stores[name]);
    }

    return promizr.module<IDataStoreConstructor>(`korm/stores/${name}`).then(Store => {
        stores[name] = Store;
        return Store;
    });
}

export function getStore(name: string, context: context.DataContext): Promise<IDataStore> {
    return loadStore(name).then(Store => new Store(context));
}
