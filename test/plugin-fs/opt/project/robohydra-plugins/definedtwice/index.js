var RoboHydraHeadStatic = require("../../../../../../lib/exports").heads.RoboHydraHeadStatic;

exports.getBodyParts = function(conf) {
    return {
        heads: [
            new RoboHydraHeadStatic({
                name: conf.path,
                path: '/.*',
                content: '/opt/project version'
            })
        ]
    };
};
