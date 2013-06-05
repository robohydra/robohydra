var RoboHydraHeadStatic = require("robohydra").heads.RoboHydraHeadStatic;

exports.getBodyParts = function() {
    "use strict";

    return {
        heads: [
            new RoboHydraHeadStatic({
                path: '/.*',
                content: "External tests"
            })
        ]
    };
};
