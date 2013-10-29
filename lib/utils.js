var url   = require('url'),
    http  = require('http'),
    https = require('https'),
    fs    = require('fs'),
    qs    = require('qs'),
    mime  = require('mime');
var exceptions = require('./exceptions'),
    InvalidRoboHydraRequestException =
        exceptions.InvalidRoboHydraRequestException,
    InvalidRoboHydraResponseException =
        exceptions.InvalidRoboHydraResponseException,
    InvalidRoboHydraResponseEventException =
        exceptions.InvalidRoboHydraResponseEventException;


(function () {
    "use strict";

    function serveStaticFile(filePath, res, opts) {
        opts = opts || {};
        var fsObject   = opts.fs      || fs;
        var mimeObject = opts.mime    || mime;
        var headers    = opts.headers || {};
        var indexFiles = opts.indexFiles || ['index.html', 'index.htm',
                                             'home.html',  'home.htm'];
        var path = filePath.split('?')[0];

        fsObject.stat(path, function(err, stats) {
            if (!err) {
                if (stats.isFile()) {
                    var mtime = stats.mtime,
                        modifiedSince = headers['if-modified-since'];

                    // Check modification date, if available
                    if (!modifiedSince || new Date(modifiedSince) < mtime) {
                        fsObject.readFile(path, function(err, data) {
                            res.headers["content-type"]  = mimeObject.lookup(path);
                            res.headers["last-modified"] = mtime.toUTCString();
                            res.send(data);
                        });

                        // 304 - Not Modified
                    } else {
                        res.statusCode = 304;
                        res.end();
                    }
                    // If it's a directory, try to serve one of the index files
                } else if (stats.isDirectory()) {
                    for (var i = 0, len = indexFiles.length; i < len; i++) {
                        var indexFilePath = path + "/" + indexFiles[i];
                        try {
                            // This will throw an exception if the file is
                            // not there
                            fsObject.statSync(indexFilePath);
                            serveStaticFile(indexFilePath, res, opts);
                            return;
                        } catch (e) {
                            // Ignore if the file is not there; otherwise...
                            if (e.code !== 'ENOENT') {
                                throw e;
                            }
                        }
                    }

                    res.statusCode = 403;
                    res.send("Directory listing forbidden");
                }

                // 404 - Not Found
            } else {
                res.statusCode = 404;
                res.send("Not Found");
            }
        });
    }

    function proxyRequest(req, res, proxyTo, opts) {
        opts = opts || {};
        var httpRequestFunction  = opts.httpRequestFunction  || http.request;
        var httpsRequestFunction = opts.httpsRequestFunction || https.request;
        var setHostHeader = opts.setHostHeader;

        var proxyUrl = proxyTo;
        if (typeof(proxyTo) === 'string') {
            proxyUrl = url.parse(proxyTo);
        }
        var proxyToHost = proxyUrl.hostname;
        var proxyToPort = proxyUrl.port ||
                (proxyUrl.protocol === 'https:' ? 443 : 80);
        var proxyToPath = proxyUrl.pathname;
        var requestFunction = (proxyUrl.protocol === 'https:') ?
                httpsRequestFunction : httpRequestFunction;
        var headers = {};
        for (var h in req.headers) { headers[h] = req.headers[h]; }
        if (setHostHeader) {
            headers.host = proxyToHost +
                (proxyUrl.port ? ":" + proxyUrl.port : "");
        }

        var proxyReq = requestFunction(
            {host: proxyToHost,
             port: proxyToPort,
             method: req.method,
             path: proxyToPath,
             headers: headers},
            function (proxyRes) {
                // Copy over headers and status code from proxied request
                res.statusCode = proxyRes.statusCode;
                res.headers    = proxyRes.headers;

                proxyRes.on("data", function (chunk) {
                    res.write(chunk);
                });

                proxyRes.on("end", function () {
                    res.end();
                });
            });

        proxyReq.on('error', function (err) {
            res.statusCode = 502;
            res.send('Bad Gateway! Could not proxy request. Invalid host or proxy destination down? Reported error was: ' + err);
        });

        if (req.rawBody) {
            proxyReq.write(req.rawBody);
        }
        proxyReq.end();
    }


    function stringForLog(req, res) {
        var remoteAddr = req.socket && req.socket.remoteAddress || "-";
        var date = new Date().toUTCString();
        var method = req.method;
        var url = req.url;
        var httpVersion = req.httpVersionMajor + '.' + req.httpVersionMinor;
        var status = res.statusCode;
        var resContentLength = res.headers['content-length'] || "-";
        var referrer = req.headers.referer || req.headers.referrer || "-";
        var userAgent = req.headers['user-agent'] || "-";

        return remoteAddr + " - - [" + date + "] \"" + method + " " +
            url + " HTTP/" + httpVersion + "\" " + status + " " +
            resContentLength + " \"" + referrer + "\" \"" + userAgent + "\"";
    }


    /*
     *  This function extends the given object with any number of
     *  other objects (parameters two, three, etc.), and returns it.
     */
    function extendObject(obj) {
        for (var i = 1, len = arguments.length; i < len; i++) {
            for (var p in arguments[i]) {
                if (arguments[i].hasOwnProperty(p)) {
                    obj[p] = arguments[i][p];
                }
            }
        }

        return obj;
    }


    function deprecationWarning(msg) {
        var prefix       = "*** WARNING: ",
            suffix       = " ***",
            borderLength = msg.length + prefix.length + suffix.length,
            border       = new Array(borderLength + 1).join("*");
        console.warn(border);
        console.warn(prefix + msg + suffix);
        console.warn(border);
    }


    var Request = function(props) {
        // From the constructor parameter
        this.url     = props.url;
        this.method  = (props.method || 'GET').toUpperCase();
        this.headers = extendObject({}, props.headers || {});
        this.rawBody = props.rawBody || new Buffer("");
        this.bodyParams = qs.parse(this.rawBody.toString());

        // Calculated
        this.queryParams = url.parse(this.url, true).query;
        Object.defineProperty(this, "getParams", {
            get: function() {
                console.warn("WARNING: 'getParams' is deprecated, use 'queryParams' instead");
                return this.queryParams;
            }
        });

        if (this.url === undefined) {
            throw new InvalidRoboHydraRequestException('url', this.url);
        }
    };



    var Response = function(cb) {
        this.body       = new Buffer(0);
        this.statusCode = 200;
        this.headers    = {};
        this.ended      = false;
        var endHandlers = [];
        if (typeof cb === 'function') { endHandlers.push(cb); }
        this.eventHandlers = {head: [], data: [], end: endHandlers};
    };
    Response.prototype._fireEvent = function(eventName, evtObject) {
        var eventHandlers = this.eventHandlers[eventName];
        if (eventHandlers.length) {
            var finalEventObject = {};
            for (var p in evtObject) { finalEventObject[p] = evtObject[p]; }
            evtObject.type = eventName;
            for (var i = 0, len = eventHandlers.length; i < len; i++) {
                eventHandlers[i].call(this, evtObject);
            }
            return true;
        }
        return false;
    };
    Response.prototype.writeHead = function(statusCode, headers) {
        this.statusCode = statusCode;
        this.headers    = headers || {};
        if (this._fireEvent('head', {statusCode: this.statusCode,
                                     headers: this.headers})) {
            this._hasWrittenHead = true;
        }
    };
    Response.prototype.write = function(chunk) {
        chunk = chunk || "";
        if (typeof chunk === 'string') {
            chunk = new Buffer(chunk);
        }
        var tmp = new Buffer(this.body.length + chunk.length);
        this.body.copy(tmp);
        chunk.copy(tmp, this.body.length);
        this.body = tmp;
        if (! this._hasWrittenHead) {
            this._fireEvent('head', {statusCode: this.statusCode,
                                     headers: this.headers});
            this._hasWrittenHead = true;
        }
        this._fireEvent('data', {data: chunk});
        this._hasWrittenBody = true;
    };
    Response.prototype.send = function(data) {
        this.write(data);
        this.end();
    };
    Response.prototype.end = function() {
        if (! this._hasWrittenHead) {
            this._fireEvent('head', {statusCode: this.statusCode,
                                     headers: this.headers});
        }

        if (! this._hasWrittenBody && this.body.length) {
            this._fireEvent('data', {data: this.body});
        }

        this.ended = true;
        if (! this._fireEvent('end', {response: this})) {
            throw new InvalidRoboHydraResponseException(this);
        }
    };
    Response.prototype.copyFrom = function(res) {
        var self = this;
        ['statusCode', 'headers', 'body'].forEach(function(prop) {
            self[prop] = res[prop];
        });
    };
    Response.prototype.forward = function(res) {
        this.copyFrom(res);
        this.end();
    };
    Response.prototype.on = function(eventName, cb) {
        if (this.eventHandlers.hasOwnProperty(eventName)) {
            this.eventHandlers[eventName].push(cb);
            return this;
        } else {
            throw new InvalidRoboHydraResponseEventException(eventName);
        }
    };
    Response.prototype.chain = function(response) {
        this.on('head', function(evt) {
            response.writeHead(evt.statusCode, evt.headers);
        });
        this.on('data', function(evt) {
            response.write(evt.data);
        });
        this.on('end', function() {
            response.end();
        });
        return this;
    };



    exports.serveStaticFile    = serveStaticFile;
    exports.proxyRequest       = proxyRequest;
    exports.stringForLog       = stringForLog;
    exports.extendObject       = extendObject;
    exports.deprecationWarning = deprecationWarning;
    exports.Request            = Request;
    exports.Response           = Response;
}());
