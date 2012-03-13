var buster = require("buster");
var sinon = require("sinon");
var HydraHead = require("../lib/hydraHead").HydraHead;
var HydraHeadStatic = require("../lib/hydraHead").HydraHeadStatic;
var HydraHeadFilesystem = require("../lib/hydraHead").HydraHeadFilesystem;
var HydraHeadProxy = require("../lib/hydraHead").HydraHeadProxy;

buster.spec.expose();

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

buster.assertions.add("dispatches", {
    assert: function(actual, urlPath) {
        return actual.canDispatch(urlPath);
    },
    assertMessage: "Expected ${0} to consider path '${1}' dispatchable!",
    refuteMessage: "Expected ${0} to not consider path '${1}' dispatchable!",
    expectation: "toDispatch"
});

function withResponse(head, pathOrObject, cb) {
    var path, method = 'GET', postData;
    if (typeof(pathOrObject) === 'string') {
        path = pathOrObject;
    } else {
        path     = pathOrObject.path;
        method   = pathOrObject.method || 'GET';
        postData = pathOrObject.postData;
    }
    var fakeReq = { url: path,
                    handlers: {},
                    method: method,
                    addListener: function(event, handler) {
                        this.handlers[event] = handler;
                        if (event === 'data') {
                            handler(postData);
                        }
                    },
                    end: function() {
                        if (typeof(this.handlers.end) === 'function') {
                            this.handlers.end();
                        }
                    } };
    var fakeRes = { send: sinon.spy(),
                    write: function(data) { this.send(data); },
                    end: function() {},
                    toString: function() {
                        return 'Fake response for ' + path;
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
    return {
        readFile: function(path, cb) {
            if (fileMap.hasOwnProperty(path))
                cb("", fileMap[path]);
            else
                cb("File not found");
        }
    };
}

function fakeHttpCreateClient(responseFunction) {
    return function(h, p) {
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
                                    self.handlers[event](responseFunction(method, path, headers, self.data));
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



describe("Hydra heads", function() {
    it("can't be created without necessary properties", function() {
        var head;

        expect(function() {
            head = new HydraHead();
        }).toThrow("InvalidHydraHeadException");

        expect(function() {
            head = new HydraHead({path: '/'});
        }).toThrow("InvalidHydraHeadException");

        expect(function() {
            head = new HydraHead({handler: function() {}});
        }).toThrow("InvalidHydraHeadException");

        expect(function() {
            head = new HydraHeadStatic();
        }).toThrow("InvalidHydraHeadException");

        expect(function() {
            head = new HydraHeadStatic({path: '/'});
        }).toThrow("InvalidHydraHeadException");

        expect(function() {
            head = new HydraHeadFilesystem({path: '/'});
        }).toThrow("InvalidHydraHeadException");

        expect(function() {
            head = new HydraHeadFilesystem({documenRoot: '/'});
        }).toThrow("InvalidHydraHeadException");

        expect(function() {
            head = new HydraHeadProxy({path: '/'});
        }).toThrow("InvalidHydraHeadException");

        expect(function() {
            head = new HydraHeadProxy({proxyTo: 'http://example.com'});
        }).toThrow("InvalidHydraHeadException");
    });

    it("can be created with only static content", function(done) {
        var text = 'static content';
        var head = new HydraHeadStatic({content: text});

        checkRouting(head, [
            ['/', text],
            ['/foobar', text]
        ], done);
    });

    it("can be created with path and static content", function(done) {
        var text = 'static content';
        var head = new HydraHeadStatic({path: '/', content: text});
        checkRouting(head, [
            ['/', text],
            ['/foobarqux', {status: 404}] // only the given path is served
        ], done);
    });

    it("return 404 when requesting unknown paths", function(done) {
        var head = new HydraHeadStatic({path: '/foobar',
                                        content: 'static content'});
        checkRouting(head, [
            ['/', {status: 404}],
            ['/foobarqux', {status: 404}],
            ['/fooba', {status: 404}]
        ], done);
    });

    it("serve files from the file system", function(done) {
        var fileContents = "file contents";
        var head = new HydraHeadFilesystem({path: '/foobar',
                                            documentRoot: '/var/www',
                                            fs: fakeFs({'/var/www/file.txt':
                                                        fileContents})});

        checkRouting(head, [
            ['/foobar/file.txt', fileContents],
            ['/foobar//file.txt', fileContents]
        ], done);
    });

    it("don't serve non-existent files from the file system", function(done) {
        var fileContents = "file contents";
        var head = new HydraHeadFilesystem({path: '/foobar',
                                            documentRoot: '/var/www',
                                            fs: fakeFs({'/var/www/file.txt':
                                                        fileContents})});

        checkRouting(head, [
            ['/foobar/file.txt~', {status: 404}],
            ['/foobar/something-completely-different.txt', {status: 404}],
            ['/file.txt~', {status: 404}]
        ], done);
    });

    it("serve files from the file system with a trailing slash in documentRoot", function(done) {
        var fileContents = "file contents";
        var head = new HydraHeadFilesystem({path: '/foobar',
                                            documentRoot: '/var/www/',
                                            fs: fakeFs({'/var/www/file.txt':
                                                        fileContents})});

        checkRouting(head, [
            ['/foobar/file.txt', fileContents],
            ['/foobar//file.txt', fileContents]
        ], done);
    });

    it("serve files from the file system with a trailing slash in path", function(done) {
        var fileContents = "file contents";
        var head = new HydraHeadFilesystem({path: '/foobar/',
                                            documentRoot: '/var/www',
                                            fs: fakeFs({'/var/www/file.txt':
                                                        fileContents})});

        checkRouting(head, [
            ['/foobar/file.txt', fileContents],
            ['/foobar//file.txt', fileContents]
        ], done);
    });

    it("serve files from the file system with trailing slashes in path and documentRoot", function(done) {
        var fileContents = "file contents";
        var head = new HydraHeadFilesystem({path: '/foobar/',
                                            documentRoot: '/var/www/',
                                            fs: fakeFs({'/var/www/file.txt':
                                                        fileContents})});

        checkRouting(head, [
            ['/foobar/file.txt', fileContents],
            ['/foobar//file.txt', fileContents]
        ], done);
    });

    it("can serve content from Javascript functions", function(done) {
        var head = new HydraHead({path: '/foobar',
                                  handler: function(req, res, cb) {
                                      res.send('Response for ' + req.url);
                                      cb();
                                  }});

        checkRouting(head, [
            ['/foobar', 'Response for /foobar']
        ], done);
    });

    it("can proxy simple GET requests", function(done) {
        var fakeHttpCC = fakeHttpCreateClient(function(m, p, h) {
            return "Proxied " + m + " response for " + p;
        });
        var head = new HydraHeadProxy({path: '/foobar',
                                       proxyTo: 'http://example.com/mounted',
                                       httpCreateClientFunction: fakeHttpCC});

        checkRouting(head, [
            ['/foobar/',      'Proxied GET response for /mounted/'],
            ['/foobar/blah/', 'Proxied GET response for /mounted/blah/'],
            ['/blah/',        {status: 404}]
        ], done);
    });

    it("can proxy simple POST requests", function(done) {
        var fakeHttpCC = fakeHttpCreateClient(function(m, p, h, data) {
            var res = "Proxied " + m + " response for " + p;
            return res + (typeof(data) === 'undefined' ? '' :
                          " with data \"" + data + "\"");
        });
        var head = new HydraHeadProxy({path: '/foobar',
                                       proxyTo: 'http://example.com/mounted',
                                       httpCreateClientFunction: fakeHttpCC});

        checkRouting(head, [
            [{path: '/foobar/',
              method: 'POST',
              postData: 'some data'},
             'Proxied POST response for /mounted/ with data "some data"'],
            [{path: '/foobar/blah/',
              method: 'POST',
              postData: 'other data'},
             'Proxied POST response for /mounted/blah/ with data "other data"'],
            [{path: '/blah/',
              method: 'POST',
              postData: 'will not be found'},
             {status: 404}]
        ], done);
    });

    it("of type 'static' know which paths they can dispatch", function() {
        var validPaths = ['/foobar', '/foobar/'];
        var invalidPaths = ['/', 'fooba', '/foobar/qux'];

        ['/foobar', '/foobar/'].forEach(function(dispatchPath) {
            var head = new HydraHeadStatic({path: dispatchPath,
                                            content: "Some test content"});
            validPaths.forEach(function(path) {
                expect(head).toDispatch(path);
            });
            invalidPaths.forEach(function(path) {
                expect(head).not().toDispatch(path);
            });
        });
    });

    it("of type 'file' know which paths they can dispatch", function() {
        var validPaths = ['/foobar', '/foobar/', '/foobar/..', '/foobar/.file',
                          '/foobar/dir/file', '/foobar/dir/file.txt'];
        var invalidPaths = ['/', '/fooba', '/fooba/'];

        ['/foobar', '/foobar/'].forEach(function(dispatchPath) {
            var head = new HydraHeadFilesystem({path: dispatchPath,
                                                documentRoot: '/var/www'});
            validPaths.forEach(function(path) {
                expect(head).toDispatch(path);
            });
            invalidPaths.forEach(function(path) {
                expect(head).not().toDispatch(path);
            });
        });
    });

    it("of type 'proxy' know which paths they can dispatch", function() {
        var validPaths = ['/foobar', '/foobar/', '/foobar/..', '/foobar/.file',
                          '/foobar/dir/file', '/foobar/dir/file.txt'];
        var invalidPaths = ['/', '/fooba', '/fooba/'];

        ['/foobar', '/foobar/'].forEach(function(dispatchPath) {
            var head = new HydraHeadProxy({path: dispatchPath,
                                           proxyTo: 'http://www.example.com'});
            validPaths.forEach(function(path) {
                expect(head).toDispatch(path);
            });
            invalidPaths.forEach(function(path) {
                expect(head).not().toDispatch(path);
            });
        });
    });
});
