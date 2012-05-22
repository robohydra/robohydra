var hydra           = require('hydra'),
    HydraHeadStatic = hydra.heads.HydraHeadStatic,
    HydraHead       = hydra.heads.HydraHead;

exports.getBodyParts = function(config, modules) {
    var assert = modules.assert;

    return {
        name: "testBasic",
        tests: {
            firstTestFoo: {
                heads: [
                    new HydraHeadStatic({path: '/foo',
                                         content: "fixed content"}),
                    new HydraHeadStatic({content: "more fixed content"})
                ]
            },

            secondTestBar: {
                instructions: "Optional, Markdown format instructions.\n\n" +
                                "You can go to [/bar](/bar) for a failure, " +
                                "or to [/bar2](/bar2) for a pass. Then go " +
                                "back to " +
                                "[/hydra-admin/tests](/hydra-admin/tests) " +
                                "to see the results.",

                heads: [
                    new HydraHead({
                        path: '/bar',
                        handler: function(req, res) {
                            assert.equal(1, 1, "1 should be 1");
                            res.write("trying assertion...");
                            assert.equal(1, 0, "1 should be 0 (!)");
                            res.send("fixed content");
                        }
                    }),

                    new HydraHead({
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
