/*global expect*/

var buster = require("buster");
var path = require("path");
var robohydra = require("../lib/robohydra"),
    heads     = robohydra.heads,
    Request   = robohydra.Request,
    Response  = robohydra.Response;


(function () {
    "use strict";

    function areBuffersEqual(buffer1, buffer2) {
        if (buffer1.length !== buffer2.length) { return false; }

        for (var i = 0, len = buffer1.length; i < len; i++) {
            if (buffer1[i] !== buffer2[i]) {
                return false;
            }
        }

        return true;
    }

    buster.assertions.add("responseMatches", {
        assert: function (actual, expectedResponse) {
            var r = true;
            this.actualProps = {};
            if (typeof(expectedResponse) === 'string') {
                expectedResponse = {content: expectedResponse};
            }
            if (expectedResponse.hasOwnProperty('content')) {
                this.actualProps.content = actual.body;
                r = r && (areBuffersEqual(this.actualProps.content, new Buffer(expectedResponse.content)));
            }
            if (expectedResponse.hasOwnProperty('statusCode')) {
                this.actualProps.statusCode = actual.statusCode;
                r = r && (this.actualProps.statusCode === expectedResponse.statusCode);
            }
            if (expectedResponse.hasOwnProperty('contentType')) {
                this.actualProps.contentType = actual.headers['content-type'];
                r = r && (this.actualProps.contentType === expectedResponse.contentType);
            }
            return r;
        },
        assertMessage: "Expected ${0} to produce response '${1}' (was '${actualProps}')!",
        refuteMessage: "Expected ${0} to not produce response '${1}'!",
        expectation: "toMatchResponse"
    });

    buster.assertions.add("handles", {
        assert: function(actual, urlPath) {
            return actual.canHandle(urlPath);
        },
        assertMessage: "Expected ${0} to be able to handle path '${1}'!",
        refuteMessage: "Expected ${0} to not be able to handle path '${1}'!",
        expectation: "toHandle"
    });

    buster.assertions.add("hasTestResult", {
        assert: function(actual, plugin, test, expectedResult) {
            this.testResults = actual.testResults;
            return buster.assertions.deepEqual(this.testResults[plugin][test],
                                               expectedResult);
        },
        assertMessage: "Expected RoboHydra (w/ results ${testResults}) to have test result ${3} for test ${1}/${2}!",
        refuteMessage: "Expected RoboHydra (w/ results ${testResults}) to not have test result ${3} for test ${1}/${2}!",
        expectation: "toHaveTestResult"
    });

    buster.assertions.add("hasScenarioTestResult", {
        assert: function(actual, plugin, scenario, expectedResult) {
            this.testResults = actual.testResults;
            return buster.assertions.deepEqual(this.testResults[plugin][scenario],
                                               expectedResult);
        },
        assertMessage: "Expected RoboHydra (w/ results ${testResults}) to have test result ${3} for test ${1}/${2}!",
        refuteMessage: "Expected RoboHydra (w/ results ${testResults}) to not have test result ${3} for test ${1}/${2}!",
        expectation: "toHaveTestResult"
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
                expect(res).toMatchResponse(list[0][1]);
                checkRouting(head, list.slice(1), cb);
            });
        }
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

    function headWithPass(path, hydraUtils, assertionMessage) {
        return new heads.RoboHydraHead({
            path: path,
            handler: function(req, res) {
                hydraUtils.assert.equal(1, 1, assertionMessage);
                res.end();
            }
        });
    }

    function headWithFail(path, hydraUtils, assertionMessage) {
        return new heads.RoboHydraHead({
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

    exports.withResponse         = withResponse;
    exports.checkRouting         = checkRouting;
    exports.fakeFs               = fakeFs;
    exports.fakeHttpRequest      = fakeHttpRequest;
    exports.simpleReq            = simpleReq;
    exports.headWithFail         = headWithFail;
    exports.headWithPass         = headWithPass;
    exports.pluginInfoObject     = pluginInfoObject;
    exports.pluginObjectFromPath = pluginObjectFromPath;
}());
