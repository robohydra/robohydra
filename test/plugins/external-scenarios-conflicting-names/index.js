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
            duplicateTestName: {
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
