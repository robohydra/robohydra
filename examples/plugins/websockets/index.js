var heads                   = require("robohydra").heads,
    RoboHydraHead           = heads.RoboHydraHead,
    RoboHydraWebSocketHead  = heads.RoboHydraWebSocketHead,
    RoboHydraHeadFilesystem = heads.RoboHydraHeadFilesystem;

module.exports.getBodyParts = function() {
    var socket;

    return {
        heads: [
            new RoboHydraHead({
                name: 'message-sender',
                path: '/send-message',
                handler: function(req, res) {
                    var msg = req.queryParams.message || 'Default message';
                    if (socket) {
                        socket.send(msg);
                        res.send('Sent message');
                    } else {
                        res.send('Do not have any websocket yet');
                    }
                }
            }),

            new RoboHydraHeadFilesystem({
                name: 'static-files',
                mountPath: '/',
                documentRoot: 'examples/websockets'
            })
        ],

        webSocketHeads: [
            new RoboHydraWebSocketHead({
                path: '/.*',
                handler: function(req, sock) {
                    console.log("Hey, I received a connection from URL path " + req.url);

                    sock.send('test data');
                    sock.on('message', function(msg) {
                        console.log("Received mesage " + msg);
                        sock.send("Received '" + msg + "' from the client");
                    });
                    sock.on('error', function() {
                        console.log("Closed connection, boohoo!");
                    });

                    socket = sock;
                }
            })
        ]
    };
};
