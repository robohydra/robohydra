var HydraHeadStatic = require('hydra').heads.HydraHeadStatic;

exports.getBodyParts = function(config) {
    return {
        name: "testBasic",
        tests: {
            firstTest: {
                heads: [
                    new HydraHeadStatic({path: '/bar',
                                         content: "fixed content"}),
                    new HydraHeadStatic({content: "more fixed content"})
                ]
            },
            secondTest: {
                heads: [
                    new HydraHeadStatic({path: '/foo',
                                         content: "fixed content"})
                ]
            }
        }
    };
};
