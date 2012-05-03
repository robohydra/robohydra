var fs   = require('fs'),
    http = require('http'),
    url  = require('url'),
    mime = require('mime');
var serveStaticFile = require('./hydraUtils.js').serveStaticFile,
    proxyRequest    = require('./hydraUtils.js').proxyRequest;
var p;

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
    this._checkMandatoryProperties(props);
    var self = this;
    this._mandatoryProperties.forEach(function(p) {
        self[p] = props[p];
    });
    self.name      =  props.name;
    self._attached = !props.detached;
    self.requestParamNames = [];
    self.path      =  this.normalizePath(props.path || '/.*').
            replace(/:(\w+)/g,
                    function(_, name) {
                        self.requestParamNames.push(name);
                        return '([^/]+)';
                    });
};
HydraHead.prototype.type = 'generic';
HydraHead.prototype._mandatoryProperties = ['path', 'handler'];
HydraHead.prototype._checkMandatoryProperties = function(props) {
    this._mandatoryProperties.forEach(function(p) {
        if (typeof(props[p]) === 'undefined') {
            throw new InvalidHydraHeadException("Missing mandatory property '" + p + "'");
        }
    });
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
HydraHead.prototype.stripGetParams = function(urlPath) {
    return urlPath.replace(new RegExp('\\?.*'), '');
}
HydraHead.prototype.canHandle = function(path) {
    if (! this._attached) return false;
    // The convention is that either 'path' or 'basePath' is used. The former
    // is currently a simple string with the supported path, while the
    // latter is simply a base path, and all paths inside that are
    // supported (typically this is used for filesystem serving or proxying)
    var reqPath = this.normalizePath(this.stripGetParams(path));
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
HydraHead.prototype.handle = function(req, res, cb, next) {
    if (this.canHandle(req.url)) {
        this._handle(req, res, cb, next);
    } else {
        res.write("Not Found");
        res.statusCode = 404;
        cb();
    }
};
HydraHead.prototype._handle = function(req, res, cb, next) {
    // Convert path to a regular expression, and collect the
    // captured names so we can assign the appropriate values to
    // req.param.<name>
    var nakedUrl = this.stripGetParams(req.url);
    if (this.requestParamNames.length > 0) {
        var matches = nakedUrl.match(this.path);
        if (matches) {
            req.params = {};
            // Save captured names in req.param.<name>
            for (var i = 0, len = this.requestParamNames.length; i < len; i++) {
                req.params[this.requestParamNames[i]] = matches[i + 1];
            }
        }
    }

    this.handler(req, res, cb, next);
};


var HydraHeadStatic = function(props) {
    HydraHead.call(this, props);

    this.contentType = props.contentType;
};
for (p in HydraHead.prototype) {
    HydraHeadStatic.prototype[p] = HydraHead.prototype[p];
}
HydraHeadStatic.prototype.type = 'static';
HydraHeadStatic.prototype._mandatoryProperties = ['content'];
HydraHeadStatic.prototype._handle = function(req, res, cb) {
    var content = this.content, contentType = this.contentType;
    if (typeof(this.content) !== 'string') {
        content = JSON.stringify(this.content);
        contentType = contentType || 'application/json';
    }
    if (contentType) {
        res.headers["Content-Type"] = contentType;
    }
    res.write(content);
    cb();
};

var HydraHeadFilesystem = function(props) {
    HydraHead.call(this, props);

    this.fs       = props.fs       || fs;
    this.mime     = props.mime     || mime;
    this.basePath = props.basePath || '/';
};
for (p in HydraHead.prototype) {
    HydraHeadFilesystem.prototype[p] = HydraHead.prototype[p];
}
HydraHeadFilesystem.prototype.type = 'filesystem';
HydraHeadFilesystem.prototype._mandatoryProperties = ['documentRoot'];
HydraHeadFilesystem.prototype._handle = function(req, res, cb) {
    var pathRe = new RegExp("^" + this.basePath)
    var filePath = (this.documentRoot + '/' + req.url.replace(pathRe, '')).
        replace(new RegExp('//+'), '/');
    serveStaticFile(filePath, res, cb, {
        fs: this.fs,
        mime: this.mime,
        headers: req.headers
    });
};

var HydraHeadProxy = function(props) {
    HydraHead.call(this, props);

    this.basePath = this.normalizePath(props.basePath || '/');
    this.httpCreateClientFunction =
        props.httpCreateClientFunction || http.createClient;
};
for (p in HydraHead.prototype) {
    HydraHeadProxy.prototype[p] = HydraHead.prototype[p];
}
HydraHeadProxy.prototype.type = 'proxy';
HydraHeadProxy.prototype._mandatoryProperties = ['proxyTo'];
HydraHeadProxy.prototype._handle = function(req, res, cb) {
    var requestUrlExtra = req.url.replace(new RegExp("^" + this.normalizePath(this.basePath) + "/?"), '');

    var proxyUrl = url.parse(this.proxyTo);
    // This is different from normalizePath because in this case we want to
    // remove the trailing slash even for '/'
    proxyUrl.pathname = proxyUrl.pathname.replace(new RegExp('/$'), '') +
        '/' + requestUrlExtra;
    proxyRequest(req, res, proxyUrl, cb,
                 {httpCreateClientFunction: this.httpCreateClientFunction});
};

exports.InvalidHydraHeadException = InvalidHydraHeadException;
exports.HydraHead = HydraHead;
exports.HydraHeadStatic = HydraHeadStatic;
exports.HydraHeadFilesystem = HydraHeadFilesystem;
exports.HydraHeadProxy = HydraHeadProxy;
