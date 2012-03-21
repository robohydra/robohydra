var buster = require("buster");
var sinon = require("sinon");
var HydraHead           = require("../lib/hydraHead").HydraHead,
    HydraHeadStatic     = require("../lib/hydraHead").HydraHeadStatic,
    HydraHeadFilesystem = require("../lib/hydraHead").HydraHeadFilesystem,
    HydraHeadProxy      = require("../lib/hydraHead").HydraHeadProxy,
    HydraHeadAdmin      = require("../lib/hydraHead").HydraHeadAdmin;

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



describe("Generic Hydra heads", function() {
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
    });

    it("can have a name", function() {
        var head = new HydraHead({name: 'foo',
                                  path: '/', handler: function() {}});
        expect(head.name).toEqual('foo');

        var namelessHead = new HydraHead({path: '/', handler: function() {}});
        expect(namelessHead.name).not().toBeDefined();
    });

    it("can serve simple content", function(done) {
        var head = new HydraHead({path: '/foobar',
                                  handler: function(req, res, cb) {
                                      res.send('Response for ' + req.url);
                                      cb();
                                  }});

        checkRouting(head, [
            ['/foobar', 'Response for /foobar']
        ], done);
    });

    it("can serve content from path matching a regular expression", function(done) {
        var head = new HydraHead({path: '/foobar(/[a-z]*)?',
                                  handler: function(req, res, cb) {
                                      res.send('Response for ' + req.url);
                                      cb();
                                  }});

        checkRouting(head, [
            ['/foobar', 'Response for /foobar'],
            ['/foobar/', 'Response for /foobar/'],
            ['/foobar/qux', 'Response for /foobar/qux'],
            ['/foobar/qux123', {status: 404}],
            ['/foobar/123qux', {status: 404}]
        ], done);
    });

    it("can be created attached/detached", function() {
        var detachedHead = new HydraHead({detached: true,
                                          path: '/',
                                          handler: function() {}});
        expect(detachedHead.attached()).toEqual(false);

        var normalHead = new HydraHead({path: '/', handler: function() {}});
        expect(normalHead.attached()).toEqual(true);

        var explicitHead = new HydraHead({path: '/', handler: function() {}});
        expect(explicitHead.attached()).toEqual(true);
    });

    it("can be attached/detached dynamically", function() {
        var head = new HydraHead({path: '/', handler: function() {}});
        expect(head.attached()).toEqual(true);
        head.detach();
        expect(head.attached()).toEqual(false);
        head.attach();
        expect(head.attached()).toEqual(true);
    });

    it("can't be attached/detached when already in that state", function() {
        var head = new HydraHead({path: '/', handler: function() {}});
        expect(function() {
            head.attach();
        }).toThrow("InvalidHydraHeadStateException");
        expect(head.attached()).toEqual(true);
        head.detach();
        expect(head.attached()).toEqual(false);
        expect(function() {
            head.detach();
        }).toThrow("InvalidHydraHeadStateException");
        expect(head.attached()).toEqual(false);
    });

    it("never dispatch any paths when detached", function() {
        var headStatic = new HydraHead({detached: true, path: '/foo.*',
                                        handler: function() {}});
        var headDynamic = new HydraHead({path: '/foo.*',
                                         handler: function() {}});
        headDynamic.detach();

        var paths = ['/foo', '/foo/bar'];
        [headStatic, headDynamic].forEach(function(head) {
            expect(head).not().toHandle('/');
            paths.forEach(function(path) {
                expect(head).not().toHandle(path);
            });
            head.attach();
            expect(head).not().toHandle('/');
            paths.forEach(function(path) {
                expect(head).toHandle(path);
            });
        });
    });

    it("know which static paths they can dispatch", function() {
        var validPaths = ['/foo/ba', '/foo/b/',
                          '/foo/baaaa', '/foo/baa?param=value'];
        var invalidPaths = ['/foo/bar', '/foo/'];

        var head = new HydraHead({path: '/foo/ba*', handler: function() {}});
        validPaths.forEach(function(path) {
            expect(head).toHandle(path);
        });
        invalidPaths.forEach(function(path) {
            expect(head).not().toHandle(path);
        });
    });

    it("know which paths they can dispatch with variables", function() {
        var validPaths = ['/article/show/123', '/page/edit/123/',
                          '/article/list/all?page=3'];
        var invalidPaths = ['/article/show/123/456', '/article/',
                            '/article/show'];

        var head = new HydraHead({path: '/:controller/:action/:id',
                                  handler: function() {}});
        validPaths.forEach(function(path) {
            expect(head).toHandle(path);
        });
        invalidPaths.forEach(function(path) {
            expect(head).not().toHandle(path);
        });
    });

    it("set the appropriate request params with the request variables", function(done) {
        var controller, action, id;
        var head = new HydraHead({path: '/:controller/:action/:id',
                                  handler: function(req, res, cb) {
                                      controller = req.params.controller;
                                      action     = req.params.action;
                                      id         = req.params.id;
                                      res.send("Response for " + req.url);
                                      cb();
                                  }});

        withResponse(head, '/article/show/123', function(res) {
            expect(res).toMatchResponse('Response for /article/show/123');
            expect(controller).toEqual('article');
            expect(action).toEqual('show');
            expect(id).toEqual('123');
            withResponse(head, '/page/edit/456/', function(res) {
                expect(res).toMatchResponse('Response for /page/edit/456/');
                expect(controller).toEqual('page');
                expect(action).toEqual('edit');
                expect(id).toEqual('456');
                withResponse(head, '/widget/search/term?page=2', function(res) {
                    expect(res).toMatchResponse('Response for /widget/search/term?page=2');
                    expect(controller).toEqual('widget');
                    expect(action).toEqual('search');
                    expect(id).toEqual('term');
                    done();
                });
            });
        });
    });
});

describe("Static content Hydra heads", function() {
    it("can't be created without necessary properties", function() {
        var head;

        expect(function() {
            head = new HydraHeadStatic();
        }).toThrow("InvalidHydraHeadException");

        expect(function() {
            head = new HydraHeadStatic({path: '/'});
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

    it("know which static paths they can dispatch", function() {
        var validPaths = ['/foobar', '/foobar/'];
        var invalidPaths = ['/', '/fooba', '/foobar/qux', '/qux/foobar'];

        ['/foobar', '/foobar/'].forEach(function(dispatchPath) {
            var head = new HydraHeadStatic({path: dispatchPath,
                                            content: "Some test content"});
            validPaths.forEach(function(path) {
                expect(head).toHandle(path);
            });
            invalidPaths.forEach(function(path) {
                expect(head).not().toHandle(path);
            });
        });
    });

    it("know which regular expression paths they can dispatch", function() {
        var validPaths = ['/foo/a', '/foo/abcd', '/foo/abcd/'];
        var invalidPaths = ['/', '/foo/', '/foobar/', '/foo/qux/mux'];

        var head = new HydraHeadStatic({path: '/foo/[^/]+',
                                        content: "Some test content"});
        validPaths.forEach(function(path) {
            expect(head).toHandle(path);
        });
        invalidPaths.forEach(function(path) {
            expect(head).not().toHandle(path);
        });
    });

    it("know which paths they can dispatch by default", function() {
        var head = new HydraHeadStatic({content: "Some test content"});
        ['/', '/foobar', '/foo/bar'].forEach(function(path) {
            expect(head).toHandle(path);
        });
    });

    it("can automatically stringify a Javascript object", function(done) {
        var head = new HydraHeadStatic({content: ['one', 'two', {three: 3}]});
        withResponse(head, '/json', function(res) {
            var jsonText = res.send.getCall(0).args[0];
            var resultObject = JSON.parse(jsonText);
            expect(resultObject.length).toEqual(3);
            expect(resultObject[0]).toEqual('one');
            expect(resultObject[1]).toEqual('two');
            expect(resultObject[2].three).toEqual(3);
            done();
        });
    });
});

describe("Filesystem Hydra heads", function() {
    it("can't be created without necessary properties", function() {
        var head;

        expect(function() {
            head = new HydraHeadFilesystem({basePath: '/'});
        }).toThrow("InvalidHydraHeadException");
    });

    it("serve files from default basePath = /", function(done) {
        var fileContents    = "file contents",
            dirFileContents = "dir file contents";
        var head = new HydraHeadFilesystem({
            documentRoot: '/var/www',
            fs: fakeFs({'/var/www/file.txt': fileContents,
                        '/var/www/dir/file.txt': dirFileContents})
        });

        checkRouting(head, [
            ['/file.txt', fileContents],
            ['/dir/file.txt', dirFileContents],
            ['/dir/non-existentfile.txt', {status: 404}]
        ], done);
    });

    it("serve files from the file system", function(done) {
        var fileContents = "file contents";
        var head = new HydraHeadFilesystem({basePath: '/foobar',
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
        var head = new HydraHeadFilesystem({basePath: '/foobar',
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
        var head = new HydraHeadFilesystem({basePath: '/foobar',
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
        var head = new HydraHeadFilesystem({basePath: '/foobar/',
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
        var head = new HydraHeadFilesystem({basePath: '/foobar/',
                                            documentRoot: '/var/www/',
                                            fs: fakeFs({'/var/www/file.txt':
                                                        fileContents})});

        checkRouting(head, [
            ['/foobar/file.txt', fileContents],
            ['/foobar//file.txt', fileContents]
        ], done);
    });

    it("know which paths they can dispatch", function() {
        var validPaths = ['/foobar', '/foobar/', '/foobar/..', '/foobar/.file',
                          '/foobar/dir/file', '/foobar/dir/file.txt'];
        var invalidPaths = ['/', '/fooba', '/fooba/', '/qux/foobar',
                            '/foobarqux'];

        ['/foobar', '/foobar/'].forEach(function(dispatchPath) {
            var head = new HydraHeadFilesystem({basePath: dispatchPath,
                                                documentRoot: '/var/www'});
            validPaths.forEach(function(path) {
                expect(head).toHandle(path);
            });
            invalidPaths.forEach(function(path) {
                expect(head).not().toHandle(path);
            });
        });
    });

    it("sets the correct Content-Type for the served files", function(done) {
        var head = new HydraHeadFilesystem({documentRoot: '/var/www',
                                            fs: fakeFs({'/var/www/json.txt':
                                                            'foobar'}),
                                            mime: {lookup: function(path) { return "text/x-fake"; }}});
        withResponse(head, '/json.txt', function(res) {
            expect(res.headers['Content-Type']).toEqual("text/x-fake");
            done();
        });
    });

    it("sets the correct Last-Modified for the served files", function(done) {
        var mtime = new Date();
        var head = new HydraHeadFilesystem({
            documentRoot: '/var/www',
            fs: fakeFs({
                '/var/www/json.txt': {
                    content: 'foobar',
                    mtime: mtime
                }
            })
        });
        withResponse(head, '/json.txt', function(res) {
            expect(res.headers['Last-Modified']).toEqual(mtime.toUTCString());
            done();
        });
    });

    it("serves 304 for not modified files", function(done) {
        var headers = {
            'if-modified-since': new Date(1337)
        };
        var head = new HydraHeadFilesystem({
            documentRoot: '/var/www',
            fs: fakeFs({
                '/var/www/json.txt': {
                    content: 'foobar',
                    mtime: new Date(42)
                }
            })
        });
        withResponse(head, { path: '/json.txt', headers: headers }, function(res) {
            expect(res.statusCode).toEqual(304);
            done();
        });
    });
});

describe("Proxying Hydra heads", function() {
    it("can't be created without necessary properties", function() {
        var head;

        expect(function() {
            head = new HydraHeadProxy({basePath: '/'});
        }).toThrow("InvalidHydraHeadException");
    });

    it("proxy from default basePath = /", function(done) {
        var fakeHttpCC = fakeHttpCreateClient(function(m, p, h) {
            return "Proxied " + m + " response for " + p;
        });
        var head = new HydraHeadProxy({proxyTo: 'http://example.com/mounted',
                                       httpCreateClientFunction: fakeHttpCC});

        checkRouting(head, [
            ['/',      'Proxied GET response for /mounted/'],
            ['/blah/', 'Proxied GET response for /mounted/blah/']
        ], done);
    });

    it("can proxy simple GET requests", function(done) {
        var fakeHttpCC = fakeHttpCreateClient(function(m, p, h) {
            return "Proxied " + m + " response for " + p;
        });
        var head = new HydraHeadProxy({basePath: '/foobar',
                                       proxyTo: 'http://example.com/mounted',
                                       httpCreateClientFunction: fakeHttpCC});
        var head2 = new HydraHeadProxy({basePath: '/foobar',
                                        proxyTo: 'http://example.com/mounted/',
                                        httpCreateClientFunction: fakeHttpCC});

        checkRouting(head, [
            ['/foobar/',      'Proxied GET response for /mounted/'],
            ['/foobar/blah/', 'Proxied GET response for /mounted/blah/'],
            ['/blah/',        {status: 404}]
        ], function() {
               checkRouting(head2, [
                   ['/foobar/',      'Proxied GET response for /mounted/'],
                   ['/foobar/blah/', 'Proxied GET response for /mounted/blah/'],
                   ['/blah/',        {status: 404}]
               ], done);
           });
    });

    it("can proxy simple GET requests to a site's root path", function(done) {
        var fakeHttpCC = fakeHttpCreateClient(function(m, p, h) {
            return "Proxied " + m + " response for " + p;
        });
        var head = new HydraHeadProxy({basePath: '/foobar',
                                       proxyTo: 'http://example.com',
                                       httpCreateClientFunction: fakeHttpCC});
        var head2 = new HydraHeadProxy({basePath: '/foobar',
                                        proxyTo: 'http://example.com/',
                                        httpCreateClientFunction: fakeHttpCC});

        checkRouting(head, [
            ['/foobar/',      'Proxied GET response for /'],
            ['/foobar/blah/', 'Proxied GET response for /blah/'],
            ['/blah/',        {status: 404}]
        ], function() {
               checkRouting(head2, [
                   ['/foobar/',      'Proxied GET response for /'],
                   ['/foobar/blah/', 'Proxied GET response for /blah/'],
                   ['/blah/',        {status: 404}]
               ], done);
           });
    });

    it("can proxy simple POST requests", function(done) {
        var fakeHttpCC = fakeHttpCreateClient(function(m, p, h, data) {
            var res = "Proxied " + m + " response for " + p;
            return res + (typeof(data) === 'undefined' ? '' :
                          " with data \"" + data + "\"");
        });
        var head = new HydraHeadProxy({basePath: '/foobar',
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

    it("know which paths they can dispatch", function() {
        var validPaths = ['/foobar', '/foobar/', '/foobar/..', '/foobar/.file',
                          '/foobar/dir/file', '/foobar/dir/file.txt'];
        var invalidPaths = ['/', '/fooba', '/fooba/', '/qux/foobar',
                            '/foobarqux'];

        ['/foobar', '/foobar/'].forEach(function(dispatchPath) {
            var head = new HydraHeadProxy({basePath: dispatchPath,
                                           proxyTo: 'http://www.example.com'});
            validPaths.forEach(function(path) {
                expect(head).toHandle(path);
            });
            invalidPaths.forEach(function(path) {
                expect(head).not().toHandle(path);
            });
        });
    });
});


describe("Admin Hydra heads", function() {
    it("can't be created without necessary properties", function() {
        expect(function() {
            var head = new HydraHeadAdmin({basePath: '/hydra/admin'});
        }).toThrow("InvalidHydraHeadException");
    });

    it("show the admin interface by default on /hydra-admin{,/}", function(done) {
        var hydra = {getPlugins: function() { return []; },
                     getPluginNames: function() { return ['test-plugin'] }};
        var head = new HydraHeadAdmin({hydra: hydra});

        checkRouting(head, [
            ['/hydra-admin',  {status: 200}],
            ['/hydra-admin/', {status: 200}],
            ['/blah/',        {status: 404}]
        ], done);
    });

    it("show the names of the plugins on the admin index page", function(done) {
        var head;
        function getPlugins() {
            return [{name: 'admin-plugin',
                     heads: [head]}];
        }
        var hydra = { getPlugins: getPlugins,
                      getPluginNames: function() { return ['admin-plugin']; }
                    };
        head = new HydraHeadAdmin({name: 'Hydra Admin UI', hydra: hydra});

        withResponse(head, '/hydra-admin', function(res) {
            var responseText = res.send.getCall(0).args[0];
            expect(responseText).toMatch(/admin-plugin/);
            expect(responseText).toMatch(/Hydra Admin UI/);
            done();
        });
    });
});
