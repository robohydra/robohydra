var RoboHydraHeadStatic = require("robohydra").heads.RoboHydraHeadStatic;

exports.getBodyParts = function(conf) {
    return {
        heads: [
            new RoboHydraHeadStatic({
                name: conf.path,
                path: '/.*',
                content: '/opt version'
            })
        ]
    };
};
