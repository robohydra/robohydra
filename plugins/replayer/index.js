var fs   = require('fs'),
    path = require('path'),
    ejs  = require('ejs');
var robohydra          = require('robohydra'),
    RoboHydraHead      = robohydra.heads.RoboHydraHead,
    RoboHydraHeadProxy = robohydra.heads.RoboHydraHeadProxy,
    Response           = robohydra.Response;

function templateData(templateName) {
    return fs.readFileSync(path.join(__dirname,
                                     "templates",
                                     templateName + ".ejs"),
                           "utf-8");
}

exports.getBodyParts = function(conf) {
    "use strict";

    var proxyToUrl = conf.replayerurl || 'http://robohydra.org';
    // Initialise the log file on RoboHydra start
    var defaultTrafficFilePath = conf.trafficfilepath ||
            conf.trafficFilePath || 'robohydra-replayer.json';
    if ('trafficFilePath' in conf) {
        console.warn("***WARNING***: 'trafficFilePath' is deprecated, please use 'trafficfilepath'");
    }
    var trafficFileFd, currentTrafficData, indexForUrl;

    return {
        heads: [
            new RoboHydraHead({
                name:    'start-recording',
                path:    '/start-recording',
                handler: function(req, res) {
                    var rh = conf.robohydra;
                    var recorderHead = rh.findHead('replayer', 'recorder');
                    var trafficFilePath = req.queryParams.trafficFilePath;

                    res.headers['content-type'] = 'text/html';

                    if (trafficFilePath) {
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

                        res.send(ejs.render(templateData('recording'), {
                            title: 'Replayer - Now Recording',
                            baseUrl: '/robohydra-admin',
                            trafficFilePath: trafficFilePath
                        }));
                    } else {
                        res.send(ejs.render(templateData('prepare-recording'), {
                            title: 'Replayer Mode configuration',
                            baseUrl: '/robohydra-admin',
                            proxyToUrl: proxyToUrl,
                            trafficFilePath: defaultTrafficFilePath
                        }));
                    }
                }
            }),

            new RoboHydraHead({
                name:    'start-replaying',
                path:    '/start-replaying',
                handler: function(req, res) {
                    var rh = conf.robohydra;
                    var trafficFilePath = req.queryParams.trafficFilePath ||
                            defaultTrafficFilePath;
                    var trafficFiles = fs.readdirSync('.').filter(function(entry) {
                        return (/\.json$/).test(entry) &&
                            entry !== 'package.json';
                    });

                    currentTrafficData = null;

                    try {
                        currentTrafficData =
                            JSON.parse(fs.readFileSync(trafficFilePath));
                        indexForUrl = {};
                    } catch (e) {
                    }

                    res.headers['content-type'] = 'text/html';

                    if (currentTrafficData) {
                        if (rh.findHead('replayer', 'recorder').attached()) {
                            rh.detachHead('replayer', 'recorder');
                        }
                        if (!rh.findHead('replayer', 'replayer').attached()) {
                            rh.attachHead('replayer', 'replayer');
                        }

                        res.send(ejs.render(templateData('replaying'), {
                            title: 'Replayer - Now Replaying',
                            baseUrl: '/robohydra-admin',
                            trafficFilePath: trafficFilePath,
                            proxyToUrl: proxyToUrl,
                            trafficFiles: trafficFiles
                        }));
                    } else {
                        res.send(ejs.render(templateData('replay-error'), {
                            title: 'Replayer - Now Replaying',
                            baseUrl: '/robohydra-admin',
                            trafficFilePath: trafficFilePath,
                            proxyToUrl: proxyToUrl,
                            trafficFiles: trafficFiles
                        }));
                    }
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
                             ]
    };
};
