var fs   = require('fs'),
    http = require('http'),
    url  = require('url');

var InvalidHydraHeadException = function(message) {
    this.name    = "InvalidHydraHeadException";
    this.message = message || "Invalid or incomplete Hydra Head";
};
InvalidHydraHeadException.prototype.toString = function() {
    return "InvalidHydraHeadException";
};

var HydraHead = function(props) {
    props = props || {};
    if (!this._checkMandatoryProperties(props)) {
        throw new InvalidHydraHeadException();
    }
    var self = this;
    this._mandatoryProperties.forEach(function(p) {
        self[p] = props[p];
    });
    if (props.handler) self.handle = props.handler;
    self.path = props.path || '/.*';
    if (self.path[0] !== '/') self.path = '/' + self.path;
};
HydraHead.prototype._mandatoryProperties = ['path', 'handler'];
HydraHead.prototype._checkMandatoryProperties = function(props) {
    var r = true;
    this._mandatoryProperties.forEach(function(p) {
        if (typeof(props[p]) === 'undefined')
            r = false;
    });
    return r;
};
HydraHead.prototype.canDispatch = function(path) {
    var reqPath = path.replace(new RegExp('/$'), '');
    // The convention is that either 'path' or 'basePath' is used. The former
    // is currently a simple string with the supported path, while the
    // latter is simply a base path, and all paths inside that are
    // supported (typically this is used for filesystem serving or proxying)
    if (this.basePath) {
        var reBase = this.basePath.replace(new RegExp('/$'), '');
        return reqPath.match(new RegExp(reBase));
    } else {
        return reqPath === this.path.replace(new RegExp('/$'), '');
    }
};


var HydraHeadStatic = function(props) {
    HydraHead.call(this, props);
};
for (p in HydraHead.prototype) {
    HydraHeadStatic.prototype[p] = HydraHead.prototype[p];
}
HydraHeadStatic.prototype._mandatoryProperties = ['content'];
HydraHeadStatic.prototype.handle = function(req, res, cb) {
    if (req.url.match(new RegExp("^" + this.path + "$"))) {
        res.send(this.content);
    } else {
        res.send("Not Found");
        res.statusCode = 404;
    }
    cb();
};

var HydraHeadFilesystem = function(props) {
    HydraHead.call(this, props);

    this.fs       = props.fs       || fs;
    this.basePath = props.basePath || '/';
};
for (p in HydraHead.prototype) {
    HydraHeadFilesystem.prototype[p] = HydraHead.prototype[p];
}
HydraHeadFilesystem.prototype._mandatoryProperties = ['documentRoot'];
HydraHeadFilesystem.prototype.handle = function(req, res, cb) {
    var pathRe = new RegExp("^" + this.basePath);
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

var HydraHeadProxy = function(props) {
    HydraHead.call(this, props);

    this.basePath = (props.basePath || '/').replace(new RegExp('/$'), '');
    this.httpCreateClientFunction =
        props.httpCreateClientFunction || http.createClient;
    var proxyUrl = url.parse(props.proxyTo);
    this.proxyToHost = proxyUrl.host;
    this.proxyToPort = proxyUrl.port ||
        (proxyUrl.protocol === 'https:' ? 443 : 80);
    this.proxyToPath = proxyUrl.pathname;
};
for (p in HydraHead.prototype) {
    HydraHeadProxy.prototype[p] = HydraHead.prototype[p];
}
HydraHeadProxy.prototype._mandatoryProperties = ['proxyTo'];
HydraHeadProxy.prototype.handle = function(req, res, cb) {
    var pathRe = new RegExp("^" + this.basePath);
    if (req.url.match(pathRe)) {
        var url = req.url.replace(new RegExp("^" + this.basePath), '');

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
exports.HydraHeadStatic = HydraHeadStatic;
exports.HydraHeadFilesystem = HydraHeadFilesystem;
exports.HydraHeadProxy = HydraHeadProxy;
