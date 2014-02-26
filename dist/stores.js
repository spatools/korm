define(["require", "exports", "knockout", "underscore", "promise/extensions", "./stores/memory"], function(require, exports, ko, _, promiseExt, MemoryStore) {
    var stores = {
        "memory": MemoryStore
    };

    function getDefaultStore(context) {
        return new MemoryStore(context);
    }
    exports.getDefaultStore = getDefaultStore;

    function getStore(name, context) {
        return Promise.cast(stores[name] || promiseExt.module("korm/stores/" + name)).then(function (Store) {
            stores[name] = Store;
            return new Store(context);
        });
    }
    exports.getStore = getStore;
});
