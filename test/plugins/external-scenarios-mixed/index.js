var RoboHydraHeadStatic = require("robohydra").heads.RoboHydraHeadStatic;

exports.getBodyParts = function() {
    "use strict";

    return {
        heads: [
            new RoboHydraHeadStatic({
                path: '/.*',
                content: "Internal and external tests"
            })
        ],

        scenarios: {
            internal: {
                heads: [
                    new RoboHydraHeadStatic({
                        path: '/test',
                        content: "Internal test"
                    })
                ]
            }
        }
    };
};
