/// <reference path="../_definitions.d.ts" />

import utils = require("koutils/utils");
import query = require("./query");
import ODataAdapter = require("./adapters/odata");

export interface IAdapterConstructor {
    new (): IAdapter;
}

export interface IAdapter {
    getAll(controller: string, query?: query.ODataQuery): Promise<IAdapterResult>;
    getOne(controler: string, id: any, query?: query.ODataQuery): Promise<any>;
    getRelation? (controller: string, relationName: string, id: any, query?: query.ODataQuery): Promise<IAdapterResult>;

    post(controller: string, data: any): Promise<any>;
    put(controller: string, id: any, data: any): Promise<any>;
    remove(controller: string, id: any): Promise<any>;

    batch? (controller: string, changes: any): Promise<any>;

    action? (controller: string, action: string, parameters: any, id?: any): Promise<any>;
}

export interface IAdapterResult {
    data: any;
    count: number;
}

var adapters: { [key: string]: IAdapterConstructor } = {
    odata: ODataAdapter
};

export function getDefaultAdapter(): IAdapter {
    return new ODataAdapter();
}

function loadAdapter(name: string): Promise<IAdapterConstructor> {
    if (adapters[name]) {
        return Promise.resolve(adapters[name]);
    }

    return new Promise((resolve, reject) => {
        require(["korm/adapters/" + name], result => {
            var Adapter = result[0];
            adapters[name] = Adapter;
            resolve(Adapter);
        }, reject);
    });
}

export function getAdapter(name: string): Promise<IAdapter> {
    return loadAdapter(name).then(Adapter => new Adapter());
}
