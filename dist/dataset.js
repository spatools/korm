/// <reference path="../_definitions.d.ts" />
/// <amd-dependency path="koutils/extenders" />
define(["require", "exports", "knockout", "underscore", "./mapping", "./dataview", "./guid", "kounderscore", "koutils/utils", "koutils/extenders"], function (require, exports, ko, _, mapping, dataview, guid, ko_, utils) {
    //#endregion
    //#region Private Methods
    function _createOnStateChanged(dataset, entity) {
        return function (newState) {
            if (newState === mapping.entityStates.modified) {
                setTimeout(function () {
                    dataset.store(entity);
                    dataset._remoteUpdate(entity);
                }, 1);
            }
            else if (newState === mapping.entityStates.removed) {
                setTimeout(function () {
                    //hack : updates before removes
                    dataset._remoteRemove(entity);
                }, 100);
            }
        };
    }
    function _initAttachedEntity(dataset, entity) {
        if (dataset.context.buffer === false) {
            entity.EntityState.subscribe(_createOnStateChanged(dataset, entity));
        }
        if (entity.EntityState() === mapping.entityStates.added) {
            if (dataset.context.buffer === false)
                return dataset._remoteCreate(entity);
        }
        else if (dataset.context.autoLazyLoading === true) {
            return mapping.refreshRelations(entity, dataset).then(function () { return entity; });
        }
        return entity;
    }
    function _updateDataSet(dataset, result, query) {
        var rmDfd, isArray = _.isArray(result.data);
        if (isArray && !query || query.pageSize() === 0) {
            var current = dataset.toArray();
            if (query && query.filters.size() > 0)
                current = query.applyFilters(current);
            var report = utils.arrayCompare(_.map(current, dataset.getKey, dataset), _.map(result.data, dataset.getKey, dataset));
            if (report.removed.length > 0) {
                rmDfd = dataset.localstore.removeRange(dataset.setName, report.removed)
                    .then(function () { return dataset.detachRange(report.removed); });
            }
        }
        return Promise.resolve(rmDfd).then(function () {
            if (result.count >= 0 && (!query || query.filters.size() === 0))
                dataset.remoteCount(result.count);
            return isArray ?
                dataset.attachOrUpdateRange(result.data, false, !!query && query.expands.size() > 0) :
                dataset.attachOrUpdate(result.data, false, !!query && query.expands.size() > 0);
        });
    }
    //#endregion
    //#region Model
    function create(setName, keyPropertyName, defaultType, dataContext) {
        var result = ko.observable({}).extend({ notify: "reference" });
        result.setName = setName;
        result.key = keyPropertyName;
        result.defaultType = defaultType;
        result.context = dataContext;
        result.adapter = dataContext.adapter;
        result.localstore = dataContext.store;
        result.refreshMode = dataContext.refreshMode;
        _.extend(result, dataSetFunctions);
        result.localCount = result._size();
        result.remoteCount = ko.observable(-1);
        result.count = ko.pureComputed(function () { return result.remoteCount() === -1 ? result.localCount() : result.remoteCount(); });
        result.isSynchronized = ko.pureComputed(function () { return result.localCount() === result.remoteCount(); });
        return result;
    }
    exports.create = create;
    var dataSetFunctions = {
        /** Change local store */
        setLocalStore: function (store) {
            this.localstore = store;
            this.reset();
        },
        /** Change remote adapter */
        setAdapter: function (adapter) {
            this.adapter = adapter;
        },
        /** Reset this dataset by detaching all entities */
        reset: function () {
            this.each(this.disposeEntity, this);
            this({});
        },
        /** Create a new view of the current set with specified query */
        createView: function (query) {
            return dataview.create(this, query);
        },
        /** Query remote source without attaching result to dataset */
        query: function (mode, query) {
            var self = this, promise;
            if (!mode)
                mode = self.refreshMode;
            if (!query && !_.isString(mode)) {
                query = mode;
                mode = self.refreshMode;
            }
            if (mode === "remote") {
                promise = self.adapter.getAll(self.setName, query).then(function (result) { return result.data; });
            }
            else {
                promise = self.localstore.getAll(self.setName, query);
            }
            return promise.then(function (data) { return self.fromJSRange(data, null, !!query && query.expands.size() > 0, false); });
        },
        /** Refresh dataset from remote source */
        refresh: function (mode, query) {
            var self = this;
            if (!mode)
                mode = self.refreshMode;
            if (!query && !_.isString(mode)) {
                query = mode;
                mode = self.refreshMode;
            }
            if (mode === "remote") {
                return self.adapter.getAll(self.setName, query)
                    .then(function (result) { return _updateDataSet(self, result, query); });
            }
            else {
                return self.localstore.getAll(self.setName, query)
                    .then(function (entities) { return self.attachOrUpdateRange(entities, false, !!query && query.expands.size() > 0, false); });
            }
        },
        /** Load an entity by id from the remote source */
        load: function (key, mode, query) {
            var self = this, promise;
            if (!mode)
                mode = self.refreshMode;
            if (!query && !_.isString(mode)) {
                query = mode;
                mode = self.refreshMode;
            }
            if (mode === "remote") {
                promise = self.adapter.getOne(self.setName, key, query);
            }
            else {
                promise = self.localstore.getOne(self.setName, key, query);
            }
            return promise.then(function (data) { return self.attachOrUpdate(data, false, !!query && query.expands.size() > 0, mode === "remote"); });
        },
        /** Synchronize data store with remote source content */
        sync: function (query) {
            var self = this;
            return self.adapter.getAll(self.setName, query)
                .then(function (result) { return self.storeRange(result.data); })
                .then(function () { return; });
        },
        /** Get relation by ensuring using specific remote action and not filter */
        refreshRelation: function (entity, propertyName, mode, query, nostore) {
            if (!this.adapter.getRelation) {
                throw new Error("This adapter does not support custom relations");
            }
            var self = this, config = mapping.getMappingConfiguration(entity, self), relation = _.find(config.relations, function (r) { return r.propertyName === propertyName; });
            if (!relation) {
                throw new Error("This relation is not configured on this entity type");
            }
            if (!mode)
                mode = self.refreshMode;
            if (!query && !_.isString(mode)) {
                query = mode;
                mode = self.refreshMode;
            }
            var foreignSet = self.context.getSet(relation.controllerName);
            if (mode === "remote") {
                return self.adapter.getRelation(self.setName, propertyName, self.getKey(entity), query)
                    .then(function (result) { return nostore ? foreignSet.attachOrUpdateRange(result.data, false, !!query && query.expands.size() > 0, false) : _updateDataSet(foreignSet, result, query); });
            }
            else {
                return self.localstore.getAll(foreignSet.setName, query)
                    .then(function (entities) { return foreignSet.attachOrUpdateRange(entities, false, !!query && query.expands.size() > 0, false); });
            }
        },
        /** Execute action on remote source */
        executeAction: function (action, params, entity) {
            if (!this.adapter.action) {
                throw new Error("This adapter does not support custom actions");
            }
            var id = entity ? this.getKey(entity) : null, data = ko.toJS(params);
            return this.adapter.action(this.setName, action, data, id);
        },
        /** Gets the key associated with an entity */
        getKey: function (entity) {
            return ko.unwrap(entity[this.key]);
        },
        /** Finds a matching entity in the set (by key) */
        findByKey: function (key) {
            return this()[key];
        },
        /** Add entity to dataset, if buffer is false, entity will be instantly post on the server */
        add: function (entity) {
            var states = mapping.entityStates, defaultState = states.added;
            if (!entity.EntityState) {
                mapping.addMappingProperties(entity, this);
            }
            else if (this.isAttached(entity) && entity.EntityState() === states.removed) {
                defaultState = entity.HasChanges() ? states.modified : states.unchanged;
            }
            entity.EntityState(defaultState);
            if (!this.getKey(entity))
                entity[this.key](guid.generateTemp());
            return this.attach(entity);
        },
        /** Add entities to dataset, if buffer is false, entities will be instantly post on the server */
        addRange: function (entities) {
            var _this = this;
            var states = mapping.entityStates, defaultState = states.added, state;
            _.each(entities, function (entity) {
                state = defaultState;
                if (!entity.EntityState) {
                    mapping.addMappingProperties(entity, _this);
                }
                else if (_this.isAttached(entity) && entity.EntityState() === states.removed) {
                    state = entity.HasChanges() ? states.modified : states.unchanged;
                }
                entity.EntityState(state);
                if (!_this.getKey(entity))
                    entity[_this.key](guid.generateTemp());
            });
            return this.attachRange(entities);
        },
        /** Update entity on dataset, if buffer is false, entity will be instantly put on the server */
        update: function (entity) {
            if (this.isAttached(entity)) {
                entity.EntityState(mapping.entityStates.modified);
                return this.store(entity);
            }
            return Promise.resolve(entity);
        },
        /** Update entities on dataset, if buffer is false, entities will be instantly put on the server */
        updateRange: function (entities) {
            var self = this, toStore = [];
            _.each(entities, function (entity) {
                if (self.isAttached(entity)) {
                    entity.EntityState(mapping.entityStates.modified);
                    toStore.push(entity);
                }
            });
            return self.storeRange(toStore).then(function () { return entities; });
        },
        /** Remove entity from dataset, if buffer is false, entity will be instantly deleted on the server */
        remove: function (entity) {
            var state = entity.EntityState && entity.EntityState();
            if (_.isUndefined(state) || state === mapping.entityStates.added)
                this.detach(entity);
            else {
                entity.EntityState(mapping.entityStates.removed);
                return this.store(entity);
            }
            return Promise.resolve(entity);
        },
        /** Remove entities from dataset, if buffer is false, entities will be instantly deleted on the server */
        removeRange: function (entities) {
            var self = this, toStore = [];
            _.each(entities, function (entity) {
                var state = entity.EntityState && entity.EntityState();
                if (_.isUndefined(state) || state === mapping.entityStates.added)
                    self.detach(entity);
                else {
                    entity.EntityState(mapping.entityStates.removed);
                    toStore.push(entity);
                }
            });
            return self.storeRange(toStore).then(function () { return entities; });
        },
        /** Reset entity to its original state */
        resetEntity: function (entity) {
            mapping.resetEntity(entity, this);
            return this.store(entity);
        },
        /** Dispose and clean entity */
        disposeEntity: function (entity) {
            mapping.disposeEntity(entity, this);
        },
        /** Get whether entity is attached or not */
        isAttached: function (entity) {
            return !!this.findByKey(this.getKey(entity));
        },
        /** Attach an entity to the dataSet (commits immediately if buffer is false) */
        attach: function (entity, store) {
            if (store === void 0) { store = true; }
            var self = this, table = self(), key = self.getKey(entity);
            if (!self.isAttached(entity)) {
                self.valueWillMutate();
                return Promise.resolve(store && self.localstore.add(self.setName, entity))
                    .then(function () {
                    table[key] = entity;
                    return _initAttachedEntity(self, entity);
                })
                    .then(function () { return self.valueHasMutated(); })
                    .then(function () { return entity; });
            }
            return Promise.resolve(entity);
        },
        /** Attach an Array of entities to the dataSet */
        attachRange: function (entities, store) {
            if (store === void 0) { store = true; }
            var self = this, toUpdate = false, table = self(), key, promises = [];
            var toStore = _.filter(entities, function (entity) {
                if (!self.isAttached(entity)) {
                    if (!toUpdate) {
                        self.valueWillMutate();
                        toUpdate = true;
                    }
                    key = self.getKey(entity);
                    table[key] = entity;
                    promises.push(_initAttachedEntity(self, entity));
                    return true;
                }
                return false;
            });
            return Promise.all(promises)
                .then(function () { toUpdate && store && self.localstore.addRange(self.setName, toStore); })
                .then(function () { toUpdate && self.valueHasMutated(); })
                .then(function () { return entities; });
        },
        /** Stop an entity from being tracked by the dataSet */
        detach: function (entity) {
            var self = this, table = self(), key = this.getKey(entity);
            if (self.isAttached(entity)) {
                self.valueWillMutate();
                self.disposeEntity(entity);
                delete table[key];
                self.valueHasMutated();
            }
        },
        /** Stop an array of entities from being tracked by the dataSet */
        detachRange: function (entityKeys) {
            var self = this, table = self(), toUpdate = false;
            _.each(entityKeys, function (key) {
                var entity = self.findByKey(key);
                if (entity) {
                    if (!toUpdate) {
                        self.valueWillMutate();
                        toUpdate = true;
                    }
                    self.disposeEntity(entity);
                    delete table[key];
                }
            });
            if (toUpdate) {
                self.valueHasMutated();
            }
        },
        /** Attach or update entity if existing with current data and commit changes if commit is set to true */
        attachOrUpdate: function (data, commit, expand, store) {
            if (commit === void 0) { commit = false; }
            if (expand === void 0) { expand = false; }
            if (store === void 0) { store = true; }
            var self = this, existing = self.findByKey(self.getKey(data));
            if (!existing) {
                return self.fromJS(data, commit === true ? mapping.entityStates.added : mapping.entityStates.unchanged, expand, store)
                    .then(function (entity) { return self.attach(entity, store); });
            }
            return mapping.updateEntity(existing, data, commit, expand, store, self)
                .then(function () { return store && self.store(existing); })
                .then(function () { return existing; });
        },
        /** Attach or update entities if existing with current data and commit changes if commit is set to true */
        attachOrUpdateRange: function (data, commit, expand, store) {
            if (commit === void 0) { commit = false; }
            if (expand === void 0) { expand = false; }
            if (store === void 0) { store = true; }
            var self = this, toAttach = [], toUpdateData = [], toUpdate = [];
            _.each(data, function (item) {
                var existing = self.findByKey(self.getKey(item));
                if (existing) {
                    toUpdateData.push(item);
                    toUpdate.push(existing);
                }
                else {
                    toAttach.push(item);
                }
            });
            return mapping.updateEntities(toUpdate, toUpdateData, commit, expand, store, self)
                .then(function (result) {
                toUpdate = result;
                if (store)
                    return self.storeRange(result);
            })
                .then(function () { return self.fromJSRange(toAttach, commit === true ? mapping.entityStates.added : mapping.entityStates.unchanged, expand, store); })
                .then(function (result) {
                toAttach = result;
                return self.attachRange(result, store);
            })
                .then(function () { return _.union(toAttach, toUpdate); });
            //return self.fromJSRange(toAttach, commit === true ? mapping.entityStates.added : mapping.entityStates.unchanged, expand, store).then(result => { toAttach = result; })
            //    .then(() => mapping.updateEntities(toUpdate, toUpdateData, commit, expand, store, self)).then(result => { toUpdate = result; })
            //    .then(() => store && self.storeRange(toUpdate))
            //    .then(() => self.attachRange(toAttach, store))
            //    .then(() => _.union(toAttach, toUpdate));
        },
        /** Store entity to local store without attaching to datacontext */
        store: function (entity) {
            if (_.isUndefined(entity.EntityState))
                entity.EntityState = mapping.entityStates.unchanged;
            return this.localstore.update(this.setName, entity).then(function () { return entity; });
        },
        /** Store entities to local store without attaching to datacontext */
        storeRange: function (entities) {
            _.each(entities, function (entity) {
                if (_.isUndefined(entity.EntityState))
                    entity.EntityState = mapping.entityStates.unchanged;
            });
            return this.localstore.updateRange(this.setName, entities).then(function () { return entities; });
        },
        /** Create a JS object from given entity */
        toJS: function (entity, keepstate) {
            if (keepstate === void 0) { keepstate = false; }
            return mapping.mapEntityToJS(entity, keepstate, this);
        },
        /** Create a JS object from given entity */
        toJSRange: function (entities, keepstate) {
            if (keepstate === void 0) { keepstate = false; }
            return mapping.mapEntitiesToJS(entities, keepstate, this);
        },
        /** Serialize given entity to JSON */
        toJSON: function (entity, keepstate) {
            if (keepstate === void 0) { keepstate = false; }
            return mapping.mapEntityToJSON(entity, keepstate, this);
        },
        /** Instanciate an entities from a JS array */
        fromJSRange: function (data, state, expand, store) {
            if (expand === void 0) { expand = true; }
            if (store === void 0) { store = true; }
            return mapping.mapEntitiesFromJS(data, state || mapping.entityStates.unchanged, expand, store, this);
        },
        /** Instanciate an entity from a JS object */
        fromJS: function (data, state, expand, store) {
            if (expand === void 0) { expand = true; }
            if (store === void 0) { store = true; }
            return mapping.mapEntityFromJS(data, state || mapping.entityStates.unchanged, expand, store, this);
        },
        /** Instanciate an entity from a JSON string */
        fromJSON: function (json, state, expand, store) {
            if (expand === void 0) { expand = true; }
            if (store === void 0) { store = true; }
            return mapping.mapEntityFromJSON(json, state || mapping.entityStates.unchanged, expand, store, this);
        },
        /** Get a report of changes in the dataSet */
        getChanges: function (entities) {
            var extractState = function (e) { return mapping.entityStates[e.EntityState()]; };
            if (entities) {
                return _.groupBy(entities, extractState);
            }
            return this.groupBy(extractState);
        },
        /** Save changes of an entity to the server */
        saveEntity: function (entity) {
            var self = this, state = entity.EntityState(), states = mapping.entityStates;
            switch (state) {
                case states.added:
                    return self._remoteCreate(entity);
                case states.modified:
                    return self._remoteUpdate(entity);
                case states.removed:
                    return self._remoteRemove(entity);
            }
            return Promise.resolve(entity);
        },
        /** Commits all Pending Operations (PUT, DELETE, POST) */
        saveChanges: function (entities) {
            var self = this, changes = self.getChanges(entities);
            if (self.adapter.batch) {
                return self._remoteBatch(changes);
            }
            else {
                var promises = _.union(_.map(changes.added, function (e) { return self._remoteCreate(e); }), _.map(changes.modified, function (e) { return self._remoteUpdate(e); }), _.map(changes.removed, function (e) { return self._remoteRemove(e); }));
                return Promise.all(promises);
            }
        },
        /** Submits an Entity to the Server (internal use) */
        _remoteCreate: function (entity) {
            var self = this, oldkey = self.getKey(entity), canceller = function () { entity.IsSubmitting(false); };
            if (entity.EntityState() === mapping.entityStates.added) {
                if (entity.IsSubmitting() === false) {
                    entity.IsSubmitting(true);
                    return self.adapter.post(self.setName, self.toJS(entity))
                        .then(function (data) { return mapping.updateEntity(entity, data, false, false, true, self); })
                        .then(function () {
                        var key = self.getKey(entity), table;
                        if (oldkey !== key) {
                            table = self();
                            self.valueWillMutate();
                            table[key] = entity;
                            delete table[oldkey];
                            return self.localstore.remove(self.setName, oldkey)
                                .then(function () { return self.localstore.add(self.setName, entity); })
                                .then(function () { return self.valueHasMutated(); });
                        }
                    })
                        .then(function () {
                        if (self.context.autoLazyLoading === true)
                            return mapping.refreshRelations(entity, self);
                    })
                        .then(canceller, function (err) { canceller(); throw err; })
                        .then(function () { return entity; });
                }
            }
            return Promise.resolve(entity);
        },
        /** Updates an Item to the Server (internal use */
        _remoteUpdate: function (entity) {
            var self = this, key = self.getKey(entity), canceller = function () { entity.IsSubmitting(false); };
            if (entity.IsSubmitting() === false) {
                entity.IsSubmitting(true);
                return self.adapter.put(self.setName, key, self.toJS(entity))
                    .then(function (data) { return mapping.updateEntity(entity, data, false, false, true, self); })
                    .then(function () { return self.store(entity); })
                    .then(canceller, function (err) { canceller(); throw err; });
            }
            return Promise.resolve(entity);
        },
        /** Deletes an Item from the Server (internal use) */
        _remoteRemove: function (entity) {
            var self = this, key = self.getKey(entity);
            if (entity.IsSubmitting() === false) {
                entity.IsSubmitting(true);
                return self.adapter.remove(self.setName, key)
                    .then(function () { return self.localstore.remove(self.setName, key); })
                    .then(function () { return self.detach(entity); });
            }
            return Promise.resolve(null);
        },
        /** Submit a batch of changes (internal use) */
        _remoteBatch: function (changes) {
            changes.added = changes.added || [];
            changes.modified = changes.modified || [];
            changes.removed = changes.removed || [];
            var self = this, all = [].concat(changes.added, changes.modified, changes.removed);
            if (all.length === 0) {
                return Promise.resolve(null);
            }
            var canceller = function () { _.each(all, function (e) { e.IsSubmitting && e.IsSubmitting(false); }); }, _changes = {
                added: mapping.mapEntitiesToJS(changes.added, false, self),
                modified: mapping.mapEntitiesToJS(changes.modified, false, self),
                removed: mapping.mapEntitiesToJS(changes.removed, false, self)
            };
            _.each(all, function (entity) { entity.IsSubmitting(true); });
            return self.adapter.batch(self.setName, _changes)
                .then(function () { return mapping.updateEntities(changes.added, [], false, false, true, self); })
                .then(function () { return self.storeRange(changes.added); })
                .then(function () { return mapping.updateEntities(changes.modified, [], false, false, true, self); })
                .then(function () { return self.storeRange(changes.modified); })
                .then(function () { return self.localstore.removeRange(self.setName, changes.removed); })
                .then(function () { return self.detachRange(_.map(changes.removed, self.getKey, self)); })
                .then(canceller, function (err) { canceller(); throw err; });
        }
    };
    ko_.addTo(dataSetFunctions, "object");
});
//#endregion
