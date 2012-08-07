var fs   = require('fs'),
    http = require('http'),
    url  = require('url'),
    mime = require('mime');
var utils           = require('./utils'),
    serveStaticFile = utils.serveStaticFile,
    proxyRequest    = utils.proxyRequest,
    Response        = utils.Response;

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
    // If you don't pass props at all, created a "generic", valid
    // RoboHydra head. This is useful for inheritance and for when you
    // don't really care about the behaviour of the head (you just
    // want one created)
    props = props || {path: '/.*', handler: function(_, res) {res.end();}};

    this._checkProperties(props);
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
RoboHydraHead.type = 'generic';
RoboHydraHead.prototype._mandatoryProperties = ['path', 'handler'];
RoboHydraHead.prototype._optionalProperties  = ['name', 'detached'];
RoboHydraHead.prototype._checkProperties = function(props) {
    this._mandatoryProperties.forEach(function(p) {
        if (props[p] === undefined) {
            throw new InvalidRoboHydraHeadException("Missing mandatory property '" + p + "'");
        }
    });

    for (var p in props) {
        if (this._mandatoryProperties.indexOf(p) === -1 &&
                this._optionalProperties.indexOf(p) === -1) {
            throw new InvalidRoboHydraHeadException("Unknown property '" + p + "'");
        }
    }
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
};
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

    props = props || {};
    this.content     = props.content;
    this.contentType = props.contentType;
    this.statusCode  = props.statusCode;
    this.responses   = props.responses;
    this.responseIndex = 0;

    if (this.content === undefined && this.responses === undefined) {
        throw new InvalidRoboHydraHeadException("RoboHydraHeadStatic needs either 'content' or 'responses'");
    }
    if (this.responses !== undefined && this.responses.length === 0) {
        throw new InvalidRoboHydraHeadException("RoboHydraHeadStatic 'responses', if given, must be a non-empty array");
    }
};
RoboHydraHeadStatic.parent = RoboHydraHead;
RoboHydraHeadStatic.type = 'static';
RoboHydraHeadStatic.prototype = new RoboHydraHeadStatic.parent();
RoboHydraHeadStatic.prototype._mandatoryProperties = [];
RoboHydraHeadStatic.prototype._optionalProperties =
    RoboHydraHeadStatic.prototype._optionalProperties.concat('path', 'responses', 'content', 'statusCode', 'contentType');
RoboHydraHeadStatic.prototype._handle = function(req, res) {
    var content     = this.content,
        contentType = this.contentType,
        statusCode  = this.statusCode;
    if (this.responses !== undefined) {
        var currentResponse = this.responses[this.responseIndex];
        content     = currentResponse.content     || content;
        contentType = currentResponse.contentType || contentType;
        statusCode  = currentResponse.statusCode  || statusCode;
        this.responseIndex =
            (this.responseIndex + 1) % this.responses.length;
    }
    if (typeof(content) !== 'string') {
        content = JSON.stringify(content);
        contentType = contentType || 'application/json';
    }
    if (contentType) {
        res.headers["content-type"] = contentType;
    }
    if (statusCode) {
        res.statusCode = statusCode;
    }
    res.send(content);
};

var RoboHydraHeadFilesystem = function(props) {
    RoboHydraHead.call(this, props);

    this.fs        = props.fs        || fs;
    this.mime      = props.mime      || mime;
    this.mountPath = props.mountPath || '/';
};
RoboHydraHeadFilesystem.parent = RoboHydraHead;
RoboHydraHeadFilesystem.type = 'filesystem';
RoboHydraHeadFilesystem.prototype =
    new RoboHydraHeadFilesystem.parent();
RoboHydraHeadFilesystem.prototype._mandatoryProperties = ['documentRoot'];
RoboHydraHeadFilesystem.prototype._optionalProperties =
    RoboHydraHeadFilesystem.prototype._optionalProperties.concat('mountPath', 'fs', 'mime');
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

    this.mountPath           = this.normalizePath(props.mountPath || '/');
    this.setHostHeader       = props.setHostHeader;
    this.httpRequestFunction =
        props.httpRequestFunction || http.request;
};
RoboHydraHeadProxy.parent = RoboHydraHead;
RoboHydraHeadProxy.type = 'proxy';
RoboHydraHeadProxy.prototype = new RoboHydraHeadProxy.parent();
RoboHydraHeadProxy.prototype._mandatoryProperties = ['proxyTo'];
RoboHydraHeadProxy.prototype._optionalProperties =
    RoboHydraHeadProxy.prototype._optionalProperties.concat('mountPath', 'httpRequestFunction', 'setHostHeader');
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
                 {httpRequestFunction: this.httpRequestFunction,
                  setHostHeader: this.setHostHeader});
};

var RoboHydraHeadFilter = function(props) {
    RoboHydraHead.call(this, props);
    if (typeof this.filter !== 'function') {
        throw new InvalidRoboHydraHeadException("Property 'filter' must be a function");
    }
};
RoboHydraHeadFilter.parent = RoboHydraHead;
RoboHydraHeadFilter.type = 'filter';
RoboHydraHeadFilter.prototype = new RoboHydraHeadFilter.parent();
RoboHydraHeadFilter.prototype._mandatoryProperties = ['filter'];
RoboHydraHeadFilter.prototype._optionalProperties =
    RoboHydraHeadFilter.prototype._optionalProperties.concat('path');
RoboHydraHeadFilter.prototype._handle = function(req, res, next) {
    var self = this;
    var fakeRes = new Response(function() {
        res.copyFrom(fakeRes);
        res.body = self.filter(fakeRes.body);
        if (res.headers['content-length'] !== undefined) {
            res.headers['content-length'] = res.body.length;
        }
        res.end();
    });
    next(req, fakeRes);
};


exports.InvalidRoboHydraHeadException = InvalidRoboHydraHeadException;
exports.RoboHydraHead = RoboHydraHead;
exports.RoboHydraHeadStatic = RoboHydraHeadStatic;
exports.RoboHydraHeadFilesystem = RoboHydraHeadFilesystem;
exports.RoboHydraHeadProxy = RoboHydraHeadProxy;
exports.RoboHydraHeadFilter = RoboHydraHeadFilter;
