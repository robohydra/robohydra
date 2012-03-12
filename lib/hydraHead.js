var fs   = require('fs'),
    http = require('http'),
    url  = require('url');

var InvalidHydraHeadException = function(message) {
    this.name = "InvalidHydraHeadException";
};
InvalidHydraHeadException.prototype.toString = function() {
    return "InvalidHydraHeadException";
};

var HydraHead = function(props) {
    props = props || {};
    this.handle = this._resolveHandleFunction(props);
    if (typeof(this.handle) !== 'function') {
        throw new InvalidHydraHeadException();
    }
    var self = this;
    ['path', 'content', 'documentRoot', 'fs', 'proxyTo',
     'httpCreateClientFunction'].forEach(function(p) {
        self[p] = props[p];
    });
    self.path = self.path || '/.*';
    if (self.path[0] !== '/') self.path = '/' + self.path;
    self.fs   = self.fs   || fs;
    self.httpCreateClientFunction =
        self.httpCreateClientFunction || http.createClient;
    if (self.proxyTo) {
        var proxyUrl = url.parse(self.proxyTo);
        self.proxyToHost = proxyUrl.host;
        self.proxyToPort = proxyUrl.port ||
            (proxyUrl.protocol === 'https:' ? 443 : 80);
        self.proxyToPath = proxyUrl.pathname;
    }
};
HydraHead.prototype._resolveHandleFunction = function(props) {
    if (typeof(props.content) !== 'undefined') {
        return this.handleFixed;
    } else if (typeof(props.documentRoot) !== 'undefined' &&
               typeof(props.path) !== 'undefined') {
        return this.handleFile;
    } else if (typeof(props.handler) !== 'undefined' &&
               typeof(props.path) !== 'undefined') {
        return props.handler;
    } else if (typeof(props.proxyTo) !== 'undefined' &&
               typeof(props.path) !== 'undefined') {
        return this.handleProxy;
    }
    return undefined;
};
/* Dispatch functions ------------------------------------------------- */
HydraHead.prototype.handleFixed = function(req, res, cb) {
    if (req.url.match(new RegExp("^" + this.path + "$"))) {
        res.send(this.content);
    } else {
        res.send("Not Found");
        res.statusCode = 404;
    }
    cb();
};
HydraHead.prototype.handleFile = function(req, res, cb) {
    var pathRe = new RegExp("^" + this.path);
    if (req.url.match(pathRe)) {
        var filePath = (this.documentRoot + '/' + req.url.replace(pathRe, '')).
            replace(new RegExp('//+'), '/');
        this.fs.readFile(filePath, function(err, data) {
            if (err) {
                res.statusCode = 404;
                res.send("Not Found");
            } else {
                res.send(data);
            }
            cb();
        });
    } else {
        res.statusCode = 404;
        res.send("Not Found");
        cb();
    }
};
HydraHead.prototype.handleProxy = function(req, res, cb) {
    var pathRe = new RegExp("^" + this.path);
    if (req.url.match(pathRe)) {
        var url = req.url.replace(new RegExp("^" + this.path), '');

        var proxy     = this.httpCreateClientFunction(this.proxyToPort,
                                                      this.proxyToHost),
            proxy_req = proxy.request(req.method,
                                      this.proxyToPath + url,
                                      req.headers);

        proxy.on('error', function (err) {
            var msg = 'Could not proxy request. Invalid host or proxy destination down?';
            console.log(msg);
            res.writeHead(502);
            res.write('Bad Gateway! ' + msg);
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
    } else {
        res.statusCode = 404;
        res.send("Not Found");
        cb();
    }
};

exports.InvalidHydraHeadException = InvalidHydraHeadException;
exports.HydraHead = HydraHead;
