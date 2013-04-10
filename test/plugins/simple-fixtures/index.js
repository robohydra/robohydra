var RoboHydraHead = require("robohydra").heads.RoboHydraHead;

exports.getBodyParts = function(conf, modules) {
    var fixtures = modules.fixtures;

    return {
        heads: [
            new RoboHydraHead({
                path: '/fixtures/:fixtureid',
                handler: function(req, res) {
                    res.send(fixtures.load(req.params.fixtureid));
                }
            }),

            new RoboHydraHead({
                path: '/relative-directory-fixture',
                handler: function(req, res) {
                    res.send(fixtures.load(
                        "../../../../../../../../../../../../../etc/passwd"));
                }
            }),

            new RoboHydraHead({
                path: '/absolute-directory-fixture',
                handler: function(req, res) {
                    res.send(fixtures.load("/etc/passwd"));
                }
            })
        ]
    };
};
