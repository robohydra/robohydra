var buster = require("buster");
var sinon = require("sinon");

buster.assertions.add("responseMatches", {
    assert: function (actual, expectedResponse) {
        var r = true;
        this.actualProps = {};
        if (typeof(expectedResponse) === 'string') {
            expectedResponse = {content: expectedResponse};
        }
        if (expectedResponse.hasOwnProperty('content')) {
            this.actualProps.content = actual.send.getCall(0).args[0];
            r = r && (this.actualProps.content === expectedResponse.content);
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

function withResponse(head, pathOrObject, cb) {
    var path, method = 'GET', postData, headers;
    if (typeof(pathOrObject) === 'string') {
        path = pathOrObject;
    } else {
        path     = pathOrObject.path;
        method   = pathOrObject.method || 'GET';
        postData = pathOrObject.postData;
        headers  = pathOrObject.headers;
    }
    var fakeReq = { url: path,
                    handlers: {},
                    method: method,
                    headers: headers || {},
                    rawBody: postData,
                    addListener: function(event, handler) {
                        this.handlers[event] = handler;
                    },
                    end: function() {
                        if (typeof(this.handlers.end) === 'function') {
                            this.handlers.end();
                        }
                    } };
    var fakeRes = { send: sinon.spy(function () { this.statusCode = (this.statusCode || 200); }),
                    write: function(data) { this.send(data); },
                    end: function() {},
                    toString: function() {
                        return 'Fake response for ' + path;
                    },
                    headers: {},
                    header: function(name, value) {
                        this.headers[name] = value;
                    },
                    writeHead: function(status, headers) {
                        this.statusCode = status;
                    } };
    head.handle(fakeReq, fakeRes, function() {
        cb(fakeRes);
    });
    fakeReq.end();
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
    for (p in fileMap) {
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

exports.withResponse         = withResponse;
exports.checkRouting         = checkRouting;
exports.fakeFs               = fakeFs;
exports.fakeHttpCreateClient = fakeHttpCreateClient;
