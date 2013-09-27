var fs = require('fs');
var robohydra          = require('robohydra'),
    RoboHydraHead      = robohydra.heads.RoboHydraHead,
    RoboHydraHeadProxy = robohydra.heads.RoboHydraHeadProxy,
    Response           = robohydra.Response;

exports.getBodyParts = function(config) {
    "use strict";

    var proxyToUrl = config.replayerurl || 'http://robohydra.org';
    // Initialise the log file on RoboHydra start
    var trafficFilePath = config.trafficFilePath || 'robohydra-replayer.json';
    var trafficFileFd, currentTrafficData, indexForUrl;

    return {heads: [
        new RoboHydraHead({
            name:    'startRecording',
            path:    '/start-recording',
            handler: function(req, res) {
                var rh = config.robohydra;
                var recorderHead = rh.findHead('replayer', 'recorder');
                if (! recorderHead.attached()) {
                    trafficFileFd = fs.openSync(trafficFilePath, 'w+');
                    currentTrafficData = {};
                    fs.writeSync(trafficFileFd,
                                 JSON.stringify(currentTrafficData));
                    if (rh.findHead('replayer', 'replayer').attached()) {
                        rh.detachHead('replayer', 'replayer');
                    }
                    rh.attachHead('replayer', 'recorder');
                }
                res.headers['content-type'] = 'text/html';
                res.send('<h1>Record mode started</h1>' +
                         'From now on, all traffic will be recorded in "' +
                         trafficFilePath + '". ' +
                         "When you're done you can replay that traffic " +
                         'by visiting ' +
                         '<a href="/start-replaying">/start-replaying</a>.');
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
                    indexForUrl = {};
                    if (rh.findHead('replayer', 'recorder').attached()) {
                        rh.detachHead('replayer', 'recorder');
                    }
                    rh.attachHead('replayer', 'replayer');
                }
                res.headers['content-type'] = 'text/html';
                res.send('<h1>Replay mode started</h1>' +
                         'From now on, this RoboHydra server will respond ' +
                         'with traffic from "' + trafficFilePath + '" ' +
                         'instead of real traffic from ' +
                         proxyToUrl + '.');
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
                        currentTrafficData[req.url] =
                            currentTrafficData[req.url] || [];
                        currentTrafficData[req.url].push({
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
            handler: function(req, res) {
                var urlResponses = currentTrafficData[req.url];
                if (urlResponses) {
                    var index = indexForUrl[req.url] || 0;
                    var currentResponse =
                            currentTrafficData[req.url][index];
                    indexForUrl[req.url] =
                        ((index + 1) %
                         currentTrafficData[req.url].length);
                    res.statusCode = currentResponse.statusCode;
                    res.headers    = currentResponse.headers;
                    res.send(new Buffer(currentResponse.body,
                                        'base64'));
                } else {
                    res.statusCode = 404;
                    res.send(new Buffer("Not Found", "utf-8"));
                }
            }
        }),

        new RoboHydraHeadProxy({
            name: 'proxy',
            mountPath: '/',
            proxyTo: proxyToUrl,
            setHostHeader: true
        })
    ]};
};
