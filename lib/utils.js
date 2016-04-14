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
        exceptions.InvalidRoboHydraResponseEventException,
    InvalidRoboHydraConfigurationException =
        exceptions.InvalidRoboHydraConfigurationException;
var VALID_CONFIG_KEYS = ["plugins", "pluginConfigDefaults",
                         "pluginLoadPaths", "summoner", "secure",
                         "sslOptions", "port", "quiet"];


(function () {
    "use strict";

    /**
     * Utility functions.
     *
     * @class robohydra
     */

    /**
     * Serves a static file with correct headers and such, writing the
     * result in the given response object.
     *
     * @method serveStaticFile
     * @for robohydra
     * @param {String} filePath The full path of the file to be served.
     * @param {Response} res Response object to write the response to.
     * @param {Object} opts
     * @param {Object} opts.fs The 'fs' module (or a mock) to be used
     * when reading from the filesystem.
     * @param {Object} opts.mime The 'mime' module (or a mock) to be
     * used when figuring out the MIME type for a file.
     * @param {Object} opts.headers An object with the incoming
     * request headers (for caching and such).
     * @param {Array} opts.indexFiles An array with the filenames to
     * be used as index if the given file path is a directory (by
     * default, "index.html", "index.htm", "home.html" and
     * "home.htm").
     */
    function serveStaticFile(path, res, opts) {
        opts = opts || {};
        var fsObject   = opts.fs      || fs;
        var mimeObject = opts.mime    || mime;
        var headers    = opts.headers || {};
        var indexFiles = opts.indexFiles || ['index.html', 'index.htm',
                                             'home.html',  'home.htm'];

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

    /**
     * Proxies the given request to the given URL, writing the result
     * in the given response object.
     *
     * @method proxyRequest
     * @for robohydra
     * @param {Request} req The request object to proxy.
     * @param {Response} res The response object to write the result to.
     * @param {URL} proxyTo The URL to proxy to, either in the form of
     * a URL object (result of the url.parse method) or a string.
     * @param {Object} opts
     * @param {Function} opts.httpRequestFunction The http.request
     * function or a mock of it.
     * @param {Function} opts.httpsRequestFunction The https.request
     * function or a mock of it.
     * @param {Boolean} opts.setHostHeader Specifies if the "Host"
     * header should be set in the proxied request, so pretend as if
     * the original request was indeed intended for the final
     * URL. Defaults to false.
     */
    function proxyRequest(req, res, proxyTo, opts) {
        opts = opts || {};
        var httpRequestFunction  = opts.httpRequestFunction  || http.request;
        var httpsRequestFunction = opts.httpsRequestFunction || https.request;
        var setHostHeader = opts.setHostHeader;

        var proxyUrl = proxyTo;
        if (typeof(proxyTo) === 'string') {
            proxyUrl = url.parse(proxyTo, true);
        }
        var proxyToHost = proxyUrl.hostname;
        var proxyToPort = proxyUrl.port ||
                (proxyUrl.protocol === 'https:' ? 443 : 80);
        var proxyToPath = proxyUrl.pathname + proxyUrl.search;
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


    function resolveConfig(config) {
        Object.keys(config).forEach(function(configKey) {
            if (VALID_CONFIG_KEYS.indexOf(configKey) === -1) {
                throw new InvalidRoboHydraConfigurationException(
                    "Invalid configuration key '" + configKey + "'"
                );
            }
        });

        var finalConfig = extendObject({}, config);

        if (finalConfig.pluginConfigDefaults) {
            finalConfig.plugins = finalConfig.plugins.map(function(plugin) {
                if (typeof plugin === 'string') {
                    plugin = {name: plugin, config: {}};
                }
                plugin.config = extendObject({},
                                             finalConfig.pluginConfigDefaults,
                                             plugin.config);
                return plugin;
            });
        }

        return finalConfig;
    }


    /**
     * Represents an incoming client request.
     * @class Request
     * @constructor
     * @param {Object} props
     * @param {String} props.url Request URL
     * @param {String} props.method Request method ("GET", "POST", ...)
     * @param {Object} props.headers Request headers
     * @param {Buffer} props.upgrade Whether or not the request is an
     * upgrade request
     * @param {Buffer} props.rawBody Request body, if any
     */
    /**
     * Request URL path, including GET parameters (eg. `/foo`,
     * `/bar/qux`, `/articles?order=date`).
     *
     * @attribute url
     * @type String
     */
    /**
     * Request method, normalised to uppercase.
     *
     * @attribute method
     * @type String
     */
    /**
     * Request headers. Note that the header names are Node-style
     * (ie. lowercase).
     *
     * @attribute headers
     * @type Object
     */
    /**
     * Request body, if the body was parseable. Otherwise,
     * `undefined`.
     *
     * @attribute rawBody
     * @type Buffer
     */
    /**
     * Request body parameters.
     *
     * @attribute bodyParams
     * @type Object
     */
    /**
     * Request query parameters ("GET" parameters).
     *
     * @attribute queryParams
     * @type Object
     */
    /**
     * Request query parameters ("GET" parameters).
     *
     * @attribute getParams
     * @type Object
     * @deprecated
     */
    /**
     * Request URL path captured parameters. Note that this attribute
     * is only available in request objects passed directly by
     * RoboHydra, not in user-created request objects.
     *
     * When defining URL paths, expressions like `:id` or `:user` can
     * be used as part of the regular expression (eg. `/save/:id` or
     * `/:user/preferences`). These expressions will match any URL
     * path fragment, and the matched contents will be available in
     * the `params` object in the request object. For example, if you
     * have a head for path `/articles/:articleid/view` and you
     * receive a request for
     * `/articles/introduction-to-robohydra/view`, the request object
     * will have a `params` property with a single property,
     * `articleid` with value `introduction-to-robohydra`.
     *
     * @attribute params
     * @type Object
     */
    function Request(props) {
        // From the constructor parameter
        this.url     = props.url;
        this.method  = (props.method || 'GET').toUpperCase();
        this.headers = extendObject({}, props.headers || {});
        this.upgrade = props.upgrade || false;
        this.rawBody = props.rawBody || new Buffer("");
        this.body    = this._parseBody();
        
        try {
            this.bodyParams = qs.parse(this.rawBody.toString());
        } catch (e) {
            // Ignore, we don't care if the body could not be parsed
        }

        // Calculated
        this.queryParams = url.parse(this.url, true).query;
        Object.defineProperty(this, "getParams", {
            get: function() {
                deprecationWarning("'getParams' is deprecated, use 'queryParams' instead");
                return this.queryParams;
            }
        });

        if (this.url === undefined) {
            throw new InvalidRoboHydraRequestException('url', this.url);
        }
    }

    /**
     * Automatically parses the 'Request.rawBody' property into the expected
     * internal type for usage as the 'Request.body'. 
     *
     * To extend the conversion behaviour for more headers, just add a new kvp.
     * 
     * * Key should be the name of a header, without / and -
     * * Value should be a function which returns the body.
     * 
     * @return {object} Parsed post-body according to content-type and charset.
     */
    Request.prototype._parseBody = function() {
        var params = getHeaderInfo(this.headers);
        var req    = this;
        var conversionStrategies = {
            applicationjson: function(charset) {
                return JSON.parse(req.rawBody.toString(charset));
            },
            textplain: function(charset) {
                return req.rawBody.toString(charset);
            },
            texthtml: function(charset) {
                return req.rawBody.toString(charset);
            },
            default: function() {
                return req.rawBody;
            }
        };

        var strategy = conversionStrategies[params.type] || conversionStrategies['default'];  

        try {
            return strategy(params.charset);    
        } catch (err) {
            return null;
        }
    }

    /**
     * Simplifies the interface for getting a clean content-type & charset header value.
     * @param  {string} headerValue A header value to clean.
     * @return {object|undefined} A clean representation of the input value, or undefined
     */
    function getHeaderInfo(headers) {
        if (!headers['content-type']) return {};
        var charset = headers['charset'] ? normalize(headers['charset']) : "";
        var headerSplit = headers['content-type'].split(';');
        var contentType = normalize(headerSplit[0]);

        // Supports charset as a part of the 'content-type' header.
        if (!charset && headerSplit[1]) {
            var charsetIndex = headerSplit[1].indexOf('=');
            if (charsetIndex !== -1) {
                charset = normalize(headerSplit[1].substr(charsetIndex+1));
            }
        }
        return {
            charset: charset || 'utf8',
            type: contentType
        };
    }

    /**
     * Removes any '/' or '-' present in the string and returns it.
     * @param  {string} value A string that should be cleaned of the chars '/' and '-'.
     * @return {string}       The input string minus some special characters.
     */
    function normalize(value) {
        return value.toLowerCase().replace(/[/-]/g, '');
    }

    /**
     * Represents a server response.
     * @class Response
     * @constructor
     * @param {Function} cb Callback to be used when the response is
     * finished. See the `end` event on the `on` method documentation.
     */
    /**
     * Response body.
     *
     * @attribute body
     * @type Buffer
     */
    /**
     * Response status code (by default, `200`).
     *
     * @attribute statusCode
     * @type Integer
     */
    /**
     * Response headers. Note that the header names are Node-style
     * (ie. lowercase).
     *
     * @attribute headers
     * @type Object
     */
    /**
     * Whether the response is finished.
     *
     * @attribute ended
     * @type Boolean
     */
    function Response(cb) {
        this.body       = new Buffer(0);
        this.statusCode = 200;
        this.headers    = {};
        this.ended      = false;
        var endHandlers = [];
        if (typeof cb === 'function') { endHandlers.push(cb); }
        this._eventHandlers = {head: [], data: [], end: endHandlers};
    }
    Response.prototype._fireEvent = function(eventName, evtObject) {
        var eventHandlers = this._eventHandlers[eventName];
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
    /**
     * Sets and writes the response headers.
     *
     * @method writeHead
     * @param {Integer} statusCode The response's status code.
     * @param {Object} headers The response's headers.
     */
    Response.prototype.writeHead = function(statusCode, headers) {
        this.statusCode = statusCode;
        this.headers    = headers || {};
        if (this._fireEvent('head', {statusCode: this.statusCode,
                                     headers: this.headers})) {
            this._hasWrittenHead = true;
        }
    };
    /**
     * Appends data to the response body. This method allows a
     * RoboHydra head to write the response body in chunks, and the
     * response will be sent in chunks to the client (so you could,
     * say, send data, then wait, then send more data, wait, then
     * close the connection).
     *
     * @method write
     * @param {Buffer} chunk Data to add to the current response
     * body. This parameter can be a string, too.
     */
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
    /**
     * Appends the given data to the response body and closes
     * it. Equivalent to calling the `write` method, then `end`.
     *
     * @method send
     * @param {Buffer} data to add to the response body.
     */
    Response.prototype.send = function(data) {
        this.write(data);
        this.end();
    };
    /**
     * Marks the response as complete and calls the 'end'
     * callback. When called in the response object provided by
     * RoboHydra, this closes the connection.
     *
     * @method end
     */
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
    /**
     * Copies the response given as a parameter into the current
     * response object. This is intended to be used when the response
     * given as a parameter is already finished.
     *
     * @method copyFrom
     * @param {Response} res Response object to copy.
     */
    Response.prototype.copyFrom = function(res) {
        var self = this;
        ['statusCode', 'headers', 'body'].forEach(function(prop) {
            self[prop] = res[prop];
        });
    };
    /**
     * Forwards the response given as a parameter. That is, copies the
     * given response in the current object, then marks the given
     * object as finished.
     *
     * @method forward
     * @param {Response} res The response object to forward.
     */
    Response.prototype.forward = function(res) {
        this.copyFrom(res);
        this.end();
    };
    /**
     * Adds a callback to the given event. An event can have more than
     * one callback. All callbacks for an event will be called in
     * order when the event is triggered.
     *
     * The callback function will receive a single parameter, `event`,
     * an object with the property `type` set to the event type, plus
     * different properties according to the event fired. It returns
     * the response object.
     *
     * The list of response object events is:
     *
     * * `head`: Fired when the header is written. Event objects for
     * this event contain two properties, `statusCode` and
     * `headers`.
     * * `data`: Fired when there is data written in the response
     * object. Event objects for this event contain a single property,
     * `data`, an instance of `Buffer`.
     * * `end`: Fired when the response is finished. Event objects for
     * this event contain a single property, `response`, the response
     * object that fired the event.
     *
     * For responses you have created yourself to pass to the `next`
     * function, the `end` event would typically be used to inspect or
     * modify the response contents, then write data to the response
     * object you received, possibly with the help of the methods
     * below.
     *
     * @method on
     * @param {String} eventName The name of the event to attach the
     * callback to. Possible event names are `head`, `data` and `end`.
     * @param {Function} cb The callback to attach to the given event.
     */
    Response.prototype.on = function(eventName, cb) {
        if (this._eventHandlers.hasOwnProperty(eventName)) {
            this._eventHandlers[eventName].push(cb);
            return this;
        } else {
            throw new InvalidRoboHydraResponseEventException(eventName);
        }
    };
    /**
     * Follows the given response: as data is written to the given
     * response object, that same data will be written in the calling
     * object (ie. it honours and replicates streaming). It's similar
     * to `copyFrom`, but with the following differences:
     *
     * * `follow` is to be used _before_ any data is written to the
     *   source object (ie. the parameter).
     * * `follow` will write data as it is received, instead of
     *   everything at once.
     *
     * @method follow
     * @param {Response} response Response object to follow.
     */
    Response.prototype.follow = function(response) {
        var self = this;
        response.on('head', function(evt) {
            self.writeHead(evt.statusCode, evt.headers);
        });
        response.on('data', function(evt) {
            self.write(evt.data);
        });
        response.on('end', function() {
            self.end();
        });
        return this;
    };
    /**
     * Chains the response given as a parameter to the current
     * object. This means that as data is written to the current
     * object, that same data will be written in the parameter (ie. it
     * honours and replicates streaming). It's similar to `copyFrom`,
     * but with the following differences:
     *
     * * `chain` is called on the source object, not the target.
     * * `chain` is to be used _before_ any data is written to the
     *   source object.
     * * `chain` will write data as it's received, instead of
     *   everything at once.
     *
     * @method chain
     * @deprecated
     * @param {Response} response Response object to chain to the
     * current object.
     */
    Response.prototype.chain = function(response) {
        deprecationWarning("'chain' is deprecated, please use 'follow' on the other/result response instead");
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
    exports.resolveConfig      = resolveConfig;
    exports.Request            = Request;
    exports.Response           = Response;
}());
