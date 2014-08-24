var heads               = require("robohydra").heads,
    RoboHydraHead       = heads.RoboHydraHead,
    RoboHydraHeadStatic = heads.RoboHydraHeadStatic;

exports.getBodyParts = function() {
    return {
        heads: [
            new RoboHydraHeadStatic({
                path: '/test',
                hostname: 'example.com',
                content: 'You have actually made example.com point to the machine running RoboHydra, wow!\n'
            }),

            new RoboHydraHeadStatic({
                path: '/test',
                method: ['GET', 'OPTIONS'],
                content: 'This is a GET request, or an OPTIONS request.\n'
            }),

            new RoboHydraHeadStatic({
                path: '/test',
                method: 'POST',
                content: 'This is a POST request!\n'
            }),

            new RoboHydraHead({
                path: '/test',
                handler: function(req, res) {
                    res.send("This is neither GET, POST or OPTIONS. " +
                                 "It's actually '" + req.method + "'\n");
                }
            })
        ]
    };
};
