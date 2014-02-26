/// <reference path="../../_definitions.d.ts" />
/// <reference path="../../typings/jquery/jquery.d.ts" />

import $ = require("jquery");
import utils = require("koutils/utils");

import adapters = require("../adapters");
import prefilter = require("./prefilter");
import guid = require("../guid");
import query = require("../query");

class WebApiAdapter implements adapters.IAdapter {
    private options = {
        baseUrl: "/api/",
        retryCount: 0,
        retryDelay: 0
    };

    constructor() {
        prefilter.initialize();
    }

    private fixResult(result: any): adapters.IAdapterResult {
        var data = result,
            count = -1;

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
    }
    private ajax(url: string, type: string = "GET", data?: any): Promise<any> {
        var options: JQueryAjaxSettings = {
            url: url,
            type: type,
            contentType: "application/json",
            dataType: "text json",
            retryCount: this.options.retryCount,
            retryDelay: this.options.retryDelay
        };

        if (data)
            options.data = data;

        return Promise.cast($.ajax(options));
    }

    /** Get entity collection filtered by query (if provided) (GET) */
    public getAll(controller: string, query?: query.ODataQuery): Promise<adapters.IAdapterResult> {
        var url = this.options.baseUrl + controller;

        if (query)
            url = url + "?" + query.toQueryString();

        return this.ajax(url).then(this.fixResult);
    }
    /** Get a single entity (GET) */
    public getOne(controller: string, id: any, query?: query.ODataQuery): Promise<any> {
        var url = this.options.baseUrl + controller + "/" + encodeURIComponent(id);

        if (query)
            url = url + "?" + query.toQueryString();

        return this.ajax(url);
    }

    /** Create an entity (POST) */
    public post(controller: string, data: any): Promise<any> {
        var url = this.options.baseUrl + controller;
        return this.ajax(url, "POST", data);
    }
    /** Updates an entity (PUT) */
    public put(controller: string, id: any, data: any): Promise<any> {
        var url = this.options.baseUrl + controller + "/" + encodeURIComponent(id);
        return this.ajax(url, "PUT", data);
    }
    /** Deletes an entity (DELETE) */
    public remove(controller: string, id: any): Promise<any> {
        var url = this.options.baseUrl + controller + "/" + encodeURIComponent(id);
        return this.ajax(url, "DELETE");
    }

    public getRelation(controller: string, relationName: string, id: any, query?: query.ODataQuery): Promise<adapters.IAdapterResult> {
        var url = this.options.baseUrl + controller + "/" + encodeURIComponent(id) + "/" + relationName;

        if (query)
            url = url + "?" + query.toQueryString();

        return this.ajax(url).then(this.fixResult);
    }
    public action(controller: string, action: string, parameters: any, id?: any): Promise<any> {
        var url = this.options.baseUrl + controller + (id ? "/" + encodeURIComponent(id) : "") + "/" + action;
        return this.ajax(url, "POST", parameters);
    }
}

export = WebApiAdapter;
