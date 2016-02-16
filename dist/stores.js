define(["require", "exports", "promizr", "./stores/memory"], function (require, exports, promizr, MemoryStore) {
    var stores = {
        "memory": MemoryStore
    };
    function getDefaultStore(context) {
        return new MemoryStore(context);
    }
    exports.getDefaultStore = getDefaultStore;
    function loadStore(name) {
        if (stores[name]) {
            return Promise.resolve(stores[name]);
        }
        return promizr.module("korm/stores/" + name).then(function (Store) {
            stores[name] = Store;
            return Store;
        });
    }
    function getStore(name, context) {
        return loadStore(name).then(function (Store) { return new Store(context); });
    }
    exports.getStore = getStore;
});
