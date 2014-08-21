var robohydra     = require("robohydra"),
    heads         = robohydra.heads,
    RoboHydraHead = heads.RoboHydraHead;

exports.getBodyParts = function(conf) {
    "use strict";

    var delayMilliseconds = conf.delaymillis || 2000,
        delayPath = conf.delaypath || '/.*';

    conf.robohydra.registerDynamicHead(new RoboHydraHead({
        name: 'delayer',
        path: delayPath,
        handler: function(req, res, next) {
            setTimeout(function() {
                next(req, res);
            }, delayMilliseconds);
        }
    }));

    return {
        heads: [
            new RoboHydraHead({
                name: 'delayer-config',
                path: '/robohydra-admin/delay/:delayValue',
                handler: function(req, res) {
                    delayMilliseconds = parseInt(req.params.delayValue, 10);
                    res.send("Delay is now set to " + delayMilliseconds +
                                 " milliseconds");
                }
            })
        ]
    };
};
