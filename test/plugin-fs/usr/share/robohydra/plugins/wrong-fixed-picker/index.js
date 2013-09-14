var RoboHydraHeadStatic = require("robohydra").heads.RoboHydraHeadStatic;

exports.getBodyParts = function() {
    "use strict";

    return {
        heads: [
            new RoboHydraHeadStatic({
                content: "Default content"
            })
        ]
    };
};

exports.getSummonerTraits = function() {
    "use strict";

    return {
        hydraPicker: "fixed (wrong)"
    };
};
