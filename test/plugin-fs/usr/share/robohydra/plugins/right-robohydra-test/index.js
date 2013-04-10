var RoboHydraHeadStatic = require("robohydra").heads.RoboHydraHeadStatic;

exports.getBodyParts = function() {
    "use strict";

    return {
        heads: [
            new RoboHydraHeadStatic({
                content: "Default content"
            })
        ],

        tests: {
            robohydra1: {
                heads: [
                    new RoboHydraHeadStatic({
                        content: "This is RoboHydra 1"
                    })
                ]
            },

            robohydra2: {
                heads: [
                    new RoboHydraHeadStatic({
                        content: "This is RoboHydra 2"
                    })
                ]
            }
        }
    };
};

exports.getSummonerTraits = function() {
    "use strict";

    return {
        robohydraPicker: function(req) {
            return req.queryParams.user || "default-user";
        }
    };
};
