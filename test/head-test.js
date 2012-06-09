/*global describe, it, expect*/
var buster = require("buster");
var helpers         = require("./helpers"),
    checkRouting    = helpers.checkRouting,
    withResponse    = helpers.withResponse,
    fakeFs          = helpers.fakeFs,
    fakeHttpRequest = helpers.fakeHttpRequest;
var heads                   = require("../lib/heads"),
    RoboHydraHead           = heads.RoboHydraHead,
    RoboHydraHeadStatic     = heads.RoboHydraHeadStatic,
    RoboHydraHeadFilesystem = heads.RoboHydraHeadFilesystem,
    RoboHydraHeadProxy      = heads.RoboHydraHeadProxy;

buster.spec.expose();

describe("Generic RoboHydra heads", function() {
    it("can't be created without necessary properties", function() {
        var head;

        expect(function() {
            head = new RoboHydraHead();
        }).toThrow("InvalidRoboHydraHeadException");

        expect(function() {
            head = new RoboHydraHead({path: '/'});
        }).toThrow("InvalidRoboHydraHeadException");

        expect(function() {
            head = new RoboHydraHead({handler: function() {}});
        }).toThrow("InvalidRoboHydraHeadException");
    });

    it("can have a name", function() {
        var head = new RoboHydraHead({name: 'foo',
                                      path: '/', handler: function() {}});
        expect(head.name).toEqual('foo');

        var namelessHead = new RoboHydraHead({path: '/', handler: function() {}});
        expect(namelessHead.name).not.toBeDefined();
    });

    it("can serve simple content", function(done) {
        var head = new RoboHydraHead({path: '/foobar',
                                      handler: function(req, res) {
                                          res.send('Response for ' + req.url);
                                      }});

        checkRouting(head, [
            ['/foobar', 'Response for /foobar']
        ], done);
    });

    it("can serve content from path matching a regular expression", function(done) {
        var head = new RoboHydraHead({path: '/foobar(/[a-z]*)?',
                                      handler: function(req, res) {
                                          res.send('Response for ' + req.url);
                                      }});

        checkRouting(head, [
            ['/foobar', 'Response for /foobar'],
            ['/foobar/', 'Response for /foobar/'],
            ['/foobar/qux', 'Response for /foobar/qux'],
            ['/foobar/qux123', {statusCode: 404}],
            ['/foobar/123qux', {statusCode: 404}]
        ], done);
    });

    it("can be created attached/detached", function() {
        var detachedHead = new RoboHydraHead({detached: true,
                                              path: '/',
                                              handler: function() {}});
        expect(detachedHead.attached()).toEqual(false);

        var normalHead = new RoboHydraHead({path: '/', handler: function() {}});
        expect(normalHead.attached()).toEqual(true);

        var explicitHead = new RoboHydraHead({path: '/', handler: function() {}});
        expect(explicitHead.attached()).toEqual(true);
    });

    it("can be attached/detached dynamically", function() {
        var head = new RoboHydraHead({path: '/', handler: function() {}});
        expect(head.attached()).toEqual(true);
        head.detach();
        expect(head.attached()).toEqual(false);
        head.attach();
        expect(head.attached()).toEqual(true);
    });

    it("can't be attached/detached when already in that state", function() {
        var head = new RoboHydraHead({path: '/', handler: function() {}});
        expect(function() {
            head.attach();
        }).toThrow("InvalidRoboHydraHeadStateException");
        expect(head.attached()).toEqual(true);
        head.detach();
        expect(head.attached()).toEqual(false);
        expect(function() {
            head.detach();
        }).toThrow("InvalidRoboHydraHeadStateException");
        expect(head.attached()).toEqual(false);
    });

    it("never dispatch any paths when detached", function() {
        var headStatic = new RoboHydraHead({detached: true, path: '/foo.*',
                                            handler: function() {}});
        var headDynamic = new RoboHydraHead({path: '/foo.*',
                                             handler: function() {}});
        headDynamic.detach();

        var paths = ['/foo', '/foo/bar'];
        [headStatic, headDynamic].forEach(function(head) {
            expect(head).not.toHandle('/');
            paths.forEach(function(path) {
                expect(head).not.toHandle(path);
            });
            head.attach();
            expect(head).not.toHandle('/');
            paths.forEach(function(path) {
                expect(head).toHandle(path);
            });
        });
    });

    it("know which static paths they can dispatch", function() {
        var validPaths = ['/foo/ba', '/foo/b/',
                          '/foo/baaaa', '/foo/baa?param=value'];
        var invalidPaths = ['/foo/bar', '/foo/'];

        var head = new RoboHydraHead({path: '/foo/ba*', handler: function() {}});
        validPaths.forEach(function(path) {
            expect(head).toHandle(path);
        });
        invalidPaths.forEach(function(path) {
            expect(head).not.toHandle(path);
        });
    });

    it("know which paths they can dispatch with variables", function() {
        var validPaths = ['/article/show/123', '/page/edit/123/',
                          '/article/list/all?page=3'];
        var invalidPaths = ['/article/show/123/456', '/article/',
                            '/article/show'];

        var head = new RoboHydraHead({path: '/:controller/:action/:id',
                                      handler: function() {}});
        validPaths.forEach(function(path) {
            expect(head).toHandle(path);
        });
        invalidPaths.forEach(function(path) {
            expect(head).not.toHandle(path);
        });
    });

    it("set the appropriate request params with the request variables", function(done) {
        var controller, action, id;
        var head = new RoboHydraHead({path: '/:controller/:action/:id',
                                      handler: function(req, res) {
                                          controller = req.params.controller;
                                          action     = req.params.action;
                                          id         = req.params.id;
                                          res.send("Response for " + req.url);
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

describe("Static content RoboHydra heads", function() {
    it("can't be created without necessary properties", function() {
        expect(function() {
            var head = new RoboHydraHeadStatic();
        }).toThrow("InvalidRoboHydraHeadException");

        expect(function() {
            var head = new RoboHydraHeadStatic({path: '/'});
        }).toThrow("InvalidRoboHydraHeadException");
    });

    it("can be created with only static content", function(done) {
        var text = 'static content';
        var head = new RoboHydraHeadStatic({content: text});

        checkRouting(head, [
            ['/', text],
            ['/foobar', text]
        ], done);
    });

    it("can be created with path and static content", function(done) {
        var text = 'static content';
        var head = new RoboHydraHeadStatic({path: '/', content: text});
        checkRouting(head, [
            ['/', text],
            ['/foobarqux', {statusCode: 404}] // only the given path is served
        ], done);
    });

    it("return 404 when requesting unknown paths", function(done) {
        var head = new RoboHydraHeadStatic({path: '/foobar',
                                            content: 'static content'});
        checkRouting(head, [
            ['/', {statusCode: 404}],
            ['/foobarqux', {statusCode: 404}],
            ['/fooba', {statusCode: 404}]
        ], done);
    });

    it("know which static paths they can dispatch", function() {
        var validPaths = ['/foobar', '/foobar/'];
        var invalidPaths = ['/', '/fooba', '/foobar/qux', '/qux/foobar'];

        ['/foobar', '/foobar/'].forEach(function(dispatchPath) {
            var head = new RoboHydraHeadStatic({path: dispatchPath,
                                                content: "Some test content"});
            validPaths.forEach(function(path) {
                expect(head).toHandle(path);
            });
            invalidPaths.forEach(function(path) {
                expect(head).not.toHandle(path);
            });
        });
    });

    it("know which regular expression paths they can dispatch", function() {
        var validPaths = ['/foo/a', '/foo/abcd', '/foo/abcd/'];
        var invalidPaths = ['/', '/foo/', '/foobar/', '/foo/qux/mux'];

        var head = new RoboHydraHeadStatic({path: '/foo/[^/]+',
                                            content: "Some test content"});
        validPaths.forEach(function(path) {
            expect(head).toHandle(path);
        });
        invalidPaths.forEach(function(path) {
            expect(head).not.toHandle(path);
        });
    });

    it("know which paths they can dispatch by default", function() {
        var head = new RoboHydraHeadStatic({content: "Some test content"});
        ['/', '/foobar', '/foo/bar'].forEach(function(path) {
            expect(head).toHandle(path);
        });
    });

    it("can automatically stringify a Javascript object", function(done) {
        var head = new RoboHydraHeadStatic({content: ['one', 'two', {three: 3}]});
        withResponse(head, '/json', function(res) {
            var resultObject = JSON.parse(res.body);
            expect(resultObject.length).toEqual(3);
            expect(resultObject[0]).toEqual('one');
            expect(resultObject[1]).toEqual('two');
            expect(resultObject[2].three).toEqual(3);
            done();
        });
    });

    it("can return a given Content-Type", function(done) {
        var contentType = "application/xml";
        var head = new RoboHydraHeadStatic({content: "<xml/>",
                                            contentType: contentType});
        withResponse(head, '/', function(res) {
            expect(res.headers['content-type']).toEqual(contentType);
            done();
        });
    });

    it("return 'application/json' type by default when content is an object", function(done) {
        var head = new RoboHydraHeadStatic({content: {some: 'object'}});
        withResponse(head, '/', function(res) {
            expect(res.headers['content-type']).toEqual("application/json");
            done();
        });
    });

    it("can use a specific Content Type when content is an object", function(done) {
        var contentType = "application/x-made-up";
        var head = new RoboHydraHeadStatic({content: {some: 'object'},
                                            contentType: contentType});
        withResponse(head, '/', function(res) {
            expect(res.headers['content-type']).toEqual(contentType);
            done();
        });
    });

    it("can return a given status code", function(done) {
        var statusCode = 202;
        var head = new RoboHydraHeadStatic({
            content: {some: 'object'},
            statusCode: statusCode
        });
        withResponse(head, '/', function(res) {
            expect(res.statusCode).toEqual(statusCode);
            done();
        });
    });
});

describe("Filesystem RoboHydra heads", function() {
    it("can't be created without necessary properties", function() {
        expect(function() {
            var head = new RoboHydraHeadFilesystem({mountPath: '/'});
        }).toThrow("InvalidRoboHydraHeadException");
    });

    it("serve files from default mountPath = /", function(done) {
        var fileContents    = "file contents",
            dirFileContents = "dir file contents";
        var head = new RoboHydraHeadFilesystem({
            documentRoot: '/var/www',
            fs: fakeFs({'/var/www/file.txt':     fileContents,
                        '/var/www/dir/file.txt': dirFileContents})
        });

        checkRouting(head, [
            ['/file.txt', fileContents],
            ['/dir/file.txt', dirFileContents],
            ['/dir/non-existentfile.txt', {statusCode: 404}]
        ], done);
    });

    it("serve files from the file system", function(done) {
        var fileContents = "file contents";
        var head = new RoboHydraHeadFilesystem({mountPath: '/foobar',
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
        var head = new RoboHydraHeadFilesystem({mountPath: '/foobar',
                                                documentRoot: '/var/www',
                                                fs: fakeFs({'/var/www/file.txt':
                                                            fileContents})});

        checkRouting(head, [
            ['/foobar/file.txt~', {statusCode: 404}],
            ['/foobar/something-completely-different.txt', {statusCode: 404}],
            ['/file.txt~', {statusCode: 404}]
        ], done);
    });

    it("serve files from the file system with a trailing slash in documentRoot", function(done) {
        var fileContents = "file contents";
        var head = new RoboHydraHeadFilesystem({mountPath: '/foobar',
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
        var head = new RoboHydraHeadFilesystem({mountPath: '/foobar/',
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
        var head = new RoboHydraHeadFilesystem({mountPath: '/foobar/',
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
            var head = new RoboHydraHeadFilesystem({mountPath: dispatchPath,
                                                    documentRoot: '/var/www'});
            validPaths.forEach(function(path) {
                expect(head).toHandle(path);
            });
            invalidPaths.forEach(function(path) {
                expect(head).not.toHandle(path);
            });
        });
    });

    it("sets the correct Content-Type for the served files", function(done) {
        var head = new RoboHydraHeadFilesystem({
            documentRoot: '/var/www',
            fs: fakeFs({'/var/www/json.txt': 'foobar'}),
            mime: {lookup: function(path) { return "text/x-fake"; }}
        });
        withResponse(head, '/json.txt', function(res) {
            expect(res.headers['content-type']).toEqual("text/x-fake");
            done();
        });
    });

    it("sets the correct Last-Modified for the served files", function(done) {
        var mtime = new Date();
        var head = new RoboHydraHeadFilesystem({
            documentRoot: '/var/www',
            fs: fakeFs({
                '/var/www/json.txt': {
                    content: 'foobar',
                    mtime: mtime
                }
            })
        });
        withResponse(head, '/json.txt', function(res) {
            expect(res.headers['last-modified']).toEqual(mtime.toUTCString());
            done();
        });
    });

    it("serves 304 for not modified files", function(done) {
        var headers = {
            'if-modified-since': new Date(1337)
        };
        var head = new RoboHydraHeadFilesystem({
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

describe("Proxying RoboHydra heads", function() {
    it("can't be created without necessary properties", function() {
        expect(function() {
            var head = new RoboHydraHeadProxy({mountPath: '/'});
        }).toThrow("InvalidRoboHydraHeadException");
    });

    it("proxy from default mountPath = /", function(done) {
        var fakeHttpR = fakeHttpRequest(function(m, p, h) {
            return "Proxied " + m + " response for " + p;
        });
        var head = new RoboHydraHeadProxy({
            proxyTo: 'http://example.com/mounted',
            httpRequestFunction: fakeHttpR
        });

        checkRouting(head, [
            ['/',      'Proxied GET response for /mounted/'],
            ['/blah/', 'Proxied GET response for /mounted/blah/']
        ], done);
    });

    it("ignore the path property (hint: it's mountPath)", function(done) {
        var fakeHttpR = fakeHttpRequest(function(m, p, h) {
            return "Proxied " + m + " response for " + p;
        });
        var head = new RoboHydraHeadProxy({
            path: '/foo',
            proxyTo: 'http://example.com/mounted',
            httpRequestFunction: fakeHttpR
        });

        checkRouting(head, [
            ['/',      'Proxied GET response for /mounted/'],
            ['/blah/', 'Proxied GET response for /mounted/blah/']
        ], done);
    });

    it("can proxy simple GET requests", function(done) {
        var fakeHttpR = fakeHttpRequest(function(m, p, h) {
            return "Proxied " + m + " response for " + p;
        });
        var head = new RoboHydraHeadProxy({
            mountPath: '/foobar',
            proxyTo: 'http://example.com/mounted',
            httpRequestFunction: fakeHttpR
        });
        var head2 = new RoboHydraHeadProxy({
            mountPath: '/foobar',
            proxyTo: 'http://example.com/mounted/',
            httpRequestFunction: fakeHttpR
        });

        checkRouting(head, [
            ['/foobar/',      'Proxied GET response for /mounted/'],
            ['/foobar/blah/', 'Proxied GET response for /mounted/blah/'],
            ['/blah/',        {statusCode: 404}]
        ], function() {
               checkRouting(head2, [
                   ['/foobar/',      'Proxied GET response for /mounted/'],
                   ['/foobar/blah/', 'Proxied GET response for /mounted/blah/'],
                   ['/blah/',        {statusCode: 404}]
               ], done);
           });
    });

    it("can proxy GET requests with parameters", function(done) {
        var fakeHttpR = fakeHttpRequest(function(m, p, h) {
            return "Proxied " + m + " response for " + p;
        });
        var head = new RoboHydraHeadProxy({
            mountPath: '/foobar',
            proxyTo: 'http://example.com/mounted',
            httpRequestFunction: fakeHttpR
        });

        checkRouting(head, [
            ['/foobar/?var=val&lang=scala', 'Proxied GET response for /mounted/?var=val&lang=scala']
        ], done);
    });

    it("can proxy simple GET requests to a site's root path", function(done) {
        var fakeHttpR = fakeHttpRequest(function(m, p, h) {
            return "Proxied " + m + " response for " + p;
        });
        var head = new RoboHydraHeadProxy({
            mountPath: '/foobar',
            proxyTo: 'http://example.com',
            httpRequestFunction: fakeHttpR
        });
        var head2 = new RoboHydraHeadProxy({
            mountPath: '/foobar',
            proxyTo: 'http://example.com/',
            httpRequestFunction: fakeHttpR
        });

        checkRouting(head, [
            ['/foobar/',      'Proxied GET response for /'],
            ['/foobar/blah/', 'Proxied GET response for /blah/'],
            ['/blah/',        {statusCode: 404}]
        ], function() {
               checkRouting(head2, [
                   ['/foobar/',      'Proxied GET response for /'],
                   ['/foobar/blah/', 'Proxied GET response for /blah/'],
                   ['/blah/',        {statusCode: 404}]
               ], done);
           });
    });

    it("can proxy simple POST requests", function(done) {
        var fakeHttpR = fakeHttpRequest(function(m, p, h, data) {
            var res = "Proxied " + m + " response for " + p;
            return res + (typeof(data) === 'undefined' ? '' :
                          ' with data "' + data + '"');
        });
        var head = new RoboHydraHeadProxy({
            mountPath: '/foobar',
            proxyTo: 'http://example.com/mounted',
            httpRequestFunction: fakeHttpR
        });

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
             {statusCode: 404}]
        ], done);
    });

    it("can proxy POST requests with GET parameters", function(done) {
        var fakeHttpR = fakeHttpRequest(function(m, p, h, data) {
            var res = "Proxied " + m + " response for " + p;
            return res + (typeof(data) === 'undefined' ? '' :
                          " with data \"" + data + "\"");
        });
        var head = new RoboHydraHeadProxy({
            mountPath: '/foobar',
            proxyTo: 'http://example.com/mounted',
            httpRequestFunction: fakeHttpR
        });

        checkRouting(head, [
            [{path: '/foobar/?getparam=value',
              method: 'POST',
              postData: 'some data'},
             'Proxied POST response for /mounted/?getparam=value with data "some data"']
        ], done);
    });

    it("can proxy requests to non-standard ports", function(done) {
        var fakeHttpR = fakeHttpRequest(function(m, p, h, d, host, port) {
            var res = "Proxied " + m + " response for " + host + ":" + port +
                                 " -> " + p;
            return res + (typeof(d) === 'undefined' ? '' :
                          " with data \"" + d + "\"");
        });
        var head = new RoboHydraHeadProxy({
            mountPath: '/foobar',
            proxyTo: 'http://example.com:3000/',
            httpRequestFunction: fakeHttpR
        });

        checkRouting(head, [
            ['/foobar/', 'Proxied GET response for example.com:3000 -> /']
        ], done);
    });

    it("know which paths they can dispatch", function() {
        var validPaths = ['/foobar', '/foobar/', '/foobar/..', '/foobar/.file',
                          '/foobar/dir/file', '/foobar/dir/file.txt'];
        var invalidPaths = ['/', '/fooba', '/fooba/', '/qux/foobar',
                            '/foobarqux'];

        ['/foobar', '/foobar/'].forEach(function(dispatchPath) {
            var head = new RoboHydraHeadProxy({
                mountPath: dispatchPath,
                proxyTo: 'http://www.example.com'
            });
            validPaths.forEach(function(path) {
                expect(head).toHandle(path);
            });
            invalidPaths.forEach(function(path) {
                expect(head).not.toHandle(path);
            });
        });
    });
});
