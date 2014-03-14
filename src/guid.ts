/// <reference path="../_definitions.d.ts" />
/// <amd-dependency path="koutils/underscore" />

import _ = require("underscore");
import utils = require("koutils/utils");

var lastEmpty = 0,
    tempRegex = /00000000-0000-0000-0000-\d{12}/,
    guidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export var empty = "00000000-0000-0000-0000-000000000000";

function S4(): string {
    return utils.str_pad(Math.floor(Math.random() * 0x10000 /* 65536 */ ).toString(16), 4, "0");
}

export function generate(): string {
    return (S4() + S4() + "-" + S4() + "-" + S4() + "-" + S4() + "-" + S4() + S4() + S4());
}

export function generateTemp(): string {
    return "00000000-0000-0000-0000-" + utils.str_pad((lastEmpty++).toString(), 12, "0");
}


export function generateMin(): string {
    return Math.floor(Math.random() * 3656158440062975).toString(36); // 10 character uuid 3656158440062975 = 36^10 - 1
}

export function isGuid(guid: string): boolean {
    return guidRegex.test(guid);
}

export function isTemp(guid: string): boolean {
    return tempRegex.test(guid);
}
