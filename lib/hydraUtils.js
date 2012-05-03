var url = require('url');
var http = require('http');
var fs = require('fs');
var mime = require('mime');

function serveStaticFile(filePath, res, cb, opts) {
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
                res.headers["Content-Type"]  = mimeObject.lookup(filePath);
                res.headers["Last-Modified"] = mtime.toUTCString();
                res.write(data);
                cb();
            });

            // 304 - Not Modified
            } else {
                res.statusCode = 304;
                cb();
            }

        // 404 - Not Found
        } else {
            res.statusCode = 404;
            res.write("Not Found");
            cb();
        }
    });
}

function proxyRequest(req, res, proxyTo, cb, opts) {
    opts = opts || {};
    var httpCreateClientFunction = opts.httpCreateClientFunction ||
        http.createClient;

    var proxyUrl = proxyTo;
    if (typeof(proxyTo) === 'string') {
        proxyUrl = url.parse(proxyTo);
    }
    var proxyToHost = proxyUrl.hostname;
    var proxyToPort = proxyUrl.port ||
        (proxyUrl.protocol === 'https:' ? 443 : 80);
    var proxyToPath = proxyUrl.pathname;

    var proxy    = httpCreateClientFunction(proxyToPort, proxyToHost),
        proxyReq = proxy.request(req.method, proxyToPath, req.headers);

    proxy.on('error', function (err) {
        res.statusCode = 502;
        res.write('Bad Gateway! Could not proxy request. Invalid host or proxy destination down?');
        cb();
    });

    proxyReq.addListener("response", function (proxyRes) {
        // Copy over headers and status code from proxied request
        res.statusCode = proxyRes.statusCode;
        res.headers = proxyRes.headers;

        proxyRes.addListener("data", function (chunk) {
            res.write(chunk, "binary");
        });

        proxyRes.addListener("end", function () {
            cb();
        });
    });

    proxyReq.write(req.rawBody, "binary");
    proxyReq.end();
}

exports.serveStaticFile = serveStaticFile;
exports.proxyRequest    = proxyRequest;
