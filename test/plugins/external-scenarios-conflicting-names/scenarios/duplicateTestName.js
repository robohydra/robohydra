var RoboHydraHeadStatic = require("../../../../lib/exports").heads.RoboHydraHeadStatic;

exports.getBodyParts = function() {
    return {
        heads: [
            new RoboHydraHeadStatic({
                path: '/test',
                content: "External test"
            })
        ]
    };
};
