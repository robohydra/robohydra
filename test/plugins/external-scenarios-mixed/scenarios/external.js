var RoboHydraHeadStatic = require("robohydra").heads.RoboHydraHeadStatic;

exports.getBodyParts = function() {
    return {
        instructions: "This is an external test. It doesn't do much, really",

        heads: [
            new RoboHydraHeadStatic({
                path: '/.*',
                content: "External test"
            })
        ]
    };
};
