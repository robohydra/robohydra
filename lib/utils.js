var url   = require('url'),
    http  = require('http'),
    https = require('https'),
    fs    = require('fs'),
    mime  = require('mime');

var InvalidRoboHydraResponseException = function(plugin, test,  args) {
    this.name    = "InvalidRoboHydraResponseException";
    this.message = 'No "end" event handler for this response object';
};
InvalidRoboHydraResponseException.prototype.toString = function() {
    return "InvalidRoboHydraResponseException";
};
var InvalidRoboHydraResponseEventException = function(eventName) {
    this.name    = "InvalidRoboHydraResponseEventException";
    this.message = 'There\'s no "' + eventName + '" event';
};
InvalidRoboHydraResponseEventException.prototype.toString = function() {
    return "InvalidRoboHydraResponseEventException";
};

var InvalidRoboHydraRequestException = function(propName, propValue) {
    this.name    = "InvalidRoboHydraRequestException";
    this.message = 'Invalid request: property "' + propName +
        '" had value "' + propValue + '"';
};
InvalidRoboHydraRequestException.prototype.toString = function() {
    return "InvalidRoboHydraRequestException";
};



function serveStaticFile(filePath, res, opts) {
    opts = opts || {};
    var fsObject   = opts.fs      || fs;
    var mimeObject = opts.mime    || mime;
    var headers    = opts.headers || {};
    var indexFiles = opts.indexFiles || ['index.html', 'index.htm',
                                         'home.html',  'home.htm'];

    fsObject.stat(filePath, function(err, stats) {
        if (!err) {
            if (stats.isFile()) {
                var mtime = stats.mtime,
                    modifiedSince = headers['if-modified-since'];

                // Check modification date, if available
                if (!modifiedSince || new Date(modifiedSince) < mtime) {
                    fsObject.readFile(filePath, function(err, data) {
                        res.headers["content-type"]  = mimeObject.lookup(filePath);
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
                    var indexFilePath = filePath + "/" + indexFiles[i];
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


var Request = function(props) {
    // From the constructor parameter
    this.url     = props.url;
    this.method  = props.method || 'GET';
    this.headers = props.headers || {};
    this.rawBody = props.rawBody || new Buffer("");
    // Calculated
    this.queryParams = url.parse(this.url, true).query;
    Object.defineProperty(this, "getParams", {
        get: function() {
            console.log("WARNING: 'getParams' is deprecated, use 'queryParams' instead");
            return this.queryParams;
        }
    });

    if (this.url === undefined) {
        throw new InvalidRoboHydraRequestException('url', this.url);
    }
};



var Response = function(cb) {
    this.body          = new Buffer(0);
    this.statusCode    = 200;
    this.headers       = {};
    var endHandlers = [];
    if (typeof cb === 'function') { endHandlers.push(cb); }
    this.eventHandlers = {head: [], data: [], end: endHandlers};
};
Response.prototype._fireEvent = function(eventName, params) {
    params = params || [];
    var eventHandlers = this.eventHandlers[eventName];
    if (eventHandlers.length) {
        for (var i = 0, len = eventHandlers.length; i < len; i++) {
            eventHandlers[i].apply(this, params);
        }
        return true;
    }
    return false;
};
Response.prototype.writeHead = function(statusCode, headers) {
    this.statusCode = statusCode;
    this.headers    = headers || {};
    if (this._fireEvent('head', [this.statusCode, this.headers])) {
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
        this._fireEvent('head', [this.statusCode, this.headers]);
        this._hasWrittenHead = true;
    }
    this._fireEvent('data', [chunk]);
};
Response.prototype.send = function(data) {
    this.write(data);
    this.end();
};
Response.prototype.end = function(res) {
    if (! this._hasWrittenHead) {
        this._fireEvent('head', [this.statusCode, this.headers]);
    }

    if (! this._fireEvent('end', [this])) {
        throw new InvalidRoboHydraResponseException(this);
    }
};
Response.prototype.copyFrom = function(res) {
    var self = this;
    ['statusCode', 'headers'].forEach(function(prop) {
        self[prop] = res[prop];
    });
    if (res.body.length) {
        this.write(res.body);
    }
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
    this.on('head', function(statusCode, headers) {
        response.writeHead(statusCode, headers);
    });
    this.on('data', function(chunk) {
        response.write(chunk);
    });
    this.on('end', function(_) {
        response.end();
    });
    return this;
};



exports.serveStaticFile = serveStaticFile;
exports.proxyRequest    = proxyRequest;
exports.Request         = Request;
exports.Response        = Response;
