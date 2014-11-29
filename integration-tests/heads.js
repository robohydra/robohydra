var RoboHydraHeadStatic = require("robohydra").heads.RoboHydraHeadStatic;

module.exports.passHead = new RoboHydraHeadStatic({
    path: '/foo',
    content: '\u001b[32mPASS\u001b[39m\n'
});

module.exports.failHead = new RoboHydraHeadStatic({
    path: '/foo',
    content: '\u001b[31mFAIL\u001b[39m\n'
});
