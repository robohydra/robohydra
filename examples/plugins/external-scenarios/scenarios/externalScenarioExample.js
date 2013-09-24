var RoboHydraHead = require("robohydra").heads.RoboHydraHead;

exports.getBodyParts = function(conf, modules) {
    var fixtures = modules.fixtures;

    return {
        heads: [
            new RoboHydraHead({
                path: '/.*',
                handler: function(req, res) {
                    res.headers['content-type'] = 'image/png';
                    res.send(fixtures.load('/tada.png'));
                }
            })
        ]
    };
};
