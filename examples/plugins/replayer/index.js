var fs = require('fs');
var robohydra          = require('robohydra'),
    RoboHydraHead      = robohydra.heads.RoboHydraHead,
    RoboHydraHeadProxy = robohydra.heads.RoboHydraHeadProxy,
    Response           = robohydra.Response;

exports.getBodyParts = function(config) {
    // Initialise the log file on RoboHydra start
    var trafficFilePath = config.trafficFilePath || 'robohydra-replayer.json';
    var trafficFileFd, currentTrafficData, index;

    return {heads: [
        new RoboHydraHead({
            name:    'startRecording',
            path:    '/start-recording',
            handler: function(req, res) {
                var rh = config.robohydra;
                var recorderHead = rh.findHead('replayer', 'recorder');
                if (! recorderHead.attached()) {
                    trafficFileFd = fs.openSync(trafficFilePath, 'w+');
                    currentTrafficData = [];
                    fs.writeSync(trafficFileFd,
                                 JSON.stringify(currentTrafficData));
                    if (rh.findHead('replayer', 'replayer').attached()) {
                        rh.detachHead('replayer', 'replayer');
                    }
                    rh.attachHead('replayer', 'recorder');
                }
                res.end();
            }
        }),

        new RoboHydraHead({
            name:    'startReplaying',
            path:    '/start-replaying',
            handler: function(req, res) {
                var rh = config.robohydra;
                var replayerHead = rh.findHead('replayer', 'replayer');
                if (! replayerHead.attached()) {
                    currentTrafficData =
                        JSON.parse(fs.readFileSync(trafficFilePath));
                    index = 0;
                    if (rh.findHead('replayer', 'recorder').attached()) {
                        rh.detachHead('replayer', 'recorder');
                    }
                    rh.attachHead('replayer', 'replayer');
                }
                res.end();
            }
        }),

        new RoboHydraHead({
            name:    'recorder',
            path:    '/.*',
            detached: true,
            handler: function(req, res, next) {
                next(req, new Response(
                    function() {
                        // Collect the responses in a variable and
                        // overwrite the traffic file every time
                        currentTrafficData.push({
                            statusCode: this.statusCode,
                            headers: this.headers,
                            body: this.body.toString('base64')
                        });
                        fs.writeSync(trafficFileFd,
                                     JSON.stringify(currentTrafficData),
                                     0);

                        // Forward the original response as is
                        res.forward(this);
                    }
                ));
            }
        }),

        new RoboHydraHead({
            name:    'replayer',
            path:    '/.*',
            detached: true,
            handler: function(req, res, next) {
                next(req, new Response(
                    function() {
                        var currentResponse = currentTrafficData[index];
                        index = ((index + 1) % currentTrafficData.length);
                        res.statusCode = currentResponse.statusCode;
                        res.headers    = currentResponse.headers;
                        res.send(new Buffer(currentResponse.body, 'base64'));
                    }
                ));
            }
        }),

        new RoboHydraHeadProxy({
            mountPath: '/',
            proxyTo: 'http://hcoder.org'
        })
    ]};
};
