var zlib = require('zlib'),
    fs   = require('fs');
var robohydra     = require('robohydra'),
    RoboHydraHead = robohydra.heads.RoboHydraHead,
    Request       = robohydra.Request,
    Response      = robohydra.Response;


function printResponseBody(logFileFd, responseBody) {
    "use strict";

    var bodyString = responseBody.toString();
    var truncatedBodyString =
        bodyString.slice(0, Math.min(1000, responseBody.length));
    fs.writeSync(logFileFd, "  Content (" + bodyString.length + " bytes): " +
                 truncatedBodyString +
                 (truncatedBodyString.length < bodyString.length ? "…" : "") +
                 "\n");
}

function logRequestResponse(logFileFd, req, res, cb) {
    "use strict";

    fs.writeSync(logFileFd, "============================================\n");

    fs.writeSync(logFileFd, req.method + " " + req.url + "\n");
    fs.writeSync(logFileFd, "  Headers:\n");
    for (var h in req.headers) {
        fs.writeSync(logFileFd, "    * " + h + ": " + req.headers[h] + "\n");
    }
    if (req.rawBody.length) {
        var formContentType = "application/x-www-form-urlencoded";

        if (req.headers["content-type"] &&
                req.headers["content-type"].indexOf(formContentType) !== -1) {
            fs.writeSync(logFileFd, "  Body parameters:\n");
            for (var param in req.bodyParams) {
                fs.writeSync(logFileFd, "    * " + param + " -> " + req.bodyParams[param] + "\n");
            }
        } else {
            fs.writeSync(logFileFd, "  Body:\n");
            fs.writeSync(logFileFd, "    " + req.rawBody.toString() + "\n");
        }
    }

    fs.writeSync(logFileFd, "--------------------------------------------\n");

    fs.writeSync(logFileFd, "Response code: " + res.statusCode + "\n");
    var headerPrinted = false;
    for (var resH in res.headers) {
        if (! headerPrinted) {
            fs.writeSync(logFileFd, "  Headers:\n");
            headerPrinted = true;
        }
        fs.writeSync(logFileFd, "    * " + resH + ": " + res.headers[resH] +
                     "\n");
    }

    // The response might be compressed, uncompress if necessary
    if (res.body !== undefined) {
        if (res.headers['content-encoding'] === 'gzip') {
            zlib.gunzip(res.body, function(err, buffer) {
                if (err) {
                    var msg = "INVALID GZIP DATA IN RESPONSE?";
                    console.log(msg);
                    fs.writeSync(logFileFd, msg + "\n");
                } else {
                    printResponseBody(logFileFd, buffer);
                }
                cb();
            });
        } else {
            if (res.headers["content-type"] &&
                    res.headers["content-type"].match(/^image/)) {
                fs.writeSync(logFileFd,
                             "*SKIPPING IMAGE DATA* (" +
                                 res.body.length + " bytes)\n");
            } else {
                printResponseBody(logFileFd, res.body);
            }
            cb();
        }
    } else {
        cb();
    }
}

function getBodyParts(config) {
    "use strict";

    // Initialise the log file on RoboHydra start
    var logFilePath = config.logFilePath || 'robohydra.log';
    var logFileFd = fs.openSync(logFilePath, 'w+');

    // Register the head dynamically, instead of a normal head part of
    // the plugin, so it has precedence over all other dynamic heads.
    config.robohydra.registerDynamicHead(new RoboHydraHead({
        name:    'logger',
        path:    '/.*',
        handler: function(req, res, next) {
            // Save the original request as it can be modified before
            // the response object end callback gets executed
            var origRequest = new Request(req);
            var fakeRes = new Response(
                function() {
                    logRequestResponse(logFileFd,
                                       origRequest,
                                       fakeRes,
                                       function() {
                                           res.copyFrom(fakeRes);
                                           res.end();
                                       });
                }
            );
            next(req, fakeRes);
        }
    }), {priority: 'high'});

    return {heads: []};
}

exports.getBodyParts = getBodyParts;
