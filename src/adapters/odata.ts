/// <reference path="../../_definitions.d.ts" />
/// <reference path="../../typings/jquery/jquery.d.ts" />

import _ = require("underscore");
import $ = require("jquery");
import utils = require("koutils/utils");

import adapters = require("../adapters");
import prefilter = require("./prefilter");
import guid = require("../guid");
import query = require("../query");

var urls = {
    entitySet: "{controller}",
    entity: "{controller}({key})",
    entitySetAction: "{controller}/{action}",
    entityAction: "{controller}({key})/{action}",
};

class ODataAdapter implements adapters.IAdapter {
    private options = {
        baseUrl: "/data/",
        retryCount: 0,
        retryDelay: 0
    };

    constructor() {
        prefilter.initialize();
    }

    private generateKey(key: any): string {
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
            return _.map(key, (v, i?) => i + "=" + this.generateKey(v)).join(", ");
        }

        return key;
    }
    private generateUrl(url: string, ...args: string[]): string {
        var regex = /\{([^}]*)\}/,
            matchFunction = match => {
                if (match.indexOf("key") !== -1) {
                    return this.generateKey(args.shift());
                }

                return args.shift();
            };

        while (args.length && regex.test(url)) {
            url = url.replace(regex, matchFunction);
        }

        return this.options.baseUrl + url;
    }

    private fixResult(result: any): adapters.IAdapterResult {
        var data = result,
            count = -1;

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
    }
    private ajax(url: string, type: string = "GET", data?: any): Promise<any> {
        var options: prefilter.RetryAjaxOptions = {
            url: url,
            type: type,
            contentType: "application/json",
            dataType: "text json",
            retryCount: this.options.retryCount,
            retryDelay: this.options.retryDelay
        };

        if (data)
            options.data = JSON.stringify(data);

        return Promise.resolve<any>($.ajax(options));
    }

    /** Get entity collection filtered by query (if provided) (GET) */
    public getAll(controller: string, query?: query.ODataQuery): Promise<adapters.IAdapterResult> {
	    var url = this.generateUrl(urls.entitySet, controller);

        if (query)
            url = url + "?" + query.toQueryString();

        return this.ajax(url).then(this.fixResult);
    }
    /** Get a single entity (GET) */
    public getOne(controller: string, id: any, query?: query.ODataQuery): Promise<any> {
	    var url = this.generateUrl(urls.entity, controller, id);

        if (query)
            url = url + "?" + query.toQueryString();

        return this.ajax(url);
    }

    /** Create an entity (POST) */
    public post(controller: string, data: any): Promise<any> {
	    var url = this.generateUrl(urls.entitySet, controller);
        return this.ajax(url, "POST", data);
    }
    /** Updates an entity (PUT) */
    public put(controller: string, id: any, data: any): Promise<any> {
	    var url = this.generateUrl(urls.entity, controller, id);
        return this.ajax(url, "PUT", data);
    }
    /** Deletes an entity (DELETE) */
    public remove(controller: string, id: any): Promise<any> {
	    var url = this.generateUrl(urls.entity, controller, id);
        return this.ajax(url, "DELETE");
    }

    public getRelation(controller: string, relationName: string, id: any, query?: query.ODataQuery): Promise<adapters.IAdapterResult> {
	    var url = this.generateUrl(urls.entityAction, controller, id, relationName);

        if (query)
            url = url + "?" + query.toQueryString();

        return this.ajax(url).then(this.fixResult);
    }
    public action(controller: string, action: string, parameters: any, id?: any): Promise<any> {
	    var url = this.generateUrl(id ? urls.entityAction : urls.entitySetAction, controller, id ? id : action, action);
        return this.ajax(url, "POST", parameters);
    }
}

export = ODataAdapter;
