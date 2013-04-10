var RoboHydraHeadStatic = require("robohydra").heads.RoboHydraHeadStatic;

exports.getBodyParts = function(conf) {
    "use strict";

    return {
        heads: [
            new RoboHydraHeadStatic({
                name: conf.path,
                path: '/.*',
                content: 'Simple test plugin'
            }),

            new RoboHydraHeadStatic({
                name: conf.configKey,
                path: '/conf/configKey',
                content: conf.configKey || 'empty'
            })
        ]
    };
};
