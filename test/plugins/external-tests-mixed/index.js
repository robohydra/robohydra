var RoboHydraHeadStatic = require("robohydra").heads.RoboHydraHeadStatic;

exports.getBodyParts = function() {
    return {
        heads: [
            new RoboHydraHeadStatic({
                path: '/.*',
                content: "Internal and external tests"
            })
        ],

        tests: {
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
