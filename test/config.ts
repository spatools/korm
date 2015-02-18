/// <reference path="../_definitions.d.ts" />
/// <reference path="../typings/requirejs/require.d.ts" />
/// <reference path="../typings/mocha/mocha.d.ts" />
/// <reference path="../typings/should/should.d.ts" />
/// <reference path="../typings/sinon/sinon.d.ts" />

requirejs.config({
    //baseUrl: "../",

    paths: {
        "jquery": "../bower_components/jquery/dist/jquery",
        "knockout": "../bower_components/knockoutjs/dist/knockout.debug",
        "knockout.mapping": "../bower_components/knockout.mapping/knockout.mapping",
        "underscore": "../bower_components/underscore/underscore",
        "moment": "../bower_components/moment/moment",
        "promise": "../bower_components/promise-ext/dist/promise",
        "koutils": "../bower_components/koutils/dist",

        "mocha": "../bower_components/mocha/mocha",
        "should": "../bower_components/should/should",
        "sinon": "../bower_components/sinon/lib/sinon"
    },

    shim: {
        moment: {
            exports: "moment"
        },
        mocha: {
            exports: "mocha"
        }
    }
});

(<any>window).console = window.console || function () { return; };
(<any>window).notrack = true;

var tests = [
    "guid",
    "query",
    "mapping"
];

require(tests, function () {
    mocha.run();
});
