define(["require", "exports", "promise/extensions", "./adapters/odata"], function(require, exports, promiseExt, ODataAdapter) {
    var adapters = {
        odata: ODataAdapter
    };

    function getDefaultAdapter() {
        return new ODataAdapter();
    }
    exports.getDefaultAdapter = getDefaultAdapter;

    function getAdapter(name) {
        return Promise.cast(adapters[name] || promiseExt.module("korm/adapters/" + name)).then(function (Adapter) {
            adapters[name] = Adapter;
            return new Adapter();
        });
    }
    exports.getAdapter = getAdapter;
});
