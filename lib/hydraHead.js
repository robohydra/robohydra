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

var InvalidHydraHeadStateException = function(attachedState) {
    this.name    = "InvalidHydraHeadStateException";
    this.message = "Can't execute that operation when the hydra head is " +
            attachedState ? "attached" : "detached";
};
InvalidHydraHeadStateException.prototype.toString = function() {
    return "InvalidHydraHeadStateException";
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
    self._name     =  props.name;
    self._attached = !props.detached;
    self.path      =  props.path || '/.*';
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
HydraHead.prototype.name = function() {
    return this._name;
};
HydraHead.prototype.attached = function() {
    return this._attached;
};
HydraHead.prototype.attach = function() {
    if (this._attached) {
        throw new InvalidHydraHeadStateException(this._attached);
    }
    this._attached = true;
};
HydraHead.prototype.detach = function() {
    if (! this._attached) {
        throw new InvalidHydraHeadStateException(this._attached);
    }
    this._attached = false;
};
HydraHead.prototype.normalizePath = function(path) {
    var normalizedPath = path[0] === '/' ? path : '/' + path;
    return normalizedPath.length > 1 ?
        normalizedPath.replace(new RegExp('/$'), '') :
        normalizedPath;
};
HydraHead.prototype.canDispatch = function(path) {
    if (! this._attached) return false;
    // The convention is that either 'path' or 'basePath' is used. The former
    // is currently a simple string with the supported path, while the
    // latter is simply a base path, and all paths inside that are
    // supported (typically this is used for filesystem serving or proxying)
    var reqPath = this.normalizePath(path);
    var headPath = this.normalizePath(this.basePath ?
                                      this.basePath : this.path);
    if (this.basePath) {
        if (headPath === '/') return true;
        if (! reqPath.match(new RegExp("^" + headPath))) {
            return false;
        }
        return reqPath.length === headPath.length ||
            reqPath[headPath.length] == '/';
    } else {
        return reqPath.match(new RegExp("^" + headPath + "$"));
    }
};
HydraHead.prototype.handle = function(req, res, cb) {
    if (this.canDispatch(req.url)) {
        this._handle(req, res, cb);
    } else {
        res.send("Not Found");
        res.statusCode = 404;
        cb();
    }
};
HydraHead.prototype._handle = function(req, res, cb) {
    this.handler(req, res, cb);
};


var HydraHeadStatic = function(props) {
    HydraHead.call(this, props);
};
for (p in HydraHead.prototype) {
    HydraHeadStatic.prototype[p] = HydraHead.prototype[p];
}
HydraHeadStatic.prototype._mandatoryProperties = ['content'];
HydraHeadStatic.prototype._handle = function(req, res, cb) {
    res.send(typeof(this.content) === 'string' ?
             this.content : JSON.stringify(this.content));
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
HydraHeadFilesystem.prototype._handle = function(req, res, cb) {
    var pathRe = new RegExp("^" + this.basePath)
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
};

var HydraHeadProxy = function(props) {
    HydraHead.call(this, props);

    this.basePath = this.normalizePath(props.basePath || '/');
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
HydraHeadProxy.prototype._handle = function(req, res, cb) {
    var url = req.url.replace(new RegExp("^" + this.normalizePath(this.basePath) + "/?"), '');

    var proxy     = this.httpCreateClientFunction(this.proxyToPort,
                                                  this.proxyToHost),
    proxy_req = proxy.request(req.method,
                              this.proxyToPath + '/' + url,
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
};

exports.InvalidHydraHeadException = InvalidHydraHeadException;
exports.HydraHead = HydraHead;
exports.HydraHeadStatic = HydraHeadStatic;
exports.HydraHeadFilesystem = HydraHeadFilesystem;
exports.HydraHeadProxy = HydraHeadProxy;
