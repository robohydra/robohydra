var heads               = require("robohydra").heads,
    RoboHydraHead       = heads.RoboHydraHead,
    RoboHydraHeadStatic = heads.RoboHydraHeadStatic;

exports.getBodyParts = function(conf, modules) {
    var fixtures = modules.fixtures;

    return {
        heads: [
            new RoboHydraHeadStatic({
                name: 'index',
                path: '/',
                contentType: 'text/html',
                content: 'Fixture loading examples: <ul>' +
                    '<li><a href="relative">Relative path</a></li>' +
                    '<li><a href="absolute">Absolute path</a></li>' +
                    '</ul>'
            }),

            new RoboHydraHead({
                name: 'example-relative',
                path: '/relative',
                handler: function(req, res) {
                    res.headers['content-type'] = 'image/png';
                    res.send(fixtures.load('tada.png'));
                }
            }),

            new RoboHydraHead({
                name: 'example-absolute',
                path: '/absolute',
                handler: function(req, res) {
                    res.send(fixtures.load('/etc/passwd'));
                }
            })
        ]
    };
};
