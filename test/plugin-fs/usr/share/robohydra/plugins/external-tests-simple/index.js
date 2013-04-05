var RoboHydraHeadStatic = require("robohydra").heads.RoboHydraHeadStatic;

exports.getBodyParts = function() {
    return {
        heads: [
            new RoboHydraHeadStatic({
                path: '/.*',
                content: "External tests"
            })
        ]
    };
};
