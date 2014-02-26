/// <reference path="../_definitions.d.ts" />
/// <reference path="../typings/mocha/mocha.d.ts" />
/// <reference path="../typings/should/should.d.ts" />
/// <reference path="../typings/sinon/sinon.d.ts" />

import ko = require("knockout");
import _ = require("underscore");
import promiseExt = require("promise/extensions");
import utils = require("koutils/utils");

import common = require("./common");
import guidHelpers = require("./helpers/guid");
import mapping = require("../src/mapping");

describe("Mapping", () => {

    describe("getMappingConfiguration", () => {

        it("should return a mapping Configuration object if given configuration exists", () => {
            var child = new common.models.Child(),
                childConf = mapping.getMappingConfiguration(child, common.datacontext.getSet("Childs")),
                defaultConf = mapping.getMappingConfiguration(null, common.datacontext.getSet("Childs"));

            childConf.should.be.instanceof(mapping.Configuration);
            defaultConf.should.be.instanceof(mapping.Configuration);
        });

        it("should accepts multiple configuration per data sets", () => {
            var child = new common.models.Child(),
                derived = new common.models.ChildDerived(),

                childConf = mapping.getMappingConfiguration(child, common.datacontext.getSet("Childs")),
                derivedConf = mapping.getMappingConfiguration(derived, common.datacontext.getSet("Childs")),
                defaultConf = mapping.getMappingConfiguration(null, common.datacontext.getSet("Childs"));

            childConf.should.be.instanceof(mapping.Configuration);
            derivedConf.should.be.instanceof(mapping.Configuration);
            defaultConf.should.be.instanceof(mapping.Configuration);

            childConf.should.equal(defaultConf);
            derivedConf.should.not.equal(defaultConf);
        });

    });

    describe("addMappingProperties", () => {

        it("should add common mapping properties to given object", () => {
            var dataset = common.datacontext.getSet<common.models.Parent, string>("Parents"),
                parent = new common.models.Parent();

            mapping.addMappingProperties(parent, dataset);

            parent.should.have.property("EntityState");
            parent.should.have.property("IsSubmitting");
            parent.should.have.property("ChangeTracker");
            parent.should.have.property("HasChanges");
        });

        it("should add a property for each relations configured on given object", () => {
            var dataset = common.datacontext.getSet<common.models.Parent, string>("Parents"),
                parent = new common.models.Parent();

            mapping.addMappingProperties(parent, dataset);

            parent.should.have.property("Children");
            parent.should.have.property("Foreign");
        });

        it("should add a property for each actions configured on given object", () => {
            var dataset = common.datacontext.getSet<common.models.Parent, string>("Parents"),
                parent = new common.models.Parent();

            mapping.addMappingProperties(parent, dataset);

            parent.should.have.property("TestAction");
        });

        it("should throw if mapping has already be processed on given object", () => {
            var dataset = common.datacontext.getSet<common.models.Parent, string>("Parents"),
                parent = new common.models.Parent();

            mapping.addMappingProperties(parent, dataset);

            (() => mapping.addMappingProperties(parent, dataset)).should.throw();
        });

    });

    describe("refreshRelations", () => {

        it("should refresh one 2 many relations configured on given object", (done) => {
            var dataset = common.datacontext.getSet<common.models.Parent, string>("Parents");

            common.initDataContext()
                .then(() => dataset.load(common.getFirstParentId()))
                .then(parent => mapping.refreshRelations(parent, dataset))
                .then(parent => {
                    ko.isSubscribable(parent.Children).should.be.ok;
                    parent.Children.size().should.equal(6);
                    done();
                })
                .catch(done);
        });

        it("should refresh many 2 one relations configured on given object", (done) => {
            var dataset = common.datacontext.getSet<common.models.Parent, string>("Parents");

            common.initDataContext()
                .then(() => dataset.load(common.getFirstParentId()))
                .then(parent => mapping.refreshRelations(parent, dataset))
                .then(parent => {
                    ko.isSubscribable(parent.Foreign).should.be.ok;

                    var foreign = parent.Foreign();
                    foreign.should.not.be.undefined;
                    foreign.ForeignId().should.equal(parent.ForeignId());

                    done();
                })
                .catch(done);
        });

    });

    describe("updateEntity", () => {

        it("should update object with given values", (done) => {
            var dataset = common.datacontext.getSet<common.models.Parent, string>("Parents"),
                update = { Title: "Test" };

            common.initDataContext()
                .then(() => dataset.load(common.getFirstParentId()))
                .then(parent => mapping.updateEntity(parent, update, false, false, true, dataset))
                .then(parent => {
                    parent.Title().should.equal("Test");
                    done();
                })
                .catch(done);
        });

        it("should let EntityState to unchanged if commit is set to false", (done) => {
            var dataset = common.datacontext.getSet<common.models.Parent, string>("Parents"),
                update = { Title: "Test" };

            common.initDataContext()
                .then(() => dataset.load(common.getFirstParentId()))
                .then(parent => mapping.updateEntity(parent, update, false, false, true, dataset))
                .then(parent => {
                    parent.Title().should.equal("Test");
                    parent.EntityState().should.equal(mapping.entityStates.unchanged);
                    done();
                })
                .catch(done);
        });

        it("should change EntityState to modified if commit is set to true", (done) => {
            var dataset = common.datacontext.getSet<common.models.Parent, string>("Parents"),
                update = { Title: "Test" };

            common.initDataContext()
                .then(() => dataset.load(common.getFirstParentId()))
                .then(parent => mapping.updateEntity(parent, update, true, true, true, dataset))
                .then(parent => {
                    parent.Title().should.equal("Test");
                    parent.EntityState().should.equal(mapping.entityStates.modified);
                    done();
                })
                .catch(done);
        });

        it("should change apply updates to expanded properties as well", (done) => {
            var dataset = common.datacontext.getSet<common.models.Parent, string>("Parents"),
                update = { Title: "Test2", Foreign: { ForeignId: "ecb69146-7a18-443d-9270-787d59db3794", Index: 12 } };

            common.initDataContext()
                .then(() => dataset.load(common.getFirstParentId()))
                .then(parent => mapping.updateEntity(parent, update, true, true, true, dataset))
                .then(parent => {
                    parent.Title().should.equal("Test2");
                    parent.Foreign().Index().should.equal(12);
                    done();
                })
                .catch(done);
        });

    });

    describe("duplicateEnty", () => {

        it("should return an object with a different pointer", (done) => {
            var dataset = common.datacontext.getSet<common.models.Parent, string>("Parents");
            common.initDataContext()
                .then(() => dataset.load(common.getFirstParentId()))
                .then(parent => {
                    var duplicated = mapping.duplicateEntity(parent, dataset);
                    //parent.should.not.equal(duplicated); take 4500 ms ??
                    (parent === duplicated).should.not.be.ok;
                    done();
                })
                .catch(done);
        });

        it("should return a copy of given object", (done) => {
            var dataset = common.datacontext.getSet<common.models.Parent, string>("Parents");

            common.initDataContext()
                .then(() => dataset.load(common.getFirstParentId()))
                .then(parent => {
                    var duplicated = mapping.duplicateEntity(parent, dataset);
                    duplicated.Title().should.equal(parent.Title());
                    duplicated.ForeignId().should.equal(parent.ForeignId());
                    done();
                })
                .catch(done);
        });

        it("should return an object with a different key", (done) => {
            var dataset = common.datacontext.getSet<common.models.Parent, string>("Parents");

            common.initDataContext()
                .then(() => dataset.load(common.getFirstParentId()))
                .then(parent => {
                    var duplicated = mapping.duplicateEntity(parent, dataset);
                    dataset.getKey(parent).should.not.equal(dataset.getKey(duplicated));
                    done();
                })
                .catch(done);
        });

    });

    describe("resetEntity", () => {

        it("should reset entity entity to its previous known state", (done) => {
            var dataset = common.datacontext.getSet<common.models.Parent, string>("Parents");

            common.initDataContext()
                .then(() => dataset.load(common.getFirstParentId()))
                .then(parent => {
                    parent.Title("Update");
                    parent.HasChanges().should.be.ok;
                    parent.EntityState().should.equal(mapping.entityStates.modified);

                    mapping.resetEntity(parent, dataset);

                    parent.Title().should.equal("Parent #0");
                    parent.HasChanges().should.not.be.ok;
                    parent.EntityState().should.equal(mapping.entityStates.unchanged);

                    done();
                })
                .catch(done);
        });

    });

    describe("mapEntityFromJS", () => {

        it("should create an object of the good type", (done) => {
            var dataset = common.datacontext.getSet<common.models.Parent, string>("Parents");

            common.initDataContext()
                .then(() => {
                    common.datacontext.reset();

                    var parentJSON = { ParentId: "ecb9b558-e597-467c-876e-cf1cb3b26ae5", Title: "Parent #1", ForeignId: "" },
                        childSON = { ChildId: "045dcb64-c328-48d2-8be2-0d895da2ed55", Content: "Child #2", ParentId: "" },
                        derivedJSON = { "odata.type": "SPATools.Models.ChildDerived", ChildId: "c0be0988-1e06-49c0-baec-21570a12b718", Content: "DerivedChild #0", Date: new Date().toJSON(), ParentId: "" };

                    return Promise.all<any>([
                        mapping.mapEntityFromJS(parentJSON, mapping.entityStates.unchanged, false, true, common.datacontext.getSet("Parents")),
                        mapping.mapEntityFromJS(childSON, mapping.entityStates.unchanged, false, true, common.datacontext.getSet("Childs")),
                        mapping.mapEntityFromJS(derivedJSON, mapping.entityStates.unchanged, false, true, common.datacontext.getSet("Childs"))
                    ]);
                })
                .then(entities => {
                    entities[0].should.be.instanceof(common.models.Parent);
                    entities[1].should.be.instanceof(common.models.Child);
                    entities[2].should.be.instanceof(common.models.ChildDerived);
                    done();
                })
                .catch(done);
        });

        it("should add mapping properties to given object", (done) => {
            var dataset = common.datacontext.getSet<common.models.Parent, string>("Parents");

            common.initDataContext()
                .then(() => {
                    common.datacontext.reset();

                    var parentJSON = { ParentId: "ecb9b558-e597-467c-876e-cf1cb3b26ae5", Title: "Parent #1", ForeignId: "" };
                    return mapping.mapEntityFromJS(parentJSON, mapping.entityStates.unchanged, false, true, common.datacontext.getSet("Parents"));
                })
                .then(parent => {
                    parent.should.have.property("EntityState");
                    parent.should.have.property("IsSubmitting");
                    parent.should.have.property("ChangeTracker");
                    parent.should.have.property("HasChanges");

                    done();
                })
                .catch(done);
        });

        it("should add relation and actions properties to given object", (done) => {
            var dataset = common.datacontext.getSet<common.models.Parent, string>("Parents");

            common.initDataContext()
                .then(() => {
                    common.datacontext.reset();

                    var parentJSON = { ParentId: "ecb9b558-e597-467c-876e-cf1cb3b26ae5", Title: "Parent #1", ForeignId: "" };
                    return mapping.mapEntityFromJS(parentJSON, mapping.entityStates.unchanged, false, true, common.datacontext.getSet("Parents"));
                })
                .then(parent => {
                    parent.should.have.property("Children");
                    parent.should.have.property("Foreign");
                    parent.should.have.property("TestAction");

                    done();
                })
                .catch(done);
        });

    });

    describe("mapEntityToJS", () => {

        it("should remove mapping properties from given object", (done) => {
            var dataset = common.datacontext.getSet<common.models.Parent, string>("Parents");

            common.initDataContext()
                .then(() => dataset.load(common.getFirstParentId()))
                .then(parent => {
                    var obj = mapping.mapEntityToJS(parent, false, dataset);

                    obj.should.not.have.property("EntityState");
                    obj.should.not.have.property("IsSubmitting");
                    obj.should.not.have.property("ChangeTracker");
                    obj.should.not.have.property("HasChanges");

                    done();
                })
                .catch(done);
        });

        it("should remove relation and actions properties from given object", (done) => {
            var dataset = common.datacontext.getSet<common.models.Parent, string>("Parents");

            common.initDataContext()
                .then(() => dataset.load(common.getFirstParentId()))
                .then(parent => {
                    var obj = mapping.mapEntityToJS(parent, false, dataset);

                    obj.should.not.have.property("Children");
                    obj.should.not.have.property("Foreign");
                    obj.should.not.have.property("TestAction");

                    done();
                })
                .catch(done);
        });

        it("should keep EntityState property if keepState argument is set to true", (done) => {
            var dataset = common.datacontext.getSet<common.models.Parent, string>("Parents");

            common.initDataContext()
                .then(() => dataset.load(common.getFirstParentId()))
                .then(parent => {
                    var obj = mapping.mapEntityToJS(parent, true, dataset);

                    obj.should.have.property("EntityState", mapping.entityStates.unchanged);

                    done();
                })
                .catch(done);
        });

    });

});
