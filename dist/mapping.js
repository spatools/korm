define(["require", "exports", "knockout", "knockout.mapping", "underscore", "promise", "./relations", "./query", "koutils/changetracker", "knockout.mapping"], function (require, exports, ko, koMapping, _, Promise, relations, query, changeTracker) {
    //#region Enumerations / Defaults
    /** Enumeration representing relations types */
    (function (relationTypes) {
        relationTypes[relationTypes["many"] = 0] = "many";
        relationTypes[relationTypes["one"] = 1] = "one";
        relationTypes[relationTypes["remote"] = 2] = "remote";
    })(exports.relationTypes || (exports.relationTypes = {}));
    var relationTypes = exports.relationTypes;
    /** Enumeration for differents entity states */
    (function (entityStates) {
        entityStates[entityStates["unchanged"] = 0] = "unchanged";
        entityStates[entityStates["added"] = 1] = "added";
        entityStates[entityStates["modified"] = 2] = "modified";
        entityStates[entityStates["removed"] = 3] = "removed";
    })(exports.entityStates || (exports.entityStates = {}));
    var entityStates = exports.entityStates;
    /** Default types properties (internal usage) */
    exports.typeProperties = [
        "odata.type",
        "$type",
        "_type"
    ];
    /** Default mapping rules (internal usage) */
    exports.defaultRules = {
        copy: [],
        ignore: ["_lastData", "EntityState", "IsSubmitting", "HasChanges", "ChangeTracker", "IsRemoved", "isValid", "errors", "hasChanges", "subscription", "__ko_mapping__"]
    };
    //#endregion
    //#region Models
    /** Class representing a relation for an entity set */
    var Relation = (function () {
        function Relation(propertyName, type, controllerName, foreignKey, ensureRemote) {
            this.propertyName = propertyName;
            this.type = type;
            this.controllerName = controllerName;
            this.foreignKey = foreignKey;
            this.ensureRemote = ensureRemote || false;
        }
        Relation.prototype.toQuery = function (item, localSet, foreignSet) {
            var localProp, foreignProp;
            if (this.type === 1 /* one */) {
                localProp = this.foreignKey;
                foreignProp = foreignSet.key;
            }
            else if (this.type === 0 /* many */) {
                localProp = localSet.key;
                foreignProp = this.foreignKey;
            }
            return new query.ODataQuery().where(foreignProp, query.operator.equal, item[localProp]);
        };
        return Relation;
    })();
    exports.Relation = Relation;
    /** Class representing a mapping configuration for serialization / deserialization scenarios */
    var Configuration = (function () {
        function Configuration(type, model, relations, rules, actions, baseType) {
            if (_.isString(type)) {
                this.type = type;
                this.model = model;
                this.relations = relations || [];
                this.rules = rules || {};
                this.actions = actions || [];
                this.baseType = baseType;
            }
            else {
                this.type = type.type;
                this.model = type.model;
                this.relations = type.relations || [];
                this.rules = type.rules || {};
                this.actions = type.actions || [];
                this.baseType = type.baseType;
            }
        }
        return Configuration;
    })();
    exports.Configuration = Configuration;
    /** Abstract mapping configurations for dataContext */
    var Configurations = (function () {
        function Configurations() {
            this.configurations = {};
        }
        /** Get configuration by type */
        Configurations.prototype.getConfiguration = function (type) {
            return this.configurations[type];
        };
        /** Add a mapping configuration */
        Configurations.prototype.addConfiguration = function (configuration) {
            this.configurations[configuration.type] = ensureConfiguration(this, configuration);
            return this;
        };
        /** Add an array of mapping configurations */
        Configurations.prototype.addConfigurations = function (configs) {
            _.each(configs, this.addConfiguration, this);
            return this;
        };
        /** Remove a configuration by type */
        Configurations.prototype.removeConfiguration = function (type) {
            if (this.configurations[type])
                delete this.configurations[type];
            return this;
        };
        return Configurations;
    })();
    exports.Configurations = Configurations;
    //#endregion
    //#region Private Methods
    function getEntityByName(name) {
        var namespaces = name.split("."), ctor = namespaces.pop(), context = window;
        for (var i = 0; i < namespaces.length; i++)
            context = context[namespaces[i]];
        return new context[ctor]();
    }
    function constructEntity(type) {
        if (!type) {
            return {};
        }
        else if (_.isFunction(type)) {
            return new type();
        }
        else {
            return getEntityByName(type.toString());
        }
    }
    function getEntityType(entity) {
        if (!entity) {
            return;
        }
        var i = 0, len = exports.typeProperties.length, typeProp;
        for (; i < len; i++) {
            typeProp = exports.typeProperties[i];
            if (typeProp in entity)
                return entity[typeProp];
        }
    }
    function ensureConfiguration(configs, config) {
        if (!(config instanceof Configuration)) {
            config = new Configuration(config);
        }
        if (config.baseType) {
            var baseConfig = configs.getConfiguration(config.baseType);
            if (!baseConfig) {
                throw new Error("No configuration registered for type: " + config.baseType);
            }
            if (baseConfig.relations.length > 0) {
                if (config.relations.length > 0)
                    config.relations = _.union(config.relations, baseConfig.relations);
                else
                    config.relations = baseConfig.relations;
            }
            if (baseConfig.actions.length > 0) {
                if (config.actions.length > 0)
                    config.actions = _.union(config.actions, baseConfig.actions);
                else
                    config.actions = baseConfig.actions;
            }
            if (baseConfig.rules.ignore) {
                if (config.rules.ignore)
                    config.rules.ignore = _.union(config.rules.ignore, baseConfig.rules.ignore);
                else
                    config.rules.ignore = baseConfig.rules.ignore;
            }
            if (baseConfig.rules.copy) {
                if (config.rules.copy)
                    config.rules.copy = _.union(config.rules.copy, baseConfig.rules.copy);
                else
                    config.rules.copy = baseConfig.rules.copy;
            }
        }
        return config;
    }
    function ensureRules(config, entity, keepState) {
        var result = _.clone(config._rules);
        if (!result) {
            result = _.clone(config.rules);
            var relations = _.map(config.relations, function (r) { return r.propertyName; });
            result.copy = _.union(config.rules.copy || [], exports.defaultRules.copy, exports.typeProperties);
            result.ignore = _.union(config.rules.ignore || [], relations, config.actions, exports.defaultRules.ignore);
            config._rules = result;
        }
        if (keepState) {
            result.ignore = _.without(result.ignore, "EntityState");
        }
        if (entity) {
            entity.__ko_mapping__ = result;
        }
        return result;
    }
    function updateRelations(model, data, config, commit, store, dataSet) {
        var foreignSet, relValue, promises = _.filterMap(config.relations, function (relation) {
            foreignSet = dataSet.context.getSet(relation.controllerName);
            relValue = data && data[relation.propertyName];
            if (relValue) {
                switch (relation.type) {
                    case 1 /* one */:
                        return foreignSet.attachOrUpdate(relValue, commit, false, store);
                    case 0 /* many */:
                        return foreignSet.attachOrUpdateRange(relValue, commit, false, store);
                    case 2 /* remote */:
                        return foreignSet.attachOrUpdateRange(relValue, commit, false, store).then(model[relation.propertyName]);
                }
            }
        });
        return Promise.all(promises);
    }
    function updateRelationsRange(models, datas, config, commit, store, dataSet) {
        var foreignSet, data, toAttach, remoteAttach, remoteAttachTo, relValue, relProp, promise, promises = _.filterMap(config.relations, function (relation) {
            toAttach = [];
            remoteAttach = [];
            remoteAttachTo = [];
            foreignSet = dataSet.context.getSet(relation.controllerName);
            _.each(models, function (model, i) {
                data = datas[i];
                relValue = data[relation.propertyName];
                if (relValue) {
                    switch (relation.type) {
                        case 1 /* one */:
                            toAttach.push(relValue);
                            break;
                        case 0 /* many */:
                            toAttach = _.union(toAttach, relValue);
                            break;
                        case 2 /* remote */:
                            remoteAttach.push(relValue);
                            remoteAttachTo.push(model[relation.propertyName]);
                            break;
                    }
                }
            });
            if (remoteAttach.length > 0) {
                _.each(remoteAttach, function (entities, i) {
                    relProp = remoteAttachTo[i];
                    promise = foreignSet.attachOrUpdateRange(entities, commit, false, store).then(relProp);
                });
            }
            if (toAttach.length > 0) {
                promise = foreignSet.attachOrUpdateRange(toAttach, commit, false, store);
            }
            return promise;
        });
        return Promise.all(promises);
    }
    //#endregion
    //#region Public Methods
    function getMappingConfiguration(entity, dataSet) {
        var type = getEntityType(entity) || dataSet.defaultType;
        return (type && dataSet.context.getMappingConfiguration(type)) || new Configuration(type);
    }
    exports.getMappingConfiguration = getMappingConfiguration;
    /** Add mapping properties to an entity */
    function addMappingProperties(model, dataSet, config, initialState, data) {
        if (initialState === void 0) { initialState = 0 /* unchanged */; }
        if (data === void 0) { data = null; }
        if (model.EntityState) {
            throw new Error("Model already has mapping properties");
        }
        if (!config)
            config = getMappingConfiguration(model, dataSet);
        var isModified = initialState !== 0 /* unchanged */, foreignSet;
        _.each(config.actions, function (action) {
            model[action] = function (params) { return dataSet.executeAction(action, params, model); };
        });
        _.each(config.relations, function (relation) {
            foreignSet = dataSet.context.getSet(relation.controllerName);
            model[relation.propertyName] = relations.create(dataSet, foreignSet, relation, model);
        });
        model._lastData = data || {};
        model.EntityState = ko.observable(initialState);
        model.IsSubmitting = ko.observable(false);
        model.ChangeTracker = new changeTracker(model, isModified, koMapping.toJSON, ensureRules(config, model, false));
        model.HasChanges = ko.computed(function () {
            var state = model.EntityState();
            if (model.ChangeTracker.hasChanges()) {
                if (state === 0 /* unchanged */ && !model.IsSubmitting())
                    model.EntityState(2 /* modified */);
                return true;
            }
            if (state === 2 /* modified */) {
                model.EntityState(0 /* unchanged */);
            }
            return false;
        }).extend({ cnotify: "primitive" });
        model.IsRemoved = ko.computed(function () { return model.EntityState() === 3 /* removed */; }).extend({ cnotify: "primitive" });
        return model;
    }
    exports.addMappingProperties = addMappingProperties;
    /** Refresh all entity relations */
    function refreshRelations(entity, dataSet) {
        var config = getMappingConfiguration(entity, dataSet), promises, prop;
        if (config.relations) {
            promises = _.filterMap(config.relations, function (relation) {
                prop = entity[relation.propertyName];
                return !!prop && prop.refresh();
            });
        }
        return Promise.all(promises).then(function () { return entity; });
    }
    exports.refreshRelations = refreshRelations;
    /** Duplicate specified entity and return copy */
    function duplicateEntity(entity, dataSet) {
        var config = getMappingConfiguration(entity, dataSet), mappingRules = ensureRules(config, entity);
        var copy = koMapping.toJS(entity, mappingRules);
        copy[dataSet.key] = null;
        return koMapping.fromJS(copy, mappingRules);
    }
    exports.duplicateEntity = duplicateEntity;
    /** Update specified entity with given data */
    function updateEntity(entity, data, commit, expand, store, dataSet) {
        if (!data) {
            if (!commit) {
                entity.EntityState(0 /* unchanged */);
                entity.ChangeTracker.reset();
            }
            return Promise.resolve(entity);
        }
        var config = getMappingConfiguration(entity, dataSet), mappingRules = ensureRules(config, entity);
        koMapping.fromJS(data, mappingRules, entity);
        if (!commit) {
            entity.EntityState(0 /* unchanged */);
            entity.ChangeTracker.reset();
        }
        if (expand) {
            return updateRelations(entity, data, config, commit, store, dataSet).then(function () { return entity; });
        }
        return Promise.resolve(entity);
    }
    exports.updateEntity = updateEntity;
    /** Update specified set of entities with given data array */
    function updateEntities(entities, datas, commit, expand, store, dataSet) {
        if (datas.length === 0) {
            if (!commit) {
                _.each(entities, function (entity) {
                    entity.EntityState(0 /* unchanged */);
                    entity.ChangeTracker.reset();
                });
            }
            return Promise.resolve(entities);
        }
        var config, data, mappingRules;
        _.each(entities, function (entity, i) {
            data = datas[i];
            config = getMappingConfiguration(entity, dataSet);
            mappingRules = ensureRules(config, entity);
            koMapping.fromJS(data, mappingRules, entity);
            if (!commit) {
                entity.EntityState(0 /* unchanged */);
                entity.ChangeTracker.reset();
            }
        });
        if (expand) {
            return updateRelationsRange(entities, datas, config, commit, store, dataSet).then(function () { return entities; });
        }
        return Promise.resolve(entities);
    }
    exports.updateEntities = updateEntities;
    /** Reset specified entity with last remote data */
    function resetEntity(entity, dataSet) {
        var config = getMappingConfiguration(entity, dataSet), mappingRules = ensureRules(config, entity);
        koMapping.fromJS(entity._lastData, mappingRules, entity);
        entity.EntityState(0 /* unchanged */);
        entity.ChangeTracker.reset();
        return entity;
    }
    exports.resetEntity = resetEntity;
    //#endregion
    //#region Mapping Methods
    function mapEntitiesFromJS(datas, initialState, expand, store, dataSet) {
        if (datas.length === 0) {
            return Promise.resolve(datas);
        }
        var config, model, result = _.map(datas, function (data) {
            config = getMappingConfiguration(data, dataSet);
            model = config.model ? constructEntity(config.model) : {};
            if (!_.isUndefined(data.EntityState) && initialState === 0 /* unchanged */) {
                initialState = data.EntityState;
                delete data.EntityState;
            }
            koMapping.fromJS(data, config.rules, model);
            addMappingProperties(model, dataSet, config, initialState, data);
            return model;
        });
        if (expand) {
            return updateRelationsRange(result, datas, config, initialState !== 0 /* unchanged */, store, dataSet).then(function () { return result; });
        }
        return Promise.resolve(result);
    }
    exports.mapEntitiesFromJS = mapEntitiesFromJS;
    function mapEntityFromJS(data, initialState, expand, store, dataSet) {
        var config = getMappingConfiguration(data, dataSet), model = config.model ? constructEntity(config.model) : {};
        if (!_.isUndefined(data.EntityState) && initialState === 0 /* unchanged */) {
            initialState = data.EntityState;
            delete data.EntityState;
        }
        koMapping.fromJS(data, config.rules, model);
        addMappingProperties(model, dataSet, config, initialState, data);
        if (expand) {
            return updateRelations(model, data, config, initialState !== 0 /* unchanged */, store, dataSet).then(function () { return model; });
        }
        return Promise.resolve(model);
    }
    exports.mapEntityFromJS = mapEntityFromJS;
    function mapEntityToJS(entity, keepState, dataSet) {
        var config = getMappingConfiguration(entity, dataSet), mappingRules = ensureRules(config, entity, keepState);
        var data = koMapping.toJS(entity, mappingRules);
        return data;
    }
    exports.mapEntityToJS = mapEntityToJS;
    function mapEntitiesToJS(entities, keepState, dataSet) {
        if (entities.length > 0) {
            var defaultRules = getMappingConfiguration(null, dataSet).rules;
            _.each(entities, function (entity) {
                var config = getMappingConfiguration(entity, dataSet);
                ensureRules(config, entity, keepState);
            });
            return koMapping.toJS(entities, defaultRules);
        }
        return entities;
    }
    exports.mapEntitiesToJS = mapEntitiesToJS;
    function mapEntityFromJSON(json, initialState, expand, store, dataSet) {
        var obj = ko.utils.parseJson(json);
        return mapEntityFromJS(obj, initialState, expand, store, dataSet);
    }
    exports.mapEntityFromJSON = mapEntityFromJSON;
    function mapEntityToJSON(entity, keepstate, dataSet) {
        var obj = mapEntityToJS(entity, keepstate, dataSet);
        return ko.utils.stringifyJson.call(undefined, obj);
    }
    exports.mapEntityToJSON = mapEntityToJSON;
});
