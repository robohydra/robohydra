var fs   = require('fs'),
    http = require('http'),
    url  = require('url'),
    mime = require('mime');
var utils           = require('./utils'),
    serveStaticFile = utils.serveStaticFile,
    proxyRequest    = utils.proxyRequest;
var p;

var InvalidRoboHydraHeadException = function(message) {
    this.name    = "InvalidRoboHydraHeadException";
    this.message = message || "Invalid or incomplete RoboHydra Head";
};
InvalidRoboHydraHeadException.prototype.toString = function() {
    return "InvalidRoboHydraHeadException";
};

var InvalidRoboHydraHeadStateException = function(attachedState) {
    this.name    = "InvalidRoboHydraHeadStateException";
    this.message = "Can't execute that operation when the hydra head is " +
            attachedState ? "attached" : "detached";
};
InvalidRoboHydraHeadStateException.prototype.toString = function() {
    return "InvalidRoboHydraHeadStateException";
};

var RoboHydraHead = function(props) {
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
RoboHydraHead.prototype.type = 'generic';
RoboHydraHead.prototype._mandatoryProperties = ['path', 'handler'];
RoboHydraHead.prototype._checkMandatoryProperties = function(props) {
    this._mandatoryProperties.forEach(function(p) {
        if (typeof(props[p]) === 'undefined') {
            throw new InvalidRoboHydraHeadException("Missing mandatory property '" + p + "'");
        }
    });
};
RoboHydraHead.prototype.attached = function() {
    return this._attached;
};
RoboHydraHead.prototype.attach = function() {
    if (this._attached) {
        throw new InvalidRoboHydraHeadStateException(this._attached);
    }
    this._attached = true;
};
RoboHydraHead.prototype.detach = function() {
    if (! this._attached) {
        throw new InvalidRoboHydraHeadStateException(this._attached);
    }
    this._attached = false;
};
RoboHydraHead.prototype.normalizePath = function(path) {
    var normalizedPath = path[0] === '/' ? path : '/' + path;
    return normalizedPath.length > 1 ?
        normalizedPath.replace(new RegExp('/$'), '') :
        normalizedPath;
};
RoboHydraHead.prototype.stripGetParams = function(urlPath) {
    return urlPath.replace(new RegExp('\\?.*'), '');
}
RoboHydraHead.prototype.canHandle = function(path) {
    if (! this._attached) { return false; }
    // The convention is that either 'path' or 'mountPath' is
    // used. The former is currently a simple string with the
    // supported path, while the latter is simply a base path, and all
    // paths inside that are supported (typically this is used for
    // filesystem serving or proxying)
    var reqPath = this.normalizePath(this.stripGetParams(path));
    var headPath = this.normalizePath(this.mountPath ?
                                      this.mountPath : this.path);
    if (this.mountPath) {
        if (headPath === '/') {
            return true;
        }
        if (! reqPath.match(new RegExp("^" + headPath))) {
            return false;
        }
        return reqPath.length === headPath.length ||
            reqPath[headPath.length] === '/';
    } else {
        return reqPath.match(new RegExp("^" + headPath + "$"));
    }
};
RoboHydraHead.prototype.handle = function(req, res, next) {
    if (this.canHandle(req.url)) {
        this._handle(req, res, next);
    } else {
        res.statusCode = 404;
        res.send("Not Found");
    }
};
RoboHydraHead.prototype._handle = function(req, res, next) {
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

    this.handler(req, res, next);
};


var RoboHydraHeadStatic = function(props) {
    RoboHydraHead.call(this, props);

    this.contentType = props.contentType;
};
for (p in RoboHydraHead.prototype) {
    RoboHydraHeadStatic.prototype[p] = RoboHydraHead.prototype[p];
}
RoboHydraHeadStatic.prototype.type = 'static';
RoboHydraHeadStatic.prototype._mandatoryProperties = ['content'];
RoboHydraHeadStatic.prototype._handle = function(req, res) {
    var content = this.content, contentType = this.contentType;
    if (typeof(this.content) !== 'string') {
        content = JSON.stringify(this.content);
        contentType = contentType || 'application/json';
    }
    if (contentType) {
        res.headers["Content-Type"] = contentType;
    }
    res.send(content);
};

var RoboHydraHeadFilesystem = function(props) {
    RoboHydraHead.call(this, props);

    this.fs        = props.fs       || fs;
    this.mime      = props.mime     || mime;
    this.mountPath = props.mountPath || '/';
};
for (p in RoboHydraHead.prototype) {
    RoboHydraHeadFilesystem.prototype[p] = RoboHydraHead.prototype[p];
}
RoboHydraHeadFilesystem.prototype.type = 'filesystem';
RoboHydraHeadFilesystem.prototype._mandatoryProperties = ['documentRoot'];
RoboHydraHeadFilesystem.prototype._handle = function(req, res) {
    var pathRe = new RegExp("^" + this.mountPath);
    var filePath = (this.documentRoot + '/' + req.url.replace(pathRe, '')).
        replace(new RegExp('//+'), '/');
    serveStaticFile(filePath, res, {
        fs: this.fs,
        mime: this.mime,
        headers: req.headers
    });
};

var RoboHydraHeadProxy = function(props) {
    RoboHydraHead.call(this, props);

    this.mountPath = this.normalizePath(props.mountPath || '/');
    this.httpRequestFunction =
        props.httpRequestFunction || http.request;
};
for (p in RoboHydraHead.prototype) {
    RoboHydraHeadProxy.prototype[p] = RoboHydraHead.prototype[p];
}
RoboHydraHeadProxy.prototype.type = 'proxy';
RoboHydraHeadProxy.prototype._mandatoryProperties = ['proxyTo'];
RoboHydraHeadProxy.prototype._handle = function(req, res) {
    var normalisedMountPath = this.normalizePath(this.mountPath);
    var requestUrlExtra =
        req.url.replace(new RegExp("^" + normalisedMountPath + "/?"),
                        '');

    var proxyUrl = url.parse(this.proxyTo);
    // This is different from normalizePath because in this case we want to
    // remove the trailing slash even for '/'
    proxyUrl.pathname = proxyUrl.pathname.replace(new RegExp('/$'), '') +
        '/' + requestUrlExtra;
    proxyRequest(req, res, proxyUrl,
                 {httpRequestFunction: this.httpRequestFunction});
};

exports.InvalidRoboHydraHeadException = InvalidRoboHydraHeadException;
exports.RoboHydraHead = RoboHydraHead;
exports.RoboHydraHeadStatic = RoboHydraHeadStatic;
exports.RoboHydraHeadFilesystem = RoboHydraHeadFilesystem;
exports.RoboHydraHeadProxy = RoboHydraHeadProxy;
