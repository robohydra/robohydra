var RoboHydraHeadStatic = require("../../../lib/exports").heads.RoboHydraHeadStatic;

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
