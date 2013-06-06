var robohydra     = require('robohydra'),
    RoboHydraHead = robohydra.heads.RoboHydraHead,
    Response      = robohydra.Response;

exports.getBodyParts = function() {
    "use strict";

    return {
        heads: [
            new RoboHydraHead({
                name: 'exponentialWait',
                path: '/.*',
                handler: function(req, res, next) {
                    var wait = 200;

                    var res2 = new Response().
                        on('head', function(statusCode, headers) {
                            res.writeHead(statusCode, headers);
                        }).
                        on('data', function(evt) {
                            wait = wait * 2;
                            setTimeout(function() {
                                res.write(evt.data);
                            }, wait);
                        }).
                        on('end', function() {
                            wait = wait * 2;
                            setTimeout(function() {
                                res.end();
                            }, wait);
                        });
                    next(req, res2);
                }
            }),

            new RoboHydraHead({
                name: 'dataProducer',
                path: '/data',
                handler: function(req, res) {
                    for (var i = 0, len = 5; i < len; i++) {
                        res.write(new Buffer("Some data here -> " + i + "\n"));
                    }
                    res.end();
                }
            })
        ]
    };
};
