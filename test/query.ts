/// <reference path="../_definitions.d.ts" />
/// <reference path="../typings/mocha/mocha.d.ts" />
/// <reference path="../typings/should/should.d.ts" />
/// <reference path="../typings/sinon/sinon.d.ts" />

import ko = require("knockout");
import _ = require("underscore");
import guidHelpers = require("./helpers/guid");

import query = require("../src/query");

describe("Query", () => {

    describe("Filter", () => {

        describe("toQueryString", () => {

            it("should format filter as OData filter", () => {
                var filter = new query.Filter("MyField", query.operator.equal, 0),
                    querystring = filter.toQueryString();

                querystring.should.equal("MyField eq 0");
            });

            it("should add single quotes when used with a string value", () => {
                var filter = new query.Filter("MyField", query.operator.equal, "test"),
                    querystring = filter.toQueryString();

                querystring.should.equal("MyField eq 'test'");
            });

            it("should add guid type when used with a GUID value", () => {
                var filter = new query.Filter("MyField", query.operator.equal, guidHelpers.validGuid1),
                    querystring = filter.toQueryString();

                querystring.should.equal("MyField eq guid'01234567-89AB-CDEF-0123-456789abcdef'");
            });

            it("should add datetime type when used with a date value", () => {
                var date = new Date().toJSON(),
                    filter = new query.Filter("MyField", query.operator.equal, date),
                    querystring = filter.toQueryString();

                querystring.should.equal("MyField eq datetime'" + date + "'");
            });

        });

        describe("toUnderscoreQuery", () => {

            it("should return a function", () => {
                var filter = new query.Filter("MyField", query.operator.greaterThan, 0),
                    underscoreFilter = filter.toUnderscoreQuery();

                underscoreFilter.should.be.a.Function;
            });

            it("should allow array filtering", () => {
                var filter = new query.Filter("MyField", query.operator.greaterThan, 0),
                    objs = [
                        { MyField: 0 },
                        { MyField: 1 },
                        { MyField: 2 },
                        { MyField: 3 },
                    ],
                    filtered = _.filter(objs, filter.toUnderscoreQuery());

                filtered.length.should.equal(3);

                filter.operator(query.operator.lessThan);
                filter.value(2);
                filtered = _.filter(objs, filter.toUnderscoreQuery());

                filtered.length.should.equal(2);

                filter.operator(query.operator.greaterThanOrEqual);
                filtered = _.filter(objs, filter.toUnderscoreQuery());

                filtered.length.should.equal(2);
            });

        });

    });

    describe("FunctionFilter", () => {

        describe("toQueryString", () => {

            it("should format filter as OData function filter", () => {
                var filter = new query.FunctionFilter(query.string.indexof, "MyField", ["def"], query.operator.equal, 3),
                    querystring = filter.toQueryString();


                querystring.should.equal("indexof(MyField, 'def') eq 3");
            });

            it("should allow to avoid operator when filter is autosufficient", () => {
                var filter = new query.FunctionFilter(query.string.substringof, "MyField", ["bc"]),
                    querystring = filter.toQueryString();


                querystring.should.equal("substringof(MyField, 'bc')");
            });

        });

        describe("toUnderscoreQuery", () => {

            it("should return a function", () => {
                var filter = new query.FunctionFilter(query.string.substringof, "MyField", ["bc"]),
                    underscoreFilter = filter.toUnderscoreQuery();

                underscoreFilter.should.be.a.Function;
            });

            it("should allow array filtering", () => {
                var objs = [
                        { MyField: "abcdef" },
                        { MyField: "abc" },
                        { MyField: "def" },
                        { MyField: "bc" },
                    ],
                    filter = new query.FunctionFilter(query.string.substringof, "MyField", ["bc"]),
                    filtered = _.filter(objs, filter.toUnderscoreQuery());

                filtered.length.should.equal(3);

                filter.fn(query.string.startswith);
                filter.args(["abc"]);
                filtered = _.filter(objs, filter.toUnderscoreQuery());

                filtered.length.should.equal(2);

                filter.fn(query.string.indexof);
                filter.args(["def"]);
                filter.operator(query.operator.equal);
                filter.value(3);
                filtered = _.filter(objs, filter.toUnderscoreQuery());

                filtered.length.should.equal(1);
            });

        });

    });

    describe("Ordering", () => {

        describe("toQueryString", () => {

            it("should format ordering as OData standard", () => {
                var order = new query.Ordering("MyField"),
                    querystring = order.toQueryString();

                querystring.should.equal("MyField asc");
            });

            it("should add desc keywork when specified", () => {
                var order = new query.Ordering("MyField", false),
                    querystring = order.toQueryString();

                querystring.should.equal("MyField desc");
            });

        });

        describe("toSortFunction", () => {

            it("should return a function", () => {
                var order = new query.Ordering("MyField"),
                    underscoreOrder = order.toSortFunction();

                underscoreOrder.should.be.a.Function;
            });

            it("should allow array ordering", () => {
                var order = new query.Ordering("MyField"),
                    obj1 = { MyField: "d" },
                    objs = [
                        obj1,
                        { MyField: "a" },
                        { MyField: "c" },
                        { MyField: "e" },
                    ],
                    ordered = objs.sort(order.toSortFunction());

                _.indexOf(ordered, obj1).should.equal(2);

                order.ascending(false);
                ordered = objs.sort(order.toSortFunction());

                _.indexOf(ordered, obj1).should.equal(1);
            });

        });

    });

    describe("ODataQuery", () => {

        describe("toQueryString", () => {

            it("should add 'or' logical operator when specified", () => {
                var _query = new query.ODataQuery();
                _query.where("MyField", query.operator.equal, "abc")
                    .or()
                    .where("MyNumber", query.operator.greaterThan, 2)
                    .orderby("MyField")
                    .select("MyField", "MyNumber")
                    .expand("MyExpand");

                var querystring = _query.toQueryString();
                querystring.should.equal("$filter=MyField eq 'abc' or MyNumber gt 2&$select=MyField,MyNumber&$expand=MyExpand&$orderby=MyField asc");
            });

            it("should add 'and' logical operator nothing specified", () => {
                var _query = new query.ODataQuery();
                _query.where("MyField", query.operator.equal, "abc")
                    .where("MyNumber", query.operator.greaterThan, 2)
                    .orderby("MyField")
                    .select("MyField", "MyNumber")
                    .expand("MyExpand");

                var querystring = _query.toQueryString();
                querystring.should.equal("$filter=MyField eq 'abc' and MyNumber gt 2&$select=MyField,MyNumber&$expand=MyExpand&$orderby=MyField asc");
            });

        });

        describe("apply", () => {

            it("should accept 'or' logical operator", () => {
                var _query = new query.ODataQuery();
                _query.where("MyField", query.operator.equal, "abc")
                    .or()
                    .where("MyNumber", query.operator.greaterThan, 2)
                    .orderby("MyField").orderby("MyNumber");

                var obj1 = { MyField: "abc", MyNumber: 5 };
                var objs = [
                    obj1,
                    { MyField: "abc", MyNumber: 1 },
                    { MyField: "def", MyNumber: 3 },
                    { MyField: "ghi", MyNumber: 1 },
                    { MyField: "ijk", MyNumber: 0 }
                ];

                var result = _query.apply(objs);

                result.length.should.equal(3);
                _.indexOf(result, obj1).should.equal(1);
            });

            it("should accept 'and' logical operator", () => {
                var _query = new query.ODataQuery();
                _query.where("MyField", query.operator.equal, "abc")
                    .where("MyNumber", query.operator.greaterThan, 2)
                    .orderby("MyNumber");

                var obj1 = { MyField: "abc", MyNumber: 5 };
                var objs = [
                    obj1,
                    { MyField: "abc", MyNumber: 3 },
                    { MyField: "abc", MyNumber: 6 },
                    { MyField: "abc", MyNumber: 1 },
                    { MyField: "ijk", MyNumber: 0 }
                ];

                var result = _query.apply(objs);

                result.length.should.equal(3);
                _.indexOf(result, obj1).should.equal(1);
            });

        });

    });

});
