/// <reference path="../../_definitions.d.ts" />
/// <reference path="../../typings/jquery/jquery.d.ts" />
define(["require", "exports", "jquery", "./prefilter", "../query"], function (require, exports, $, prefilter, query) {
    var WebApiAdapter = (function () {
        function WebApiAdapter() {
            this.options = {
                baseUrl: "/api/",
                retryCount: 0,
                retryDelay: 0
            };
            prefilter.initialize();
        }
        WebApiAdapter.prototype.fixResult = function (result) {
            var data = result, count = -1;
            if (result.__count) {
                count = result.__count;
                data = result.results;
            }
            else if (!query) {
                count = result.length;
            }
            return {
                data: data,
                count: count
            };
        };
        WebApiAdapter.prototype.ajax = function (url, type, data) {
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
            return Promise.resolve($.ajax(options));
        };
        /** Get entity collection filtered by query (if provided) (GET) */
        WebApiAdapter.prototype.getAll = function (controller, query) {
            var url = this.options.baseUrl + controller;
            if (query)
                url = url + "?" + query.toQueryString();
            return this.ajax(url).then(this.fixResult);
        };
        /** Get a single entity (GET) */
        WebApiAdapter.prototype.getOne = function (controller, id, query) {
            var url = this.options.baseUrl + controller + "/" + encodeURIComponent(id);
            if (query)
                url = url + "?" + query.toQueryString();
            return this.ajax(url);
        };
        /** Create an entity (POST) */
        WebApiAdapter.prototype.post = function (controller, data) {
            var url = this.options.baseUrl + controller;
            return this.ajax(url, "POST", data);
        };
        /** Updates an entity (PUT) */
        WebApiAdapter.prototype.put = function (controller, id, data) {
            var url = this.options.baseUrl + controller + "/" + encodeURIComponent(id);
            return this.ajax(url, "PUT", data);
        };
        /** Deletes an entity (DELETE) */
        WebApiAdapter.prototype.remove = function (controller, id) {
            var url = this.options.baseUrl + controller + "/" + encodeURIComponent(id);
            return this.ajax(url, "DELETE");
        };
        WebApiAdapter.prototype.getRelation = function (controller, relationName, id, query) {
            var url = this.options.baseUrl + controller + "/" + encodeURIComponent(id) + "/" + relationName;
            if (query)
                url = url + "?" + query.toQueryString();
            return this.ajax(url).then(this.fixResult);
        };
        WebApiAdapter.prototype.action = function (controller, action, parameters, id) {
            var url = this.options.baseUrl + controller + (id ? "/" + encodeURIComponent(id) : "") + "/" + action;
            return this.ajax(url, "POST", parameters);
        };
        return WebApiAdapter;
    })();
    return WebApiAdapter;
});
