var path = require("path");
var heads                       = require("robohydra").heads,
    RoboHydraHeadFilesystem     = heads.RoboHydraHeadFilesystem,
    RoboHydraWebSocketHeadProxy = heads.RoboHydraWebSocketHeadProxy;

module.exports.getBodyParts = function() {
    return {
        heads: [
            new RoboHydraHeadFilesystem({
                name: 'static-files',
                mountPath: '/',
                documentRoot: path.join(__dirname, 'static')
            }),

            new RoboHydraWebSocketHeadProxy({
                name: 'ws-receiver',
                proxyTo: 'http://localhost:3000',
                preProcessor: function(data) {
                    if (new RegExp('php', 'i').test(data.toString())) {
                        return false;
                    }
                },
                postProcessor: function(data) {
                    return data.toUpperCase();
                }
            })
        ]
    };
};
