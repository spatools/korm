define(["require", "exports", "knockout", "underscore", "promise/extensions", "./mapping", "./dataview", "./guid", "koutils/underscore", "koutils/utils", "koutils/extenders"], function(require, exports, ko, _, promiseExt, mapping, dataview, guid, underscore, utils) {
    

    function _createOnStateChanged(dataset, entity) {
        return function (newState) {
            if (newState === 2 /* modified */) {
                promiseExt.timeout().then(function () {
                    dataset.store(entity);
                    dataset._remoteUpdate(entity);
                });
            } else if (newState === 3 /* removed */) {
                promiseExt.timeout(100).then(function () {
                    return dataset._remoteRemove(entity);
                });
            }
        };
    }

    function _initAttachedEntity(dataset, entity) {
        if (dataset.context.buffer === false) {
            entity.EntityState.subscribe(_createOnStateChanged(dataset, entity));
        }

        if (entity.EntityState() === 1 /* added */) {
            if (dataset.context.buffer === false)
                return dataset._remoteCreate(entity);
        } else if (dataset.context.autoLazyLoading === true) {
            return mapping.refreshRelations(entity, dataset).then(function () {
                return entity;
            });
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
                rmDfd = dataset.localstore.removeRange(dataset.setName, report.removed).then(function () {
                    return dataset.detachRange(report.removed);
                });
            }
        }

        return Promise.cast(rmDfd).then(function () {
            if (result.count >= 0 && (!query || query.filters.size() === 0))
                dataset.remoteCount(result.count);

            return isArray ? dataset.attachOrUpdateRange(result.data, false, !!query && query.expands.size() > 0) : dataset.attachOrUpdate(result.data, false, !!query && query.expands.size() > 0);
        });
    }

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
        result.count = ko.computed(function () {
            return result.remoteCount() === -1 ? result.localCount() : result.remoteCount();
        });

        result.isSynchronized = ko.computed(function () {
            return result.localCount() === result.remoteCount();
        });

        return result;
    }
    exports.create = create;

    var dataSetFunctions = {
        setLocalStore: function (store) {
            this.localstore = store;
            this.reset();
        },
        setAdapter: function (adapter) {
            this.adapter = adapter;
        },
        reset: function () {
            this.each(this.disposeEntity, this);
            this({});
        },
        createView: function (query) {
            return dataview.create(this, query);
        },
        query: function (mode, query) {
            var self = this, promise;

            if (!mode)
                mode = self.refreshMode;
            if (!query && !_.isString(mode)) {
                query = mode;
                mode = self.refreshMode;
            }

            if (mode === "remote") {
                promise = self.adapter.getAll(self.setName, query).then(function (result) {
                    return result.data;
                });
            } else {
                promise = self.localstore.getAll(self.setName, query);
            }

            return promise.then(function (data) {
                return self.fromJSRange(data, null, !!query && query.expands.size() > 0, false);
            });
        },
        refresh: function (mode, query) {
            var self = this;
            if (!mode)
                mode = self.refreshMode;
            if (!query && !_.isString(mode)) {
                query = mode;
                mode = self.refreshMode;
            }

            if (mode === "remote") {
                return self.adapter.getAll(self.setName, query).then(function (result) {
                    return _updateDataSet(self, result, query);
                });
            } else {
                return self.localstore.getAll(self.setName, query).then(function (entities) {
                    return self.attachOrUpdateRange(entities, false, !!query && query.expands.size() > 0, false);
                });
            }
        },
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
            } else {
                promise = self.localstore.getOne(self.setName, key, query);
            }

            return promise.then(function (data) {
                return self.attachOrUpdate(data, false, !!query && query.expands.size() > 0, mode === "remote");
            });
        },
        sync: function (query) {
            var self = this;
            return self.adapter.getAll(self.setName, query).then(function (result) {
                return self.storeRange(result.data);
            });
        },
        refreshRelation: function (entity, propertyName, mode, query, nostore) {
            if (!this.adapter.getRelation) {
                throw new Error("This adapter does not support custom relations");
            }

            var self = this, config = mapping.getMappingConfiguration(entity, self), relation = _.find(config.relations, function (r) {
                return r.propertyName === propertyName;
            });

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
                return self.adapter.getRelation(self.setName, propertyName, self.getKey(entity), query).then(function (result) {
                    return nostore ? foreignSet.attachOrUpdateRange(result.data, false, !!query && query.expands.size() > 0, false) : _updateDataSet(foreignSet, result, query);
                });
            } else {
                return self.localstore.getAll(foreignSet.setName, query).then(function (entities) {
                    return foreignSet.attachOrUpdateRange(entities, false, !!query && query.expands.size() > 0, false);
                });
            }
        },
        executeAction: function (action, params, entity) {
            if (!this.adapter.action) {
                throw new Error("This adapter does not support custom actions");
            }

            var id = entity ? this.getKey(entity) : null, data = ko.toJS(params);

            return this.adapter.action(this.setName, action, data, id);
        },
        getKey: function (entity) {
            return ko.unwrap(entity[this.key]);
        },
        findByKey: function (key) {
            return this()[key];
        },
        add: function (entity) {
            var states = mapping.entityStates, defaultState = 1 /* added */;

            if (!entity.EntityState) {
                mapping.addMappingProperties(entity, this);
            } else if (this.isAttached(entity) && entity.EntityState() === 3 /* removed */) {
                defaultState = entity.HasChanges() ? 2 /* modified */ : 0 /* unchanged */;
            }

            entity.EntityState(defaultState);

            if (!this.getKey(entity))
                entity[this.key](guid.generateTemp());

            return this.attach(entity);
        },
        addRange: function (entities) {
            var _this = this;
            var states = mapping.entityStates, defaultState = 1 /* added */, state;

            _.each(entities, function (entity) {
                state = defaultState;

                if (!entity.EntityState) {
                    mapping.addMappingProperties(entity, _this);
                } else if (_this.isAttached(entity) && entity.EntityState() === 3 /* removed */) {
                    state = entity.HasChanges() ? 2 /* modified */ : 0 /* unchanged */;
                }

                entity.EntityState(state);

                if (!_this.getKey(entity))
                    entity[_this.key](guid.generateTemp());
            });

            return this.attachRange(entities);
        },
        update: function (entity) {
            if (this.isAttached(entity)) {
                entity.EntityState(2 /* modified */);
                return this.store(entity);
            }

            return Promise.resolve(entity);
        },
        updateRange: function (entities) {
            var self = this, toStore = [];

            _.each(entities, function (entity) {
                if (self.isAttached(entity)) {
                    entity.EntityState(2 /* modified */);
                    toStore.push(entity);
                }
            });

            return self.storeRange(toStore).then(function () {
                return entities;
            });
        },
        remove: function (entity) {
            var state = entity.EntityState && entity.EntityState();
            if (_.isUndefined(state) || state === 1 /* added */)
                this.detach(entity);
            else {
                entity.EntityState(3 /* removed */);
                return this.store(entity);
            }

            return Promise.resolve(entity);
        },
        removeRange: function (entities) {
            var self = this, toStore = [];

            _.each(entities, function (entity) {
                var state = entity.EntityState && entity.EntityState();
                if (_.isUndefined(state) || state === 1 /* added */)
                    self.detach(entity);
                else {
                    entity.EntityState(3 /* removed */);
                    toStore.push(entity);
                }
            });

            return self.storeRange(toStore).then(function () {
                return entities;
            });
        },
        resetEntity: function (entity) {
            mapping.resetEntity(entity, this);
            return this.store(entity);
        },
        disposeEntity: function (entity) {
            if (entity.subscription) {
                entity.subscription.dispose();
                delete entity.subscription;
            }
        },
        isAttached: function (entity) {
            return !!this.findByKey(this.getKey(entity));
        },
        attach: function (entity, store) {
            if (typeof store === "undefined") { store = true; }
            var self = this, table = self(), key = self.getKey(entity);

            if (!self.isAttached(entity)) {
                self.valueWillMutate();

                return Promise.cast(store && self.localstore.add(self.setName, entity)).then(function () {
                    table[key] = entity;
                    return _initAttachedEntity(self, entity);
                }).then(function () {
                    return self.valueHasMutated();
                }).then(function () {
                    return entity;
                });
            }

            return Promise.resolve(entity);
        },
        attachRange: function (entities, store) {
            if (typeof store === "undefined") { store = true; }
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

            return Promise.all(promises).then(function () {
                toUpdate && store && self.localstore.addRange(self.setName, toStore);
            }).then(function () {
                toUpdate && self.valueHasMutated();
            }).then(function () {
                return entities;
            });
        },
        detach: function (entity) {
            var self = this, table = self(), key = this.getKey(entity);

            if (self.isAttached(entity)) {
                self.valueWillMutate();

                self.disposeEntity(entity);
                delete table[key];

                self.valueHasMutated();
            }
        },
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
        attachOrUpdate: function (data, commit, expand, store) {
            if (typeof commit === "undefined") { commit = false; }
            if (typeof expand === "undefined") { expand = false; }
            if (typeof store === "undefined") { store = true; }
            var self = this, existing = self.findByKey(self.getKey(data));

            if (!existing) {
                return self.fromJS(data, commit === true ? 1 /* added */ : 0 /* unchanged */, expand, store).then(function (entity) {
                    return self.attach(entity, store);
                });
            }

            return mapping.updateEntity(existing, data, commit, expand, store, self).then(function () {
                return store && self.store(existing);
            }).then(function () {
                return existing;
            });
        },
        attachOrUpdateRange: function (data, commit, expand, store) {
            if (typeof commit === "undefined") { commit = false; }
            if (typeof expand === "undefined") { expand = false; }
            if (typeof store === "undefined") { store = true; }
            var self = this, toAttach = [], toUpdateData = [], toUpdate = [];

            _.each(data, function (item) {
                var existing = self.findByKey(self.getKey(item));
                if (existing) {
                    toUpdateData.push(item);
                    toUpdate.push(existing);
                } else {
                    toAttach.push(item);
                }
            });

            return mapping.updateEntities(toUpdate, toUpdateData, commit, expand, store, self).then(function (result) {
                toUpdate = result;

                if (store)
                    return self.storeRange(result);
            }).then(function () {
                return self.fromJSRange(toAttach, commit === true ? 1 /* added */ : 0 /* unchanged */, expand, store);
            }).then(function (result) {
                toAttach = result;
                return self.attachRange(result, store);
            }).then(function () {
                return _.union(toAttach, toUpdate);
            });
        },
        store: function (entity) {
            if (_.isUndefined(entity.EntityState))
                entity.EntityState = 0 /* unchanged */;

            return this.localstore.update(this.setName, entity).then(function () {
                return entity;
            });
        },
        storeRange: function (entities) {
            _.each(entities, function (entity) {
                if (_.isUndefined(entity.EntityState))
                    entity.EntityState = 0 /* unchanged */;
            });

            return this.localstore.updateRange(this.setName, entities).then(function () {
                return entities;
            });
        },
        toJS: function (entity, keepstate) {
            if (typeof keepstate === "undefined") { keepstate = false; }
            return mapping.mapEntityToJS(entity, keepstate, this);
        },
        toJSON: function (entity, keepstate) {
            if (typeof keepstate === "undefined") { keepstate = false; }
            return mapping.mapEntityToJSON(entity, keepstate, this);
        },
        fromJSRange: function (data, state, expand, store) {
            if (typeof expand === "undefined") { expand = true; }
            if (typeof store === "undefined") { store = true; }
            return mapping.mapEntitiesFromJS(data, state || 0 /* unchanged */, expand, store, this);
        },
        fromJS: function (data, state, expand, store) {
            if (typeof expand === "undefined") { expand = true; }
            if (typeof store === "undefined") { store = true; }
            return mapping.mapEntityFromJS(data, state || 0 /* unchanged */, expand, store, this);
        },
        fromJSON: function (json, state, expand, store) {
            if (typeof expand === "undefined") { expand = true; }
            if (typeof store === "undefined") { store = true; }
            return mapping.mapEntityFromJSON(json, state || 0 /* unchanged */, expand, store, this);
        },
        getChanges: function (entities) {
            var extractState = function (e) {
                return mapping.entityStates[e.EntityState()];
            };

            if (entities) {
                return _.groupBy(entities, extractState);
            }

            return this.groupBy(extractState);
        },
        saveEntity: function (entity) {
            var self = this, state = entity.EntityState(), states = mapping.entityStates;

            switch (state) {
                case 1 /* added */:
                    return self._remoteCreate(entity);
                case 2 /* modified */:
                    return self._remoteUpdate(entity);
                case 3 /* removed */:
                    return self._remoteRemove(entity);
            }

            return Promise.resolve(entity);
        },
        saveChanges: function (entities) {
            var self = this, changes = self.getChanges(entities);

            if (self.adapter.batch) {
                return self._remoteBatch(changes);
            } else {
                var promises = _.union(_.map(changes.added, function (e) {
                    return self._remoteCreate(e);
                }), _.map(changes.modified, function (e) {
                    return self._remoteUpdate(e);
                }), _.map(changes.removed, function (e) {
                    return self._remoteRemove(e);
                }));

                return Promise.all(promises);
            }
        },
        _remoteCreate: function (entity) {
            var self = this, oldkey = self.getKey(entity), canceller = function () {
                entity.IsSubmitting(false);
            };

            if (entity.EntityState() === 1 /* added */) {
                if (entity.IsSubmitting() === false) {
                    entity.IsSubmitting(true);

                    return self.adapter.post(self.setName, self.toJS(entity)).then(function (data) {
                        return mapping.updateEntity(entity, data, false, false, true, self);
                    }).then(function () {
                        var key = self.getKey(entity), table;
                        if (oldkey !== key) {
                            table = self();
                            self.valueWillMutate();

                            table[key] = entity;
                            delete table[oldkey];

                            return self.localstore.remove(self.setName, oldkey).then(function () {
                                return self.localstore.add(self.setName, entity);
                            }).then(function () {
                                return self.valueHasMutated();
                            });
                        }
                    }).then(function () {
                        if (self.context.autoLazyLoading === true)
                            return mapping.refreshRelations(entity, self);
                    }).then(canceller, canceller).then(function () {
                        return entity;
                    });
                }
            }

            return Promise.resolve(entity);
        },
        _remoteUpdate: function (entity) {
            var self = this, key = self.getKey(entity), canceller = function () {
                entity.IsSubmitting(false);
            };

            if (entity.IsSubmitting() === false) {
                entity.IsSubmitting(true);

                return self.adapter.put(self.setName, key, self.toJS(entity)).then(function (data) {
                    return mapping.updateEntity(entity, data, false, false, true, self);
                }).then(function () {
                    return self.store(entity);
                }).then(canceller, canceller);
            }

            return Promise.resolve(entity);
        },
        _remoteRemove: function (entity) {
            var self = this, key = self.getKey(entity), canceller = function () {
                entity.IsSubmitting(false);
            };

            if (entity.IsSubmitting() === false) {
                entity.IsSubmitting(true);

                return self.adapter.remove(self.setName, key).then(function () {
                    return self.localstore.remove(self.setName, key);
                }).then(function () {
                    return self.detach(entity);
                }).then(canceller, canceller);
            }

            return Promise.resolve(null);
        },
        _remoteBatch: function (changes) {
            changes.added = changes.added || [];
            changes.modified = changes.modified || [];
            changes.removed = changes.removed || [];

            var self = this, all = [].concat(changes.added, changes.modified, changes.removed);

            if (all.length === 0) {
                return Promise.resolve(null);
            }

            var canceller = function () {
                _.each(all, function (entity) {
                    entity.IsSubmitting(false);
                });
            }, _changes = {
                added: mapping.mapEntitiesToJS(changes.added, false, self),
                modified: mapping.mapEntitiesToJS(changes.modified, false, self),
                removed: mapping.mapEntitiesToJS(changes.removed, false, self)
            };

            _.each(all, function (entity) {
                entity.IsSubmitting(true);
            });

            return self.adapter.batch(self.setName, _changes).then(function () {
                return mapping.updateEntities(changes.added, [], false, false, true, self);
            }).then(function () {
                return self.storeRange(changes.added);
            }).then(function () {
                return mapping.updateEntities(changes.modified, [], false, false, true, self);
            }).then(function () {
                return self.storeRange(changes.modified);
            }).then(function () {
                return self.localstore.removeRange(self.setName, changes.removed);
            }).then(function () {
                return self.detachRange(_.map(changes.removed, self.getKey, self));
            }).then(canceller, canceller);
        }
    };

    _.extend(dataSetFunctions, underscore.objects, underscore.collections);
});
