/// <reference path="../../_definitions.d.ts" />
/// <reference path="../../typings/jquery/jquery.d.ts" />
define(["require", "exports", "underscore", "jquery", "koutils/utils", "./prefilter", "../guid", "../query"], function (require, exports, _, $, utils, prefilter, guid, query) {
    var urls = {
        entitySet: "{controller}",
        entity: "{controller}({key})",
        entitySetAction: "{controller}/{action}",
        entityAction: "{controller}({key})/{action}"
    };
    var ODataAdapter = (function () {
        function ODataAdapter() {
            this.options = {
                baseUrl: "/data/",
                retryCount: 0,
                retryDelay: 0
            };
            prefilter.initialize();
        }
        ODataAdapter.prototype.generateKey = function (key) {
            var _this = this;
            if (guid.isGuid(key)) {
                return "guid'" + key + "'";
            }
            if (utils.isDate(key)) {
                return "datetime'" + key + "'";
            }
            if (typeof key === "string") {
                return "'" + encodeURIComponent(key) + "'";
            }
            if (_.isObject(key)) {
                return _.map(key, function (v, i) { return i + "=" + _this.generateKey(v); }).join(", ");
            }
            return key;
        };
        ODataAdapter.prototype.generateUrl = function (url) {
            var _this = this;
            var args = [];
            for (var _i = 1; _i < arguments.length; _i++) {
                args[_i - 1] = arguments[_i];
            }
            var regex = /\{([^}]*)\}/, matchFunction = function (match) {
                if (match.indexOf("key") !== -1) {
                    return _this.generateKey(args.shift());
                }
                return args.shift();
            };
            while (args.length && regex.test(url)) {
                url = url.replace(regex, matchFunction);
            }
            return this.options.baseUrl + url;
        };
        ODataAdapter.prototype.fixResult = function (result) {
            var data = result, count = -1;
            if (result["odata.metadata"]) {
                if (result["odata.count"])
                    count = result["odata.count"];
                data = result.value;
            }
            else if (!query) {
                count = result.length;
            }
            return {
                data: data,
                count: count
            };
        };
        ODataAdapter.prototype.ajax = function (url, type, data) {
            if (type === void 0) { type = "GET"; }
            var options = {
                url: url,
                type: type,
                contentType: "application/json",
                dataType: "text json",
                retryCount: this.options.retryCount,
                retryDelay: this.options.retryDelay
            };
            if (data)
                options.data = JSON.stringify(data);
            return Promise.cast($.ajax(options));
        };
        /** Get entity collection filtered by query (if provided) (GET) */
        ODataAdapter.prototype.getAll = function (controller, query) {
            var url = this.generateUrl(urls.entitySet, controller);
            if (query)
                url = url + "?" + query.toQueryString();
            return this.ajax(url).then(this.fixResult);
        };
        /** Get a single entity (GET) */
        ODataAdapter.prototype.getOne = function (controller, id, query) {
            var url = this.generateUrl(urls.entity, controller, id);
            if (query)
                url = url + "?" + query.toQueryString();
            return this.ajax(url);
        };
        /** Create an entity (POST) */
        ODataAdapter.prototype.post = function (controller, data) {
            var url = this.generateUrl(urls.entitySet, controller);
            return this.ajax(url, "POST", data);
        };
        /** Updates an entity (PUT) */
        ODataAdapter.prototype.put = function (controller, id, data) {
            var url = this.generateUrl(urls.entity, controller, id);
            return this.ajax(url, "PUT", data);
        };
        /** Deletes an entity (DELETE) */
        ODataAdapter.prototype.remove = function (controller, id) {
            var url = this.generateUrl(urls.entity, controller, id);
            return this.ajax(url, "DELETE");
        };
        ODataAdapter.prototype.getRelation = function (controller, relationName, id, query) {
            var url = this.generateUrl(urls.entityAction, controller, id, relationName);
            if (query)
                url = url + "?" + query.toQueryString();
            return this.ajax(url).then(this.fixResult);
        };
        ODataAdapter.prototype.action = function (controller, action, parameters, id) {
            var url = this.generateUrl(id ? urls.entityAction : urls.entitySetAction, controller, id ? id : action, action);
            return this.ajax(url, "POST", parameters);
        };
        return ODataAdapter;
    })();
    return ODataAdapter;
});
