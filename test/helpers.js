var buster = require("buster");
var robohydra = require("../lib/robohydra"),
    heads     = robohydra.heads,
    assert    = robohydra.assert,
    Response  = robohydra.Response;

function areBuffersEqual(buffer1, buffer2) {
    if (buffer1.length !== buffer2.length) return false;

    for (var i = 0, len = buffer1.length; i < len; i++) {
        if (buffer1[i] !== buffer2[i]) return false;
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
        if (expectedResponse.hasOwnProperty('status')) {
            this.actualProps.status = actual.statusCode;
            r = r && (this.actualProps.status === expectedResponse.status);
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

function withResponse(head, pathOrObject, cb) {
    var method = 'GET', postData, headers;
    if (typeof(pathOrObject) === 'string') {
        pathOrObject = {path: pathOrObject};
    }
    head.handle(fakeReq(pathOrObject.path,
                        {method:  pathOrObject.method || 'GET',
                         headers: pathOrObject.headers,
                         body: pathOrObject.postData}),
                new Response(function() { cb(this); }));
}

function checkRouting(head, list, cb) {
    if (list.length === 0) {
        if (typeof(cb) === 'function') cb();
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
    }
    return {
        readFile: function(path, cb) {
            if (fileMap.hasOwnProperty(path))
                cb("", fileMap[path].content);
            else
                cb("File not found");
        },
        stat: function(path, cb) {
            if (fileMap.hasOwnProperty(path))
                cb("", {
                    isFile: function () { return true; },
                    mtime:  fileMap[path].mtime || new Date()
                });
            else
                cb("File not found");
        }
    };
}

function fakeHttpCreateClient(responseFunction) {
    return function(p, h) {
        return {
            request: function(method, path, headers) {
                return {
                    handlers: [],

                    addListener: function(event, handler) {
                        this.handlers[event] = handler;
                    },

                    write: function(data, mode) {
                        this.data = data;
                    },

                    end: function() {
                        var self = this;
                        this.handlers.response({
                            addListener: function(event, handler) {
                                self.handlers[event] = handler;
                                if (event === 'data') {
                                    self.handlers[event](responseFunction(method, path, headers, self.data, h, p));
                                }
                                if (event === 'end') {
                                    self.handlers[event]();
                                }
                            }
                        });
                    }
                };
            },

            on: function(event, handler) {
            }
        };
    };
}

function fakeReq(url, options) {
    options = options || {};
    return {url: url,
            method: options.method || 'get',
            getParams: options.get,
            bodyParams: options.post,
            rawBody: options.body,
            headers: options.headers};
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

exports.withResponse         = withResponse;
exports.checkRouting         = checkRouting;
exports.fakeFs               = fakeFs;
exports.fakeHttpCreateClient = fakeHttpCreateClient;
exports.fakeReq              = fakeReq;
exports.headWithFail         = headWithFail;
exports.headWithPass         = headWithPass;
