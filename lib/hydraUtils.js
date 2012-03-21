var url = require('url');
var http = require('http');
var fs = require('fs');
var mime = require('mime');

function serveStaticFile(filePath, res, cb, opts) {
    opts = opts || {};
    var fsObject   = opts.fs   || fs;
    var mimeObject = opts.mime || mime;

    fsObject.readFile(filePath, function(err, data) {
        if (err) {
            res.statusCode = 404;
            res.send("Not Found");
        } else {
            res.header("Content-Type", mimeObject.lookup(filePath));
            res.send(data);
        }
        cb();
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
    var proxyToHost = proxyUrl.host;
    var proxyToPort = proxyUrl.port ||
        (proxyUrl.protocol === 'https:' ? 443 : 80);
    var proxyToPath = proxyUrl.pathname;

    var proxy = httpCreateClientFunction(proxyToPort, proxyToHost),
    proxy_req = proxy.request(req.method, proxyToPath, req.headers);

    proxy.on('error', function (err) {
        res.writeHead(502);
        res.write('Bad Gateway! Could not proxy request. Invalid host or proxy destination down?');
        res.end();
    });

    proxy_req.addListener("response", function (proxy_res) {
        // Copy over headers and status code from proxied request
        res.writeHead(
            proxy_res.statusCode,
            proxy_res.headers
        );

        proxy_res.addListener("data", function (chunk) {
            res.write(chunk, "binary");
        });

        proxy_res.addListener("end", function () {
            res.end();
            cb();
        });
    });

    req.addListener("data", function (chunk) {
        proxy_req.write(chunk, "binary");
    });

    req.addListener("end", function () {
        proxy_req.end();
    });
}

exports.serveStaticFile = serveStaticFile;
exports.proxyRequest    = proxyRequest;
