var path = require("path");

var mocha = require("mocha");
var chai = require("chai"),
    expect = chai.expect;
var deepEql = require("deep-eql");

var RoboHydraHead = require("../lib/heads").RoboHydraHead;
var utils = require("../lib/utils"),
    Request   = utils.Request,
    Response  = utils.Response;


(function () {
    "use strict";

    chai.Assertion.addMethod('matchResponse', function(expectedResponse) {
        var actual = this._obj;

        var r = true;
        var actualProps = {};
        // This is equivalent to {content: blah}, handled below
        if (typeof(expectedResponse) === 'string') {
            expectedResponse = {content: expectedResponse};
        }

        if (expectedResponse.hasOwnProperty('content')) {
            actualProps.content = actual.body;
            r = r && (hasEqualBody(actualProps.content,
                                   expectedResponse.content));
        }
        if (expectedResponse.hasOwnProperty('statusCode')) {
            actualProps.statusCode = actual.statusCode;
            r = r && (actualProps.statusCode === expectedResponse.statusCode);
        }
        if (expectedResponse.hasOwnProperty('contentType')) {
            actualProps.contentType = actual.headers['content-type'];
            r = r && (actualProps.contentType === expectedResponse.contentType);
        }
        if (expectedResponse.hasOwnProperty('headers')) {
            actualProps.headers = actual.headers;
            var headersToCheck = Object.keys(expectedResponse.headers);
            r = r && headersToCheck.every(function(header) {
                return actual.headers[header] === expectedResponse.headers[header];
            });
        }

        this.assert(
            r,
            "expected #{act} to match response #{expected}",
            "expected #{act} to NOT match response",
            actualProps,
            expectedResponse
        );
    });

    chai.Assertion.addMethod('handle', function(requestOrUrlPath) {
        var actual = this._obj;
        var request = typeof requestOrUrlPath === 'string' ?
            new Request({url: requestOrUrlPath}) : requestOrUrlPath;
        this.assert(
            actual.canHandle(request),
            "expected #{this} to handle #{act} but couldn't",
            "expected #{this} to NOT handle #{act} but could",
            request,
            null
        );
    });

    chai.Assertion.addMethod('haveTestResult', function(plugin, test, expectedResult) {
        var actual = this._obj;

        this.assert(
            deepEql(actual.testResults[plugin][test], expectedResult),
            "expected #{this} to have test result #{exp} (was: #{act})",
            "expected #{this} to NOT have test result #{act}",
            actual.testResults[plugin][test],
            expectedResult
        );
    });

    function hasEqualBody(body1, body2) {
        if (typeof(body1) === 'string') {
            body1 = new Buffer(body1);
        }
        if (typeof(body2) === 'string') {
            body2 = new Buffer(body2);
        }

        return body1.toString('base64') === body2.toString('base64');
    }

    chai.Assertion.addMethod('haveEqualBody', function(expectedBody) {
        var actual = this._obj;

        this.assert(
            hasEqualBody(actual, expectedBody),
            "expected #{this} to be equal to #{exp}",
            "expected #{this} to NOT be equal to #{exp}",
            actual,
            expectedBody
        );
    });

    chai.Assertion.addMethod('equalPath', function(expected) {
        var actual = this._obj;
        var canonicalActual = path.resolve(actual);
        var canonicalExpected = path.resolve(expected);

        this.assert(
            canonicalActual === canonicalExpected,
            "expected #{this} to be the same path as #{exp}",
            "expected #{this} to NOT be the same path as #{exp}",
            actual,
            expected
        );
    });

    function withResponse(robohydraOrHead, pathOrObject, cb) {
        if (typeof(pathOrObject) === 'string') {
            pathOrObject = {path: pathOrObject};
        }
        robohydraOrHead.handle(simpleReq(pathOrObject.path,
                                         {method:  pathOrObject.method || 'GET',
                                          headers: pathOrObject.headers,
                                          body: pathOrObject.postData}),
                               new Response(function() { cb(this); }),
                               pathOrObject.nextFunction);
    }

    function checkRouting(head, list, cb) {
        if (list.length === 0) {
            if (typeof(cb) === 'function') { cb(); }
        } else {
            withResponse(head, list[0][0], function(res) {
                expect(res).to.matchResponse(list[0][1]);
                checkRouting(head, list.slice(1), cb);
            });
        }
    }

    function checkWebSocketRouting(head, list, cb) {
        var fakeSocket;

        for (var i = 0, len = list.length; i < len; i++) {
            fakeSocket = {
                send: function(data) {
                    expect(data).to.equal(list[0][1]);
                }
            };
            head.handle(simpleWsReq(list[0][0]), fakeSocket);
        }

        cb();
    }

    function fakeFs(fileMap) {
        for (var p in fileMap) {
            if (typeof fileMap[p] === 'string') {
                fileMap[p] = { content: fileMap[p] };
            }
            // Also add entries for directories
            var directory = p;
            while (directory !== '/' && directory !== '') {
                directory = directory.replace(new RegExp('[^/]*/?$'), '');
                fileMap[directory] = { directory: true};
            }
        }

        return {
            _demoronisePath: function(path) {
                return path.replace(new RegExp('//+', 'g'), '/');
            },
            readFile: function(path, cb) {
                path = this._demoronisePath(path);
                if (fileMap.hasOwnProperty(path)) {
                    cb("", fileMap[path].content);
                } else {
                    cb("File not found");
                }
            },
            statSync: function(path) {
                path = this._demoronisePath(path);

                var matchingPath;
                ['', '/'].forEach(function(pathSuffix) {
                    if (fileMap.hasOwnProperty(path + pathSuffix)) {
                        matchingPath = path + pathSuffix;
                    }
                });

                if (matchingPath) {
                    return {
                        isFile: function () { return !fileMap[matchingPath].directory; },
                        isDirectory: function () { return fileMap[matchingPath].directory; },
                        mtime:  fileMap[matchingPath].mtime || new Date()
                    };
                } else {
                    throw {message: "ENOENT, no such file or directory '" + path + "'",
                           code: "ENOENT"};
                }
            },
            stat: function(path, cb) {
                var result;
                try {
                    result = this.statSync(path);
                } catch (e) {
                    if (e.code === 'ENOENT') {
                        cb(e.message);
                    } else {
                        throw e;
                    }
                }

                if (result) {
                    cb("", result);
                }
            }
        };
    }

    function fakeHttpRequest(requestDispatcher) {
        return function(options, resCallback) {
            var h       = options.host;
            var p       = options.port;
            var method  = options.method || 'GET';
            var path    = options.path;
            var headers = options.headers || {};

            return {
                handlers: [],

                on: function(event, handler) {
                    this.handlers[event] = handler;
                },

                write: function(data/*, mode*/) {
                    this.data = data;
                },

                end: function() {
                    var self = this;
                    resCallback({
                        on: function(event, handler) {
                            if (event === 'data') {
                                handler(new Buffer(requestDispatcher(method, path, headers, self.data, h, p)));
                            }
                            if (event === 'end') {
                                handler();
                            }
                        }
                    });
                }
            };
        };
    }

    function simpleReq(url, options) {
        options = options || {};
        return new Request({
            url:     url,
            method:  options.method,
            headers: options.headers,
            rawBody: options.body
        });
    }

    function simpleWsReq(path) {
        return new Request({
            url: path,
            upgrade: true,
            headers: {
                upgrade: 'websocket'
            }
        });
    }

    function headWithPass(path, hydraUtils, assertionMessage) {
        return new RoboHydraHead({
            path: path,
            handler: function(req, res) {
                hydraUtils.assert.equal(1, 1, assertionMessage);
                res.end();
            }
        });
    }

    function headWithFail(path, hydraUtils, assertionMessage) {
        return new RoboHydraHead({
            path: path,
            handler: function(req, res) {
                hydraUtils.assert.equal(1, 0, assertionMessage);
                res.end();
            }
        });
    }

    function pluginInfoObject(info) {
        var name = ('name' in info) ? info.name : 'test-plugin';

        var bodyParts = {};
        for (var p in info) {
            if (p !== 'name') {
                bodyParts[p] = info[p];
            }
        }

        return {
            name: name,
            path: info.path || '/tmp/fake/unit-testing/' + name,
            config: info.config,
            module: {
                getBodyParts: function() {
                    return bodyParts;
                }
            }
        };
    }

    function pluginObjectFromPath(pluginPath) {
        return {name: path.basename(pluginPath),
                config: {},
                path: pluginPath,
                module: require(path.join(pluginPath, 'index.js'))};
    }

    exports.withResponse          = withResponse;
    exports.checkRouting          = checkRouting;
    exports.checkWebSocketRouting = checkWebSocketRouting;
    exports.fakeFs                = fakeFs;
    exports.fakeHttpRequest       = fakeHttpRequest;
    exports.simpleReq             = simpleReq;
    exports.simpleWsReq           = simpleWsReq;
    exports.headWithFail          = headWithFail;
    exports.headWithPass          = headWithPass;
    exports.pluginInfoObject      = pluginInfoObject;
    exports.pluginObjectFromPath  = pluginObjectFromPath;
}());
