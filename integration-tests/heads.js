var heads               = require("robohydra").heads,
    RoboHydraHeadStatic = heads.RoboHydraHeadStatic,
    RoboHydraHead       = heads.RoboHydraHead;

var passString = '\u001b[32mPASS\u001b[39m\n',
    failString = '\u001b[31mFAIL\u001b[39m\n';

module.exports.passHead = new RoboHydraHeadStatic({
    path: '/foo',
            content: passString
});

module.exports.failHead = new RoboHydraHeadStatic({
    path: '/foo',
    content: failString
});

module.exports.varHeadForConf = function(conf) {
    return new RoboHydraHead({
        path: '/foo',
        handler: function(req, res) {
            if (conf.result === 'pass') {
                res.send(passString);
            } else {
                res.send(failString);
            }
        }
    });
};
