var RoboHydraHeadStatic = require("robohydra").heads.RoboHydraHeadStatic;

exports.getBodyParts = function(conf) {
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
                content: conf.configKey
            })
        ]
    };
};
