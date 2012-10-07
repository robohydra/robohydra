var fs    = require('fs'),
    mime  = require('mime'),
    http  = require('http'),
    https = require('https'),
    url   = require('url'),
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

/*

 Notes on creating RoboHydraHead* classes:

 * By convention, all classes set a 'parent' property.

 * By convention, all classes have a 'type' property with a simple
   name for the class. This is used in the admin UI.

 * All classes have an array of mandatory properties and optional
   properties in 'mandatoryProperties' and 'optionalProperties'.

 * Classes should always provide a set of default properties in the
   constructor if no argument is passed at all, to ease the creation
   of other classes inheriting from it.

 * All class constructors call "importProperties" with the current
   class and the property object received as a parameter, to copy the
   relevant properties to the object, and check that there are no
   invalid properties.

 * All class constructors call "inherit" with the parent class (always
   available as CurrentClass.parent, see above) with the property
   object received as a parameter, plus any extra properties to be
   passed to the parent class.

 */

var RoboHydraHead = function(props) {
    // If you don't pass props at all, created a "generic", valid
    // RoboHydra head. This is useful for inheritance and for when you
    // don't really care about the behaviour of the head (you just
    // want one created)
    props = props || {path: '/.*', handler: function(_, res) {res.end();}};

    this.importProperties(RoboHydraHead, props);

    var self = this;
    this._attached = !props.detached;
    this.requestParamNames = [];
    this.path = this.normalizePath(props.path || '/.*').
            replace(/:(\w+)/g,
                    function(_, name) {
                        self.requestParamNames.push(name);
                        return '([^/]+)';
                    });
};
RoboHydraHead.type = 'generic';
RoboHydraHead.mandatoryProperties = ['path', 'handler'];
RoboHydraHead.optionalProperties = ['name', 'detached'];
Object.defineProperty(RoboHydraHead.prototype,
                      'type',
                      {get: function() {
                          return this.constructor.type;
                      }});
RoboHydraHead.prototype.importProperties = function(classObject, props) {
    classObject.mandatoryProperties.forEach(function(p) {
        if (props[p] === undefined) {
            throw new InvalidRoboHydraHeadException("Missing mandatory property '" + p + "'");
        }
    });

    for (var p in props) {
        if (classObject.mandatoryProperties.indexOf(p) === -1 &&
                classObject.optionalProperties.indexOf(p) === -1) {
            throw new InvalidRoboHydraHeadException("Unknown property '" + p + "'");
        }

        this[p] = props[p];
    }
};
RoboHydraHead.prototype.inherit = function(classObject, props, extraProps) {
    var parentProps = {};
    classObject.mandatoryProperties.forEach(function(prop) {
        parentProps[prop] = props[prop];
    });
    classObject.optionalProperties.forEach(function(prop) {
        parentProps[prop] = props[prop];
    });
    for (var extraProp in extraProps) {
        parentProps[extraProp] = extraProps[extraProp];
    }

    classObject.call(this, parentProps);
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

    this.importProperties(RoboHydraHeadStatic, props);
    if (this.content === undefined && this.responses === undefined) {
        throw new InvalidRoboHydraHeadException("RoboHydraHeadStatic needs either 'content' or 'responses'");
    }
    if (this.responses !== undefined && this.responses.length === 0) {
        throw new InvalidRoboHydraHeadException("RoboHydraHeadStatic 'responses', if given, must be a non-empty array");
    }

    this.inherit(RoboHydraHeadStatic.parent, props, {path: props.path || '/.*',
                                                     handler: this._handle});

    this.responseIndex = 0;
};
RoboHydraHeadStatic.parent = RoboHydraHead;
RoboHydraHeadStatic.prototype = new RoboHydraHeadStatic.parent();
RoboHydraHeadStatic.type = 'static';
RoboHydraHeadStatic.mandatoryProperties = [];
RoboHydraHeadStatic.optionalProperties =
 RoboHydraHeadStatic.parent.optionalProperties.concat('path', 'responses', 'content', 'statusCode', 'contentType');
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
    props = props || {mountPath: '/', handler: function(_, res) {res.end();}};

    this.importProperties(RoboHydraHeadMounted, props);
    this.mountPath = this.normalizePath(this.mountPath || '/');

    this.inherit(RoboHydraHeadMounted.parent,
                 props,
                 {path: this.mountPath + '.*',
                  handler: this._handle});
};
RoboHydraHeadMounted.parent = RoboHydraHead;
RoboHydraHeadMounted.mandatoryProperties = ['mountPath', 'handler'];
RoboHydraHeadMounted.optionalProperties =
    RoboHydraHeadMounted.parent.optionalProperties.slice();
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

    this.importProperties(RoboHydraHeadFilesystem, props);
    this.fs         = this.fs         || fs;
    this.mime       = this.mime       || mime;

    this.inherit(RoboHydraHeadFilesystem.parent,
                 props,
                 {mountPath: props.mountPath || '/',
                  handler: this._handle});
};
RoboHydraHeadFilesystem.parent = RoboHydraHeadMounted;
RoboHydraHeadFilesystem.prototype = new RoboHydraHeadFilesystem.parent();
RoboHydraHeadFilesystem.type = 'filesystem';
RoboHydraHeadFilesystem.mandatoryProperties = ['documentRoot'];
RoboHydraHeadFilesystem.optionalProperties =
    RoboHydraHeadFilesystem.parent.optionalProperties.concat(['mountPath', 'fs', 'mime', 'indexFiles']);
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

    this.importProperties(RoboHydraHeadProxy, props);
    this.mountPath           = this.normalizePath(this.mountPath || '/');
    this.httpRequestFunction =
        this.httpRequestFunction || http.request;
    this.httpsRequestFunction =
        this.httpsRequestFunction || https.request;

    this.inherit(RoboHydraHeadProxy.parent,
                 props,
                 {mountPath: props.mountPath || '/',
                  handler: this._handle});
};
RoboHydraHeadProxy.parent = RoboHydraHeadMounted;
RoboHydraHeadProxy.prototype = new RoboHydraHeadProxy.parent();
RoboHydraHeadProxy.type = 'proxy';
RoboHydraHeadProxy.mandatoryProperties = ['proxyTo'];
RoboHydraHeadProxy.optionalProperties =
    RoboHydraHeadProxy.parent.optionalProperties.concat('mountPath', 'httpRequestFunction', 'httpsRequestFunction', 'setHostHeader');
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

    this.importProperties(RoboHydraHeadFilter, props);
    if (typeof this.filter !== 'function') {
        throw new InvalidRoboHydraHeadException("Property 'filter' must be a function");
    }

    this.inherit(RoboHydraHeadFilter.parent,
                 props,
                 {path: props.path || '/.*', handler: this._handle});
};
RoboHydraHeadFilter.parent = RoboHydraHead;
RoboHydraHeadFilter.prototype = new RoboHydraHeadFilter.parent();
RoboHydraHeadFilter.type = 'filter';
RoboHydraHeadFilter.mandatoryProperties = ['filter'];
RoboHydraHeadFilter.optionalProperties =
    RoboHydraHeadFilter.parent.optionalProperties.concat('path');
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

    this.importProperties(RoboHydraHeadWatchdog, props);
    if (typeof this.watcher !== 'function') {
        throw new InvalidRoboHydraHeadException("Property 'watcher' must be a function");
    }
    if (this.reporter !== undefined && typeof this.reporter !== 'function') {
        throw new InvalidRoboHydraHeadException("Property 'reporter' must be a function");
    }

    this.path = this.path || '/.*';
    this.reporter = this.reporter || function(req, res) {
        console.warn("XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX");
        console.warn("Watchdog found request " + req.url);
        console.warn("XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX");
    };

    this.inherit(RoboHydraHeadWatchdog.parent,
                 props,
                 {path: this.path, handler: this._handle});
};
RoboHydraHeadWatchdog.parent = RoboHydraHead;
RoboHydraHeadWatchdog.prototype = new RoboHydraHeadWatchdog.parent();
RoboHydraHeadWatchdog.type = 'watchdog';
RoboHydraHeadWatchdog.mandatoryProperties = ['watcher'];
RoboHydraHeadWatchdog.optionalProperties =
    RoboHydraHeadWatchdog.parent.optionalProperties.concat('path', 'reporter');
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

var RoboHydraHeadProxyCache = function(props) {
    RoboHydraHeadProxy.call(this, props);
    this.setHostHeader = props.setHostHeader;
    this.cacheLifeTime = props.cacheLifeTime;
    if (props.invalidateCachePathSuffix)
        this.invalidateCacheRegExp = new RegExp(props.invalidateCachePathSuffix + '$');

    this.urlToPath = props.urlToPath || this._defaultUrlToPath;
    this.serveCache = props.serveCache || this._defaultServeCache;
    this.cachePage = props.cachePage || this._defaultCachePage;

    // take advantage of the RoboHydraHeadProxy (_handle method)
    var head = this;
    RoboHydraHeadProxy.prototype.setHostHeader = this.setHostHeader;
    RoboHydraHeadProxy.prototype._relativePath = this._relativePath;
    this.RoboHydraHeadProxyHandle = function(req, res, next) {
        RoboHydraHeadProxy.prototype._handle.call(head, req, res, next);
    };
};
RoboHydraHeadProxyCache.parent = RoboHydraHeadMounted;
RoboHydraHeadProxyCache.prototype = new RoboHydraHeadProxyCache.parent();
RoboHydraHeadProxyCache.prototype.type = 'proxy cache';
RoboHydraHeadProxyCache.prototype._mandatoryProperties = ['proxyTo', 'documentRoot'];
RoboHydraHeadProxyCache.prototype._optionalProperties =
    /*
     * setHostHeader - used by RoboHydraProxy
     * cacheLifeTime - lifetime in seconds
     * invalidateCachePathSuffix (eg. ':r') - regular expresion - it is stripped out from the final request
     * urlToPath (function) - used by serveCache and cachePage to find the right file
     * serveCache (function) - find the cache record accoarding to given url
     * cachePage (functino) - save given data from given url to the cache
     */
    RoboHydraHeadProxyCache.prototype._optionalProperties.concat('mountPath', 'setHostHeader', 'cacheLifeTime', 'invalidateCachePathSuffix',
            'urlToPath', 'serveCache', 'cachePage');
RoboHydraHeadProxyCache.prototype._defaultUrlToPath =
    function (url) {
        // remove leading & trailing slash & '/' -> '_'
        return this.documentRoot + '/' + url.substr(1).replace(new RegExp('/$'), '').replace(/\//g, '_');
    };
RoboHydraHeadProxyCache.prototype._defaultServeCache =
    function (url, dataCallback, errorCallback) {
        var filePath = this.urlToPath(url);
        var head = this;
        fs.stat(filePath, function(err, stats) {
            if (err || (head.cacheLifeTime && Date.now() > (stats.mtime.getTime() + head.cacheLifeTime * 1000))) {
                errorCallback();
            } else {
                fs.readFile(filePath, function(err, data) {
                    if (err) {
                        console.log("\nERROR when trying to read from file " + filePath + "\n");
                        errorCallback();
                    } else {
                        dataCallback(data);
                    }
                });
            }
        });
    };
RoboHydraHeadProxyCache.prototype._defaultCachePage =
    function (url, page, readyCallback) {
        var filePath = this.urlToPath(url);
        fs.writeFile(filePath, page, function(err) {
            if (err)
                console.log("\nERROR when trying to write to file " + filePath + "\n");
            readyCallback();
        });
    };
RoboHydraHeadProxyCache.prototype._handle = function(req, res, next) {
    var head = this;
    var servePage = function(page) {
        console.log("Cache HIT: " + req.url);
        res.send(page);
    };
    var cacheReq = function(res, readyCallback) {
        res.on('end', function(ev) {
            // cache uncompressed body
            ev.response.uncompressBody(function(err, body) {
                head.cachePage(req.url, body, readyCallback);
            });
        });
        head.RoboHydraHeadProxyHandle(req, res, next);
    };

    if (this.invalidateCacheRegExp && this.invalidateCacheRegExp.test(req.url)) {
        req.url = req.url.replace(this.invalidateCacheRegExp, '');
        var fakeRes = new Response();
        cacheReq(fakeRes, function() {
            // redirect
            res.statusCode = 302;
            res.headers['Location'] = req.url;
            res.end();
        });
    } else {
        this.serveCache(req.url, servePage, function() {
            cacheReq(res, function() {});
        });
    }
};


exports.InvalidRoboHydraHeadException = InvalidRoboHydraHeadException;
exports.RoboHydraHead = RoboHydraHead;
exports.RoboHydraHeadStatic = RoboHydraHeadStatic;
exports.RoboHydraHeadFilesystem = RoboHydraHeadFilesystem;
exports.RoboHydraHeadProxy = RoboHydraHeadProxy;
exports.RoboHydraHeadFilter = RoboHydraHeadFilter;
exports.RoboHydraHeadWatchdog = RoboHydraHeadWatchdog;
exports.RoboHydraHeadProxyCache = RoboHydraHeadProxyCache;
