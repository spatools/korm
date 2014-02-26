/// <reference path="../../_definitions.d.ts" />

import _ = require("underscore");
import promiseExt = require("promise/extensions");

import stores = require("../stores");
import context = require("../context");
import dataset = require("../dataset");
import _query = require("../query");
import mapping = require("../mapping");
import utils = require("koutils/utils");

class MemoryStore implements stores.IDataStore {
    public memory = {};
    public context: context.DataContext;

    constructor(context: context.DataContext) {
        this.context = context;
    }

    //#region Public Methods

    reset(): Promise<void> {
        return promiseExt.timeout().then(() => {
            this.memory = {};
        });
    }

    getAll(setName: string, query?: _query.ODataQuery): Promise<any[]> {
        var self = this;
        return promiseExt.timeout().then<any[]>(function (): any {
            var result: any[] = _.values(self.getMemorySet(setName));

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
    }
    getOne(setName: string, key: any, query?: _query.ODataQuery): Promise<any> {
        return promiseExt.timeout().then(() => {
            var table = this.getMemorySet(setName),
                item = table[key];

            if (item && query) {
                if (query.selects.size() > 0) {
                    item = this.applySelects(item, query.selects());
                }

                if (query.expands.size() > 0) {
                    return this.applyExpands(setName, query.expands(), item);
                }
            }

            return item;
        });
    }

    add(setName: string, item: any): Promise<void> {
        return this.update(setName, item);
    }
    update(setName: string, item: any): Promise<void> {
        return promiseExt.timeout().then(() => {
            var table = this.getMemorySet(setName),
                key = this.getKey(setName, item);

            table[key] = this.toJS(setName, item);
        });
    }
    remove(setName: string, key: any): Promise<void> {
        return promiseExt.timeout().then(() => {
            var table = this.getMemorySet(setName);
            delete table[key];
        });
    }

    addRange(setName: string, items: any[]): Promise<void> {
        return this.updateRange(setName, items);
    }
    updateRange(setName: string, items: any[]): Promise<void> {
        return promiseExt.timeout().then(() => {
            var table = this.getMemorySet(setName), key;

            _.each(items, item => {
                key = this.getKey(setName, item);
                table[key] = this.toJS(setName, item);
            });
        });
    }
    removeRange(setName: string, keys: any[]): Promise<void> {
        return promiseExt.timeout().then(() => {
            var table = this.getMemorySet(setName);
            _.each(keys, key => { delete table[key]; });
        });
    }

    //#endregion

    //#region Private Methods

    /* return set key or item key if specified */
    private getKey(setName: string, item?: any): any {
        var dataset = this.context.getSet(setName);
        return item ? dataset.getKey(item) : dataset.key;
    }
    private getMemorySet(setName: string): any {
        if (!this.memory[setName])
            this.memory[setName] = {};

        return this.memory[setName];
    }
    private toJS(setName: string, entity: any): any {
        var dataset = this.context.getSet(setName);
        return dataset.toJS(entity, true);
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
                    return promiseExt.timeout().then(() => {
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

export = MemoryStore;
