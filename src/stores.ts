/// <reference path="../_definitions.d.ts" />

import ko = require("knockout");
import _ = require("underscore");
import utils = require("koutils/utils");
import promiseExt = require("promise/extensions");

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

export function getStore(name: string, context: context.DataContext): Promise<IDataStore> {
    return Promise.cast<IDataStoreConstructor>(stores[name] || promiseExt.module("korm/stores/" + name)).then<IDataStore>(Store => {
        stores[name] = Store;
        return new Store(context);
    });
}
