/// <reference path="typings/knockout/knockout.d.ts" />
/// <reference path="typings/knockout.mapping/knockout.mapping.d.ts" />
/// <reference path="typings/underscore/underscore.d.ts" />
/// <reference path="typings/moment/moment.d.ts" />
/// <reference path="typings/requirejs/require.d.ts" />
/// <reference path="bower_components/koutils/dist/koutils.d.ts" />
/// <reference path="bower_components/kounderscore/dist/kounderscore.d.ts" />
/// <reference path="bower_components/promizr/promise.d.ts" />
/// <reference path="bower_components/promizr/promizr.d.ts" />

interface IDBEvent extends Event {
    target: IDBEventTarget;
}

interface IDBEventTarget extends EventTarget {
    result: any;
}

interface IDBVersionChangeEvent {
    target: IDBVersionChangeEventTarget;
}

interface IDBVersionChangeEventTarget extends IDBEventTarget {
    transaction?: IDBTransaction;
}
