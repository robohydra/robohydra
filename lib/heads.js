var fs    = require('fs'),
    http  = require('http'),
    https = require('https'),
    url   = require('url'),
    mime  = require('mime'),
    zlib  = require('zlib');
var utils           = require('./utils'),
    serveStaticFile = utils.serveStaticFile,
    proxyRequest    = utils.proxyRequest,
    Response        = utils.Response;
var exceptions = require('./exceptions'),
    InvalidRoboHydraHeadException =
        exceptions.InvalidRoboHydraHeadException,
    InvalidRoboHydraHeadStateException =
        exceptions.InvalidRoboHydraHeadStateException;

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
RoboHydraHead.prototype.type = 'generic';
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
RoboHydraHead.prototype._escapeRegExp = function(string) {
    return string.replace(/[\\\^\$*+\?.(){}\[\]|]/g, "\\$&");
};
RoboHydraHead.prototype.canHandle = function(path) {
    var reqPath = this.normalizePath(this.stripGetParams(path));
    return this._attached ? this._canHandle(reqPath) : false;
};
RoboHydraHead.prototype._canHandle = function(path) {
    return path.match(new RegExp("^" + this.path + "$"));
};
RoboHydraHead.prototype.handle = function(req, res, next) {
    if (this.canHandle(req.url)) {
        try {
            this._handle(req, res, next);
        } catch (e) {
            res.statusCode = 500;
            res.send(e.stack);
        }
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
    props = props || {content: ''};
    RoboHydraHead.call(this, props);

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
RoboHydraHeadStatic.prototype = new RoboHydraHeadStatic.parent();
RoboHydraHeadStatic.prototype.type = 'static';
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

var RoboHydraHeadMounted = function(props) {
    RoboHydraHead.call(this, props);

    props = props || {mountPath: '/'};
    this.mountPath  = this.normalizePath(props.mountPath || '/');
};
RoboHydraHeadMounted.parent = RoboHydraHead;
RoboHydraHeadMounted.prototype = new RoboHydraHeadMounted.parent();
RoboHydraHeadMounted.prototype._relativePath = function(url) {
    var pathRe = new RegExp("^" + this._escapeRegExp(this.mountPath));
    return this.mountPath === '/' ? url : url.replace(pathRe, '');
};
RoboHydraHeadMounted.prototype._canHandle = function(path) {
    var mountPath = this.mountPath;
    if (mountPath === '/') {
        return true;
    }
    var headPathRegExpEscaped = this._escapeRegExp(mountPath);
    if (! path.match(new RegExp("^" + headPathRegExpEscaped))) {
        return false;
    }
    return path.length === mountPath.length || path[mountPath.length] === '/';
};

var RoboHydraHeadFilesystem = function(props) {
    props = props || {documentRoot: '/tmp'};
    RoboHydraHeadMounted.call(this, props);

    this.fs         = props.fs         || fs;
    this.mime       = props.mime       || mime;
    this.indexFiles = props.indexFiles;
};
RoboHydraHeadFilesystem.parent = RoboHydraHeadMounted;
RoboHydraHeadFilesystem.prototype = new RoboHydraHeadFilesystem.parent();
RoboHydraHeadFilesystem.prototype.type = 'filesystem';
RoboHydraHeadFilesystem.prototype._mandatoryProperties = ['documentRoot'];
RoboHydraHeadFilesystem.prototype._optionalProperties =
    RoboHydraHeadFilesystem.prototype._optionalProperties.concat('mountPath', 'fs', 'mime', 'indexFiles');
RoboHydraHeadFilesystem.prototype._handle = function(req, res) {
    var filePath = this.documentRoot + this._relativePath(req.url);
    serveStaticFile(filePath, res, {
        fs: this.fs,
        mime: this.mime,
        headers: req.headers,
        indexFiles: this.indexFiles
    });
};

var RoboHydraHeadProxy = function(props) {
    props = props || {proxyTo: 'http://example.com'};
    RoboHydraHead.call(this, props);

    this.mountPath           = this.normalizePath(props.mountPath || '/');
    this.setHostHeader       = props.setHostHeader;
    this.httpRequestFunction =
        props.httpRequestFunction || http.request;
    this.httpsRequestFunction =
        props.httpsRequestFunction || https.request;
};
RoboHydraHeadProxy.parent = RoboHydraHeadMounted;
RoboHydraHeadProxy.prototype = new RoboHydraHeadProxy.parent();
RoboHydraHeadProxy.prototype.type = 'proxy';
RoboHydraHeadProxy.prototype._mandatoryProperties = ['proxyTo'];
RoboHydraHeadProxy.prototype._optionalProperties =
    RoboHydraHeadProxy.prototype._optionalProperties.concat('mountPath', 'httpRequestFunction', 'httpsRequestFunction', 'setHostHeader');
RoboHydraHeadProxy.prototype._handle = function(req, res) {
    var requestUrlExtra = this._relativePath(req.url);

    var proxyUrl = url.parse(this.proxyTo);
    // This is different from normalizePath because in this case we want to
    // remove the trailing slash even for '/'
    proxyUrl.pathname = proxyUrl.pathname.replace(new RegExp('/$'), '') +
        requestUrlExtra;
    proxyRequest(req, res, proxyUrl,
                 {httpRequestFunction:  this.httpRequestFunction,
                  httpsRequestFunction: this.httpsRequestFunction,
                  setHostHeader:        this.setHostHeader});
};

var RoboHydraHeadFilter = function(props) {
    props = props || {filter: function(body) { return body; }};
    RoboHydraHead.call(this, props);
    if (typeof this.filter !== 'function') {
        throw new InvalidRoboHydraHeadException("Property 'filter' must be a function");
    }
};
RoboHydraHeadFilter.parent = RoboHydraHead;
RoboHydraHeadFilter.prototype = new RoboHydraHeadFilter.parent();
RoboHydraHeadFilter.prototype.type = 'filter';
RoboHydraHeadFilter.prototype._mandatoryProperties = ['filter'];
RoboHydraHeadFilter.prototype._optionalProperties =
    RoboHydraHeadFilter.prototype._optionalProperties.concat('path');
RoboHydraHeadFilter.prototype._compressionAwareFilter =
    function(compressionMethod, data, filter, cb) {
        var compress, uncompress;

        switch (compressionMethod) {
        case 'gzip':
            compress   = zlib.gzip;
            uncompress = zlib.gunzip;
            break;

        case 'deflate':
            compress   = zlib.deflate;
            uncompress = zlib.inflate;
            break;

        default:
            // If unknown (or no) compression method, pass-through
            compress = uncompress =
                function(data, cb) { cb(undefined,
                                        typeof data === 'string' ?
                                            new Buffer(data) : data); };
            break;
        }

        // What happens with corrupt compressed data? Node 0.6.x's zlib
        // doesn't seem to give proper error messages when the data is
        // corrupt
        uncompress(data, function(err, plainData) {
            if (err) {
                cb(err);
            } else {
                var filteredData = filter(plainData);
                if (filteredData === undefined) {
                    throw new InvalidRoboHydraHeadException("The filter function must never return undefined");
                }
                compress(filteredData, function(err, compressedData) {
                    cb(err, compressedData);
                });
            }
        });
    };
RoboHydraHeadFilter.prototype._handle = function(req, res, next) {
    var self = this;
    var fakeRes = new Response(function() {
        self._compressionAwareFilter(
            fakeRes.headers['content-encoding'],
            fakeRes.body,
            self.filter.bind(self),
            function(err, data) {
                fakeRes.body = data;
                res.copyFrom(fakeRes);
                if (res.headers['content-length'] !== undefined) {
                    res.headers['content-length'] = res.body.length;
                }
                res.end();
            }
        );
    });
    next(req, fakeRes);
};



var RoboHydraHeadWatchdog = function(props) {
    props = props || {watcher: function() { return false; }};
    if (typeof props.watcher !== 'function') {
        throw new InvalidRoboHydraHeadException("Property 'watcher' must be a function");
    }
    if (props.reporter !== undefined && typeof props.reporter !== 'function') {
        throw new InvalidRoboHydraHeadException("Property 'reporter' must be a function");
    }

    props.path = props.path || '/.*';
    props.reporter = props.reporter || function(req, res) {
        console.warn("XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX");
        console.warn("Watchdog found request " + req.url);
        console.warn("XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX");
    };
    RoboHydraHead.call(this, props);
    this.reporter = props.reporter;
};
RoboHydraHeadWatchdog.parent = RoboHydraHead;
RoboHydraHeadWatchdog.prototype = new RoboHydraHeadWatchdog.parent();
RoboHydraHeadWatchdog.prototype.type = 'watchdog';
RoboHydraHeadWatchdog.prototype._mandatoryProperties = ['watcher'];
RoboHydraHeadWatchdog.prototype._optionalProperties =
    RoboHydraHeadWatchdog.prototype._optionalProperties.concat('path', 'reporter');
RoboHydraHeadWatchdog.prototype._uncompress =
    function(compressionMethod, data, cb) {
        var uncompress;

        switch (compressionMethod) {
        case 'gzip':
            uncompress = zlib.gunzip; break;
        case 'deflate':
            uncompress = zlib.inflate; break;
        default:
            // If unknown (or no) compression method, pass-through
            uncompress = function(data, cb) { cb(undefined, data); };
        }

        // What happens with corrupt compressed data? Node 0.6.x's zlib
        // doesn't seem to give proper error messages when the data is
        // corrupt
        uncompress(data, cb);
    };
RoboHydraHeadWatchdog.prototype._handle = function(req, res, next) {
    var head = this;
    var fakeRes = new Response().on('end', function(evt) {
        var response = evt.response;
        head._uncompress(
            response.headers['content-encoding'],
            response.body,
            function(err, data) {
                if (err) {
                    console.log("XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX");
                    console.log("WARNING: Error uncompressing response body");
                    console.log("XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX");
                }

                var newRes = new Response();
                newRes.copyFrom(response);
                newRes.rawBody = newRes.body;
                // This will be undefined (or whatever) if it couldn't
                // be uncompressed, but the rawBody will always be
                // available, so it's probably fine?
                newRes.body = data;

                if (head.watcher(req, newRes)) {
                    head.reporter(req, newRes);
                }

                res.forward(response);
            }
        );
    });
    next(req, fakeRes);
};



exports.InvalidRoboHydraHeadException = InvalidRoboHydraHeadException;
exports.RoboHydraHead = RoboHydraHead;
exports.RoboHydraHeadStatic = RoboHydraHeadStatic;
exports.RoboHydraHeadFilesystem = RoboHydraHeadFilesystem;
exports.RoboHydraHeadProxy = RoboHydraHeadProxy;
exports.RoboHydraHeadFilter = RoboHydraHeadFilter;
exports.RoboHydraHeadWatchdog = RoboHydraHeadWatchdog;
