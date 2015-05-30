/// <reference path="../_definitions.d.ts" />
define(["require", "exports", "promizr", "./adapters/odata"], function (require, exports, promizr, ODataAdapter) {
    var adapters = {
        odata: ODataAdapter
    };
    function getDefaultAdapter() {
        return new ODataAdapter();
    }
    exports.getDefaultAdapter = getDefaultAdapter;
    function loadAdapter(name) {
        if (adapters[name]) {
            return Promise.resolve(adapters[name]);
        }
        return promizr.module("korm/adapters/" + name).then(function (Adapter) {
            adapters[name] = Adapter;
            return Adapter;
        });
    }
    function getAdapter(name) {
        return loadAdapter(name).then(function (Adapter) { return new Adapter(); });
    }
    exports.getAdapter = getAdapter;
});
