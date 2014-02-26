/// <reference path="../_definitions.d.ts" />
/// <reference path="../typings/mocha/mocha.d.ts" />
/// <reference path="../typings/should/should.d.ts" />
/// <reference path="../typings/sinon/sinon.d.ts" />

import ko = require("knockout");
import _ = require("underscore");
import promiseExt = require("promise/extensions");
import guidHelpers = require("./helpers/guid");

import guid = require("../src/guid");

describe("GUID", () => {

    describe("generate", () => {

        it("should return a valid GUID", () => {
            var value: string,
                i = 0;

            for (; i < 10; i++) {
                value = guid.generate();
                value.should.match(guidHelpers.guidRegex);
            }
        });

        it("should never return same GUID", () => {
            var values = [], value: string,
                i = 0;

            for (; i < 30; i++) {
                value = guid.generate();
                value.should.match(guidHelpers.guidRegex);

                values.should.not.containEql(value);
                values.push(value);
            }
        });

    });

    describe("generateTemp", () => {

        it("should return a valid GUID", () => {
            var value: string,
                i = 0;

            for (; i < 10; i++) {
                value = guid.generateTemp();
                value.should.match(guidHelpers.guidRegex);
            }
        });

        it("should never return same GUID", () => {
            var values = [], value: string,
                i = 0;

            for (; i < 30; i++) {
                value = guid.generateTemp();
                value.should.match(guidHelpers.guidRegex);

                values.should.not.containEql(value);
                values.push(value);
            }
        });

        it("should increment temp GUID", () => {
            var value: string,
                i = 0;

            for (; i < 10; i++) {
                value = guid.generateTemp();
                value.should.match(guidHelpers.guidRegex);

                value.should.endWith(i.toString());
            }
        });

    });

    describe("isGuid", () => {

        it("should return true if argument is a valid GUID", () => {
            guid.isGuid(guidHelpers.validGuid1).should.be.ok;
            guid.isGuid(guidHelpers.validGuid2).should.be.ok;
        });

        it("should return false if argument is an invalid GUID", () => {
            guid.isGuid(guidHelpers.invalidGuid1).should.not.be.ok;
            guid.isGuid(guidHelpers.invalidGuid2).should.not.be.ok;
        });

    });

    describe("isTemp", () => {

        it("should return true if argument is a valid temporary GUID", () => {
            guid.isGuid(guidHelpers.validTempGuid1).should.be.ok;
            guid.isGuid(guidHelpers.validTempGuid2).should.be.ok;
        });

        it("should return false if argument is an invalid temporary GUID", () => {
            guid.isGuid(guidHelpers.invalidTempGuid1).should.not.be.ok;
            //guid.isGuid(guidHelpers.invalidTempGuid2).should.not.be.ok;
        });

    });

});
