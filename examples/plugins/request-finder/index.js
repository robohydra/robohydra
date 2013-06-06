var heads                 = require('robohydra').heads,
    RoboHydraHeadWatchdog = heads.RoboHydraHeadWatchdog,
    RoboHydraHeadProxy    = heads.RoboHydraHeadProxy;

exports.getBodyParts = function(config) {
    "use strict";

    var searchTerm = config.searchTerm || 'linux';

    return {
        heads: [
            new RoboHydraHeadWatchdog({
                // Note that res.body is always uncompressed, even if
                // the original response was compressed. If you really
                // want the original body, try "res.rawBody".
                watcher: function(req, res) {
                    return new RegExp(searchTerm).test(res.body);
                /* },
                reporter: function(req, res) {
                    console.warn("XXXXXXXXXXXXXXXXXXXXXXXXXXXXX");
                    console.warn("Response for request to " + req.url + " contained " + searchTerm);
                    console.warn("XXXXXXXXXXXXXXXXXXXXXXXXXXXXX");*/
                }
            }),

            new RoboHydraHeadProxy({
                mountPath: '/',
                proxyTo: 'http://www.opera.com',
                setHostHeader: true
            })
        ]
    };
};
