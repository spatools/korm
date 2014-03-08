define(["require", "exports", "underscore", "koutils/utils", "koutils/underscore"], function(require, exports, _, utils) {
    var lastEmpty = 0, tempRegex = /00000000-0000-0000-0000-\d{12}/, guidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

    exports.empty = "00000000-0000-0000-0000-000000000000";

    function S4() {
        return utils.str_pad(Math.floor(Math.random() * 0x10000).toString(16), 4, "0");
    }

    function generate() {
        return (S4() + S4() + "-" + S4() + "-" + S4() + "-" + S4() + "-" + S4() + S4() + S4());
    }
    exports.generate = generate;

    function generateTemp() {
        return "00000000-0000-0000-0000-" + utils.str_pad((lastEmpty++).toString(), 12, "0");
    }
    exports.generateTemp = generateTemp;

    function generateMin() {
        var guid = exports.generate().split("-");
        return _.sum(guid, function (part) {
            return parseInt(part, 16);
        }).toString(16);
    }
    exports.generateMin = generateMin;

    function isGuid(guid) {
        return guidRegex.test(guid);
    }
    exports.isGuid = isGuid;

    function isTemp(guid) {
        return tempRegex.test(guid);
    }
    exports.isTemp = isTemp;
});
