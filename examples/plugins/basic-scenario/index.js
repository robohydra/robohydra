var heads               = require('robohydra').heads,
    RoboHydraHeadStatic = heads.RoboHydraHeadStatic,
    RoboHydraHead       = heads.RoboHydraHead;

exports.getBodyParts = function(config, modules) {
    "use strict";

    var assert = modules.assert;

    return {
        scenarios: {
            "simple, assertion-less scenario test": {
                heads: [
                    new RoboHydraHeadStatic({path: '/foo',
                                             content: "fixed content"}),
                    new RoboHydraHeadStatic({content: "more fixed content"})
                ]
            },

            "check user goes to /bar2 instead of /bar": {
                instructions: "Optional, Markdown format instructions.\n\n" +
                                "You can go to [/bar](/bar) for a failure, " +
                                "or to [/bar2](/bar2) for a pass. Then go " +
                                "back to " +
                                "[/robohydra-admin/scenarios]" +
                                "(/robohydra-admin/scenarios) to see the " +
                                "results.",

                heads: [
                    new RoboHydraHead({
                        path: '/bar',
                        handler: function(req, res) {
                            assert.equal(1, 1, "1 should be 1");
                            res.write("trying assertion...");
                            assert.equal(1, 0, "1 should be 0 (!)");
                            res.send("fixed content");
                        }
                    }),

                    new RoboHydraHead({
                        path: '/bar2',
                        handler: function(req, res) {
                            assert.equal(1, 1, "1 should be 1 (still)");
                            res.send("always works");
                        }
                    })
                ]
            }
        }
    };
};
