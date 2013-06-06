var heads              = require('robohydra').heads,
    RoboHydraHead      = heads.RoboHydraHead,
    RoboHydraHeadProxy = heads.RoboHydraHeadProxy;

exports.getBodyParts = function(config) {
    "use strict";

    var delay = 1000;
    var proxyTo = config.proxyto || 'http://robohydra.org';

    return {
        heads: [
            new RoboHydraHead({
                name: 'delay-configurer',
                path: '/configure-delay/:millis',
                handler: function(req, res) {
                    delay = parseInt(req.params.millis, 10) || 0;
                    res.send("Delay set to " + delay + " milliseconds");
                }
            }),

            new RoboHydraHead({
                name: 'delayer',
                path: '/.*',
                handler: function(req, res, next) {
                    // The 'next' parameter is a function that will
                    // dispatch the given request with any head below
                    // ourselves. In this case, we provide the same
                    // response so we automatically respond with
                    // whatever the other head responded with
                    setTimeout(function() {
                        next(req, res);
                    }, delay);
                }
            }),

            new RoboHydraHeadProxy({
                name: 'proxy',
                mountPath: '/',
                proxyTo: proxyTo,
                setHostHeader: true
            })
        ]
    };
};
