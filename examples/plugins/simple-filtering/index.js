var heads               = require('robohydra').heads,
    RoboHydraHeadProxy  = heads.RoboHydraHeadProxy,
    RoboHydraHeadFilter = heads.RoboHydraHeadFilter;

exports.getBodyParts = function() {
    "use strict";

    return {
        heads: [
            new RoboHydraHeadFilter({
                // path: '/.*',            // Already the default
                filter: function(body) {
                    return body.toString().replace(
                        new RegExp('developers', 'g'),
                        "DEVELOPERS, DEVELOPERS, DEVELOPERS, DEVELOPERS"
                    );
                }
            }),

            new RoboHydraHeadProxy({
                mountPath: '/',
                proxyTo: 'http://dev.opera.com',
                setHostHeader: true
            })
        ]
    };
};
