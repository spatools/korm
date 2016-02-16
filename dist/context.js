define(["require", "exports", "underscore", "promise", "./mapping", "./stores", "./adapters", "./dataset"], function (require, exports, _, Promise, mapping, stores, adapters, dataset) {
    var DataContext = (function () {
        function DataContext() {
            this.sets = {};
            this.adapter = adapters.getDefaultAdapter();
            this.buffer = false;
            this.autoLazyLoading = false;
            this.mapping = new mapping.Configurations();
            this.refreshMode = "remote";
            this.store = stores.getDefaultStore(this);
        }
        DataContext.prototype.getMappingConfiguration = function (type) {
            return this.mapping.getConfiguration(type);
        };
        DataContext.prototype.addMappingConfiguration = function (config) {
            this.mapping.addConfiguration(config);
            return this;
        };
        DataContext.prototype.getSets = function () {
            return _.values(this.sets);
        };
        DataContext.prototype.getSet = function (name) {
            return this.sets[name];
        };
        DataContext.prototype.addSet = function (name, keyProperty, defaultType) {
            if (!this.sets[name])
                this[name] = this.sets[name] = dataset.create(name, keyProperty, defaultType, this);
            return this.sets[name];
        };
        DataContext.prototype.reset = function () {
            _.each(this.sets, function (dataset) { dataset.reset(); });
        };
        DataContext.prototype.resetStore = function () {
            return this.store.reset();
        };
        DataContext.prototype.setRefreshMode = function (mode) {
            this.refreshMode = mode;
            _.each(this.sets, function (dataset) { dataset.refreshMode = mode; });
        };
        DataContext.prototype.setLocalStore = function (storeType) {
            var _this = this;
            var op = _.isString(storeType) ? stores.getStore(storeType, this) : storeType.init().then(function () { return storeType; });
            return Promise.resolve(op).then(function (store) {
                _this.store = store;
                _.each(_this.sets, function (dataset) { return dataset.setLocalStore(store); });
            });
        };
        DataContext.prototype.setAdapter = function (adapterType) {
            var _this = this;
            var op = _.isString(adapterType) ? adapters.getAdapter(adapterType) : adapterType;
            return Promise.resolve(op).then(function (adapter) {
                _this.adapter = adapter;
                _.each(_this.sets, function (set) { return set.setAdapter(adapter); });
            });
        };
        return DataContext;
    })();
    exports.DataContext = DataContext;
    function create(storeType, adapterType, buffer, autoLazyLoading) {
        if (storeType === void 0) { storeType = "memory"; }
        if (adapterType === void 0) { adapterType = "odata"; }
        if (buffer === void 0) { buffer = false; }
        if (autoLazyLoading === void 0) { autoLazyLoading = false; }
        var context = new DataContext();
        context.buffer = buffer;
        context.autoLazyLoading = autoLazyLoading;
        return Promise.all([context.setLocalStore(storeType), context.setAdapter(adapterType)])
            .then(function () { return context; });
    }
    exports.create = create;
});
