var url = require('url');
var http = require('http');
var fs = require('fs');
var mime = require('mime');

function serveStaticFile(filePath, res, opts) {
    opts = opts || {};
    var fsObject   = opts.fs      || fs;
    var mimeObject = opts.mime    || mime;
    var headers    = opts.headers || {};

    fsObject.stat(filePath, function(err, stats) {
        if (!err && stats.isFile()) {
            var mtime = stats.mtime,
                modifiedSince = headers['if-modified-since'];

            // Check modification date, if available
            if (!modifiedSince || new Date(modifiedSince) < mtime) {
                fsObject.readFile(filePath, function(err, data) {
                    res.headers["content-type"]  = mimeObject.lookup(filePath);
                    res.headers["last-modified"] = mtime.toUTCString();
                    res.send(data);
                });

            // 304 - Not Modified
            } else {
                res.statusCode = 304;
                res.end();
            }

        // 404 - Not Found
        } else {
            res.statusCode = 404;
            res.send("Not Found");
        }
    });
}

function proxyRequest(req, res, proxyTo, opts) {
    opts = opts || {};
    var httpRequestFunction = opts.httpRequestFunction ||
        http.request;
    var setHostHeader = opts.setHostHeader;

    var proxyUrl = proxyTo;
    if (typeof(proxyTo) === 'string') {
        proxyUrl = url.parse(proxyTo);
    }
    var proxyToHost = proxyUrl.hostname;
    var proxyToPort = proxyUrl.port ||
        (proxyUrl.protocol === 'https:' ? 443 : 80);
    var proxyToPath = proxyUrl.pathname;
    var headers = {};
    for (var h in req.headers) { headers[h] = req.headers[h]; }
    if (setHostHeader) {
        headers.host = proxyToHost +
            (proxyUrl.port ? ":" + proxyUrl.port : "");
    }

    var proxyReq = httpRequestFunction(
        {host: proxyToHost,
         port: proxyToPort,
         method: req.method,
         path: proxyToPath,
         headers: headers},
        function (proxyRes) {
            // Copy over headers and status code from proxied request
            res.statusCode = proxyRes.statusCode;
            res.headers    = proxyRes.headers;

            proxyRes.on("data", function (chunk) {
                res.write(chunk);
            });

            proxyRes.on("end", function () {
                res.end();
            });
        });

    proxyReq.on('error', function (err) {
        res.statusCode = 502;
        res.send('Bad Gateway! Could not proxy request. Invalid host or proxy destination down?');
    });

    if (req.rawBody) {
        proxyReq.write(req.rawBody);
    }
    proxyReq.end();
}

exports.serveStaticFile = serveStaticFile;
exports.proxyRequest    = proxyRequest;
