var RoboHydraHead = require("robohydra").heads.RoboHydraHead;

exports.getBodyParts = function(conf, modules) {
    var fixtures = modules.fixtures;

    return {
        heads: [
            new RoboHydraHead({
                path: '/external-test-fixture',
                handler: function(req, res) {
                    res.send(fixtures.load('basic.txt'));
                }
            })
        ]
    };
};
