/*global describe, it, expect*/

var buster = require("buster"),
    zlib   = require("zlib");
var helpers         = require("./helpers"),
    checkRouting    = helpers.checkRouting,
    withResponse    = helpers.withResponse,
    fakeFs          = helpers.fakeFs,
    fakeHttpRequest = helpers.fakeHttpRequest,
    simpleReq       = helpers.simpleReq;
var Response        = require("../lib/robohydra").Response;
var heads                   = require("../lib/heads"),
    RoboHydraHead           = heads.RoboHydraHead,
    RoboHydraHeadStatic     = heads.RoboHydraHeadStatic,
    RoboHydraHeadFilesystem = heads.RoboHydraHeadFilesystem,
    RoboHydraHeadProxy      = heads.RoboHydraHeadProxy,
    RoboHydraHeadFilter     = heads.RoboHydraHeadFilter,
    RoboHydraHeadWatchdog   = heads.RoboHydraHeadWatchdog;
var InvalidRoboHydraHeadException =
        require("../lib/exceptions").InvalidRoboHydraHeadException;

buster.spec.expose();

describe("Generic RoboHydra heads", function() {
    "use strict";

    it("can't be created without necessary properties", function() {
        expect(function() {
            /*jshint nonew: false*/
            new RoboHydraHead({path: '/'});
        }).toThrow("InvalidRoboHydraHeadException");

        expect(function() {
            /*jshint nonew: false*/
            new RoboHydraHead({handler: function() {}});
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
    "use strict";

    it("can't be created without necessary properties", function() {
        expect(function() {
            /*jshint nonew: false*/
            new RoboHydraHeadStatic({});
        }).toThrow("InvalidRoboHydraHeadException");

        expect(function() {
            /*jshint nonew: false*/
            new RoboHydraHeadStatic({path: '/'});
        }).toThrow("InvalidRoboHydraHeadException");
    });

    it("can't be created with extra, unknown properties", function() {
        expect(function() {
            /*jshint nonew: false*/
            new RoboHydraHeadStatic({madeUpProperty: true});
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

    it("can be created with responses", function(done) {
        var text = 'static content';
        var head = new RoboHydraHeadStatic({responses: [{content: text}]});
        checkRouting(head, [
            ['/', text]
        ], done);
    });

    it("cannot be created with an empty response array", function() {
        expect(function() {
            /*jshint nonew: false*/
            new RoboHydraHeadStatic({responses: []});
        }).toThrow("InvalidRoboHydraHeadException");
    });

    it("cannot be created with responses with wrong properties", function() {
        expect(function() {
            /*jshint nonew: false*/
            new RoboHydraHeadStatic({responses: [{content: "",
                                                  // Typo for "statusCode"
                                                  status: 500}]});
        }).toThrow("InvalidRoboHydraHeadException");
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

    it("can cycle through an array of responses", function(done) {
        var response1 = "response 1";
        var response2 = "response 2";
        var head = new RoboHydraHeadStatic({
            responses: [{content: response1},
                        {content: response2}]
        });
        checkRouting(head, [
            ['/', response1],
            ['/', response2],
            ['/', response1]
        ], done);
    });

    it("can be reset and started from scratch", function(done) {
        var response1 = "response 1",
            response2 = "response 2";
        var head = new RoboHydraHeadStatic({
            responses: [{content: response1},
                        {content: response2}]
        });
        checkRouting(head, [
            ['/', response1],
            ['/', response2],
            ['/', response1]
        ], function() {
            head.reset();
            withResponse(head, '/', function(res) {
                expect(res.body.toString()).toEqual(response1);
                done();
            });
        });
    });

    it("use content, statusCode and contentType by default", function(done) {
        var defaultContent     = 'It works!';
        var defaultContentType = 'application/x-foobar';
        var defaultStatusCode  = 202;
        var response1    = "response 1";
        var response2    = "response 2";
        var contentType1 = 'application/x-custom';
        var statusCode2  = 404;
        var contentType3 = 'application/x-default-content';
        var head = new RoboHydraHeadStatic({
            responses: [{content: response1,
                         contentType: contentType1},
                        {content: response2,
                         statusCode: statusCode2},
                        {contentType: contentType3}],
            content: defaultContent,
            statusCode: defaultStatusCode,
            contentType: defaultContentType
        });
        checkRouting(head, [
            ['/', {content: response1,
                   contentType: contentType1,
                   statusCode: defaultStatusCode}],
            ['/', {content: response2,
                   contentType: defaultContentType,
                   statusCode: statusCode2}],
            ['/', {content: defaultContent,
                   contentType: contentType3,
                   statusCode: defaultStatusCode}],
            ['/', {content: response1,
                   contentType: contentType1,
                   statusCode: defaultStatusCode}]
        ], done);
    });
});

describe("Filesystem RoboHydra heads", function() {
    "use strict";

    it("can't be created without necessary properties", function() {
        expect(function() {
            /*jshint nonew: false*/
            new RoboHydraHeadFilesystem({mountPath: '/'});
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
            ['/file.txt', {statusCode: 404}]
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

    it("serve files from the file system with URL parameters", function(done) {
        var fileContents = "file contents";
        var head = new RoboHydraHeadFilesystem({mountPath: '/foobar/',
                                                documentRoot: '/var/www/',
                                                fs: fakeFs({'/var/www/file.txt':
                                                            fileContents})});

        checkRouting(head, [
            ['/foobar/file.txt?', fileContents],
            ['/foobar/file.txt?foo=bar', fileContents],
            ['/foobar/file.txt?foo=bar&qux=tux', fileContents]
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

    it("don't get confused with regular expression characters in paths", function(done) {
        var fileContents = "Correct content, yay! o/";
        var fakeFsObject = fakeFs({'/var/www/README': fileContents});
        var exoticUrlPath = '/id$[foo]+/*w|n*^{2,1}/c:\\new_dir(2)';

        var head = new RoboHydraHeadFilesystem({
            mountPath: exoticUrlPath,
            documentRoot: '/var/www',
            fs: fakeFsObject
        });
        // The problem with dots being treated as regular expressions
        // we have to test the other way around (making sure it
        // *doesn't* match)
        var head2 = new RoboHydraHeadFilesystem({
            mountPath: '/cmd.com',
            documentRoot: '/var/www',
            fs: fakeFsObject
        });

        checkRouting(head, [
            [exoticUrlPath + "/README", fileContents]
        ], function() {
            checkRouting(head2, [
                ["/cmd2com/README", {statusCode: 404}]
            ], done);
        });
    });

    it("sets the correct Content-Type for the served files", function(done) {
        var head = new RoboHydraHeadFilesystem({
            documentRoot: '/var/www',
            fs: fakeFs({'/var/www/json.txt': 'foobar',
                        '/var/www/json.nottxt': 'this is not a text file'}),
            mime: {
                lookup: function(path) {
                    return (/\.txt$/).test(path) ? "text/plain" : "text/x-fake";
                }
            }
        });
        withResponse(head, '/json.txt', function(res) {
            expect(res.headers['content-type']).toEqual("text/plain");
            withResponse(head, '/json.txt?var=val', function(res2) {
                expect(res2.headers['content-type']).toEqual("text/plain");
                withResponse(head, '/json.nottxt', function(res3) {
                    expect(res3.headers['content-type']).toEqual("text/x-fake");
                    done();
                });
            });
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

    it("serves index.html on directories by default", function(done) {
        var indexHtmlContents = 'index.html contents!';
        var head = new RoboHydraHeadFilesystem({
            documentRoot: '/var/www',
            fs: fakeFs({
                '/var/www/directory/index.html': indexHtmlContents
            })
        });

        checkRouting(head, [
            ['/directory',  indexHtmlContents],
            ['/directory/', indexHtmlContents]
        ], done);
    });

    it("can configure index files", function(done) {
        var indexFileContents = 'index.html contents!';
        var head = new RoboHydraHeadFilesystem({
            documentRoot: '/var/www',
            indexFiles: ['myindexfile.html'],
            fs: fakeFs({
                '/var/www/directory/myindexfile.html': indexFileContents,
                '/var/www/directory/index.html': 'WRONG INDEX FILE!'
            })
        });

        checkRouting(head, [
            ['/directory',  indexFileContents],
            ['/directory/', indexFileContents]
        ], done);
    });

    it("index files replace the defaults", function(done) {
        var head = new RoboHydraHeadFilesystem({
            documentRoot: '/var/www',
            indexFiles: ['myindexfile.html'],
            fs: fakeFs({
                '/var/www/directory/index.html': 'WRONG INDEX FILE!'
            })
        });

        checkRouting(head, [
            ['/directory/', {status: 404}]
        ], done);
    });

    it("all specified index files should work", function(done) {
        var correctIndexFileContents = "The contents of the index file";
        var head = new RoboHydraHeadFilesystem({
            documentRoot: '/var/www',
            indexFiles: ['index1.html', 'index2.html', 'index3.html'],
            fs: fakeFs({
                '/var/www/dir1/index1.html': correctIndexFileContents,
                '/var/www/dir2/index2.html': correctIndexFileContents,
                '/var/www/dir3/index3.html': correctIndexFileContents
            })
        });

        checkRouting(head, [
            ['/dir1/', correctIndexFileContents],
            ['/dir2/', correctIndexFileContents],
            ['/dir3/', correctIndexFileContents]
        ], done);
    });

    it("give preference to the first index files", function(done) {
        var correctIndexFileContents = "The contents of the index file",
            wrongIndexFileContents   = "Wrong index file contents";
        var head = new RoboHydraHeadFilesystem({
            documentRoot: '/var/www',
            indexFiles: ['index1.html', 'index2.html', 'index3.html'],
            fs: fakeFs({
                '/var/www/dir/index1.html': correctIndexFileContents,
                '/var/www/dir/index2.html': wrongIndexFileContents,
                '/var/www/dir/index3.html': wrongIndexFileContents
            })
        });

        checkRouting(head, [
            ['/dir/', correctIndexFileContents]
        ], done);
    });

    it("allows the index file list to be empty", function(done) {
        var head = new RoboHydraHeadFilesystem({
            documentRoot: '/var/www',
            indexFiles: [],
            fs: fakeFs({
                '/var/www/dir/index.html': "YOU SHOULD NOT SERVE THIS FILE!"
            })
        });

        checkRouting(head, [
            ['/dir/', {status: 403}]
        ], done);
    });

    it("can't serve directories without appropriate index files", function(done) {
        var head = new RoboHydraHeadFilesystem({
            documentRoot: '/var/www',
            fs: fakeFs({
                '/var/www/dir/random.html': "YOU SHOULD NOT SERVE THIS FILE!"
            })
        });

        checkRouting(head, [
            ['/dir/', {status: 403}]
        ], done);
    });
});

describe("Proxying RoboHydra heads", function() {
    "use strict";

    it("can't be created without necessary properties", function() {
        expect(function() {
            /*jshint nonew: false*/
            new RoboHydraHeadProxy({mountPath: '/'});
        }).toThrow("InvalidRoboHydraHeadException");
    });

    it("proxy from default mountPath = /", function(done) {
        var fakeHttpR = fakeHttpRequest(function(m, p/*, h*/) {
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

    it("can proxy simple GET requests", function(done) {
        var fakeHttpR = fakeHttpRequest(function(m, p/*, h*/) {
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
        var fakeHttpR = fakeHttpRequest(function(m, p/*, h*/) {
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
        var fakeHttpR = fakeHttpRequest(function(m, p/*, h*/) {
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
            return res + (data === undefined ? '' :
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
            return res + (data === undefined ? '' :
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
            return res + (d.length ? " with data \"" + d + "\"" : "");
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

    it("don't get confused with regular expression characters in paths", function(done) {
        var exoticUrlPath = '/id$foo';
        var fakeHttpR = fakeHttpRequest(function(method, path) {
            return "Response for " + method + " " + path;
        });

        var head = new RoboHydraHeadProxy({
            mountPath: exoticUrlPath,
            proxyTo: 'http://example.com',
            httpRequestFunction: fakeHttpR
        });

        checkRouting(head, [
            [exoticUrlPath + "/README", "Response for GET /README"]
        ], done);
    });

    it("sets the proxied hostname in headers by default", function(done) {
        var fakeHttpR = fakeHttpRequest(function(method, path, headers) {
            return "The host header says: " + headers.host;
        });
        var head1 = new RoboHydraHeadProxy({
            mountPath: '/example1',
            proxyTo: 'http://example.com',
            httpRequestFunction: fakeHttpR
        });
        var head2 = new RoboHydraHeadProxy({
            mountPath: '/example2',
            proxyTo: 'http://example.com:8080',
            httpRequestFunction: fakeHttpR
        });

        checkRouting(head1, [
            [{path: '/example1/foobar/',
              headers: {host: 'localhost:3000'}},
             'The host header says: example.com']
        ], function() {
            checkRouting(head2, [
                [{path: '/example2/foobar/',
                  headers: {host: 'localhost:3000'}},
                 'The host header says: example.com:8080']
            ], done);
        });
    });

    it("allows NOT setting the proxied hostname in headers", function(done) {
        var fakeHttpR = fakeHttpRequest(function(method, path, headers) {
            return "The host header says: " + headers.host;
        });
        var head1 = new RoboHydraHeadProxy({
            mountPath: '/example1',
            proxyTo: 'http://example.com',
            setHostHeader: false,
            httpRequestFunction: fakeHttpR
        });
        var head2 = new RoboHydraHeadProxy({
            mountPath: '/example2',
            proxyTo: 'http://example.com:8080',
            setHostHeader: false,
            httpRequestFunction: fakeHttpR
        });

        checkRouting(head1, [
            [{path: '/example1/foobar/',
              headers: {host: 'localhost:3000'}},
             'The host header says: localhost:3000']
        ], function() {
            checkRouting(head2, [
                [{path: '/example2/foobar/',
                  headers: {host: 'localhost'}},
                 'The host header says: localhost']
            ], done);
        });
    });

    it("can connect using HTTPS", function(done) {
        var fakeHttpR = fakeHttpRequest(function(/*method, path, headers*/) {
            return "WRONG, CONNECTION THROUGH HTTP";
        });
        var sslMessage = "SSL connection (HTTPS) to ";
        var fakeHttpsR = fakeHttpRequest(function(method, path/*, headers*/) {
            return sslMessage + path;
        });

        var head = new RoboHydraHeadProxy({
            mountPath: '/',
            proxyTo: 'https://example.com',
            httpRequestFunction: fakeHttpR,
            httpsRequestFunction: fakeHttpsR
        });
        checkRouting(head, [
            ['/foobar/', sslMessage + '/foobar/']
        ], done);
    });
});

describe("RoboHydra filtering heads", function() {
    "use strict";

    it("cannot be created without the 'filter' property", function() {
        expect(function() {
            /*jshint nonew: false*/
            new RoboHydraHeadFilter({path: '/.*'});
        }).toThrow("InvalidRoboHydraHeadException");
    });

    it("cannot be created with a non-function 'filter' property", function() {
        expect(function() {
            /*jshint nonew: false*/
            new RoboHydraHeadFilter({filter: ''});
        }).toThrow("InvalidRoboHydraHeadException");
    });

    it("can be created with only the 'filter' property", function() {
        expect(function() {
            /*jshint nonew: false*/
            new RoboHydraHeadFilter({filter: '/.*'});
        }).toThrow("InvalidRoboHydraHeadException");
    });

    it("filter trivial, non-compressed answers", function(done) {
        var head = new RoboHydraHeadFilter({
            filter: function(bodyText) {
                return bodyText.toString().toUpperCase();
            }
        });

        var next = function(_, res) { res.send("foobar"); };
        withResponse(head, {path: '/test', nextFunction: next}, function(res) {
            expect(res.body).toEqual("FOOBAR");
            done();
        });
    });

    it("keep status codes and headers", function(done) {
        function bodyUpdater(bodyText) {
            return "I change the body (orig: '" + bodyText +
                "'), but status code and headers remain the same";
        }
        var head = new RoboHydraHeadFilter({ filter: bodyUpdater });

        var origBody     = "response body",
            expectedBody = bodyUpdater(origBody),
            statusCode   = 401,
            headers      = {'content-type': 'application/x-snafu'};
        var next = function(_, res) {
            res.statusCode = 401;
            res.headers = headers;
            res.send(origBody);
        };
        withResponse(head, {path: '/', nextFunction: next}, function(res) {
            expect(res.body).toEqual(expectedBody);
            expect(res.statusCode).toEqual(statusCode);
            expect(res.headers).toEqual(headers);
            done();
        });
    });

    it("update the Content-Length header, if present", function(done) {
        var head = new RoboHydraHeadFilter({
            filter: function(text) { return "OH HAI " + text; }
        });

        var origBody    = "response body",
            contentType = 'application/x-snafu',
            headers     = {'content-type': contentType,
                           'content-length': origBody.length};
        var next = function(_, res) {
            res.headers = headers;
            res.send(origBody);
        };
        withResponse(head, {path: '/', nextFunction: next}, function(res) {
            expect(res.headers).toEqual({
                'content-type': contentType,
                'content-length': "OH HAI response body".length
            });
            done();
        });
    });

    it("don't add a Content-Length header if there wasn't one", function(done) {
        var head = new RoboHydraHeadFilter({
            filter: function(text) { return "OH HAI " + text; }
        });

        var origBody = "response body";
        var next = function(_, res) {
            res.send(origBody);
        };
        withResponse(head, {path: '/', nextFunction: next}, function(res) {
            expect(res.headers['content-length']).not.toBeDefined();
            done();
        });
    });

    it("update Content-Length header even if it was 0", function(done) {
        var head = new RoboHydraHeadFilter({
            filter: function(text) { return "OH HAI " + text.toString(); }
        });

        var next = function(_, res) {
            res.headers['content-length'] = 0;
            res.end();
        };
        withResponse(head, {path: '/', nextFunction: next}, function(res) {
            expect(res.headers['content-length']).toEqual(7);
            done();
        });
    });

    it("transparently uncompress and compress back gzip", function(done) {
        var head = new RoboHydraHeadFilter({
            filter: function(text) { return "OH HAI " + text.toString(); }
        });

        var next = function(_, res) {
            res.headers['content-encoding'] = 'gzip';
            // "THAR" gzip'ed
            res.send(new Buffer("H4sIAAAAAAAAAwvxcAwCAA3VpXcEAAAA", "base64"));
        };
        withResponse(head, {path: '/', nextFunction: next}, function(res) {
            expect(res.headers['content-encoding']).toEqual('gzip');
            zlib.gunzip(res.body, function(err, uncompressedBody) {
                expect(uncompressedBody).toEqual("OH HAI THAR");
                done();
            });
        });
    });

    it("transparently uncompress and compress back deflate", function(done) {
        var head = new RoboHydraHeadFilter({
            filter: function(text) { return new Buffer("- Buzz: " + text.toString()); }
        });

        var next = function(_, res) {
            res.headers['content-encoding'] = 'deflate';
            // "heads, heads everywhere" deflated
            res.send(new Buffer("eJzLSE1MKdZRyABRCqllqUWV5RmpRakAZNMIvQ==",
                                "base64"));
        };
        withResponse(head, {path: '/', nextFunction: next}, function(res) {
            expect(res.headers['content-encoding']).toEqual('deflate');
            zlib.inflate(res.body, function(err, uncompressedBody) {
                expect(uncompressedBody).toEqual("- Buzz: heads, heads everywhere");
                done();
            });
        });
    });

    it("pass through on unknown compression methods", function(done) {
        var head = new RoboHydraHeadFilter({
            filter: function(text) {
                return "lcase -> " + text.toString().toLowerCase();
            }
        });

        var text = "THISISVERYCOMPRESSEDDATANOTREALLY";
        var next = function(_, res) {
            res.headers['content-encoding'] = 'made-up';
            res.send(new Buffer(text));
        };
        withResponse(head, {path: '/', nextFunction: next}, function(res) {
            var bodyString = res.body.toString();
            expect(bodyString).toEqual("lcase -> " + text.toLowerCase());
            done();
        });
    });

    it("don't break streaming-expecting chained heads", function(done) {
        var head = new RoboHydraHeadFilter({
            filter: function(r) { return r.toString().toLowerCase(); }
        });

        var text = "SOME TEXT";
        var actualString;
        var res = new Response().
            on('data', function(evt) { actualString = evt.data.toString(); }).
            on('end', function() {
                expect(actualString).toEqual(text.toLowerCase());
                done();
            });
        var next = function(_, res) { res.send(new Buffer(text)); };
        head.handle(simpleReq('/'), res, next);
    });

    it("break if the filter function doesn't return anything", function(done) {
        var head = new RoboHydraHeadFilter({
            filter: function(body) { body.replace(/foo/, "bar"); }
        });
        var next = function(_, res) { res.send(new Buffer("foobar")); };
        withResponse(head, {path: '/', nextFunction: next}, function(res) {
            expect(res.statusCode).toEqual(500);
            done();
        });
    });

    it("re-throw exceptions if they were thrown after finishing the response", function() {
        var responseText = "Completely normal testing response";
        var head = new RoboHydraHead({
            path: '/.*',
            handler: function(req, res) {
                res.send(responseText);
            }
        });
        expect(function() {
            head.handle(simpleReq('/'), new Response(function(evt) {
                expect(evt.response.body.toString()).toEqual(responseText);
                throw new InvalidRoboHydraHeadException();
            }));
        }).toThrow("InvalidRoboHydraHeadException");
    });
});

describe("RoboHydra watchdog heads", function() {
    "use strict";

    it("can't be created without a watcher", function() {
        expect(function() {
            /*jshint nonew: false*/
            new RoboHydraHeadWatchdog({
                path: '/.*'
            });
        }).toThrow("InvalidRoboHydraHeadException");
    });

    it("can be created without a reporter", function() {
        expect(function() {
            /*jshint nonew: false*/
            new RoboHydraHeadWatchdog({
                watcher: function() { return true; }
            });
        }).not.toThrow();
    });

    it("complain if watcher is not a function", function() {
        expect(function() {
            /*jshint nonew: false*/
            new RoboHydraHeadWatchdog({
                watcher: 'not a function'
            });
        }).toThrow("InvalidRoboHydraHeadException");
    });

    it("complain if reporter is there but is not a function", function() {
        expect(function() {
            /*jshint nonew: false*/
            new RoboHydraHeadWatchdog({
                watcher: function() {},
                reporter: 'not a function'
            });
        }).toThrow("InvalidRoboHydraHeadException");
    });

    it("match all paths by default", function(done) {
        var spy = this.spy();
        var head = new RoboHydraHeadWatchdog({
            watcher: function() { return true; },
            reporter: spy
        });

        var fakeRes = new Response().on('end', function() {
            expect(spy).toHaveBeenCalledOnce();
            done();
        });
        head.handle(simpleReq('/madeuppath'), fakeRes, function(req, res) {
            res.end();
        });
    });

    it("work with a default reporter if none given", function(done) {
        var head = new RoboHydraHeadWatchdog({
            watcher: function() { return false; }
        });

        var fakeRes = new Response().on('end', function(/*evt*/) {
            expect(head.reporter).toBeFunction();
            done();
        });
        head.handle(simpleReq('/madeuppath'), fakeRes, function(req, res) {
            res.end();
        });
    });

    it("don't do anything if the watcher returns false", function(done) {
        var spy = this.spy();
        var head = new RoboHydraHeadWatchdog({
            watcher: function() { return false; },
            reporter: spy
        });

        var res = new Response().on('end', done);
        head.handle(simpleReq('/madeuppath'), res, function(req, res) {
            expect(spy).not.toHaveBeenCalled();
            res.end();
        });
    });

    it("pass the request to the watcher", function(done) {
        var path = '/some/path';
        var head = new RoboHydraHeadWatchdog({
            watcher: function(req) {
                expect(req.url).toEqual(path);
                return req.url === path;
            },
            reporter: function() {}
        });

        var res = new Response(done);
        head.handle(simpleReq(path), res, function(req, res) { res.end(); });
    });

    it("pass the response to the watcher", function(done) {
        var content = "Some random content";
        var head = new RoboHydraHeadWatchdog({
            watcher: function(req, res) {
                expect(res.body.toString()).toEqual(content);
            },
            reporter: function() {}
        });

        var res = new Response(done);
        head.handle(simpleReq('/'), res, function(req, res) {
            res.send(content);
        });
    });

    it("automatically uncompress gzip'ed response bodies", function(done) {
        var content = "Some random (but initially compressed) content";
        var head = new RoboHydraHeadWatchdog({
            watcher: function(req, res) {
                expect(res.body.toString()).toEqual(content);
            },
            reporter: function() {}
        });

        zlib.gzip(content, function(err, data) {
            if (err) { throw new Error("WTF DUDE"); }

            var res = new Response(done);
            head.handle(simpleReq('/'), res, function(req, res) {
                res.headers['content-encoding'] = 'gzip';
                res.send(data);
            });
        });
    });

    it("automatically uncompress deflated response bodies", function(done) {
        var content = "Some random (but initially deflated) content";
        var head = new RoboHydraHeadWatchdog({
            watcher: function(req, res) {
                expect(res.body.toString()).toEqual(content);
            },
            reporter: function() {}
        });

        zlib.deflate(content, function(err, data) {
            if (err) { throw new Error("WTF DUDE"); }

            var res = new Response(done);
            head.handle(simpleReq('/'), res, function(req, res) {
                res.headers['content-encoding'] = 'deflate';
                res.send(data);
            });
        });
    });

    it("always have raw response bodies available", function(done) {
        var content = "Some random (but initially deflated) content";

        zlib.deflate(content, function(err, data) {
            if (err) { throw new Error("WTF DUDE"); }

            var head = new RoboHydraHeadWatchdog({
                watcher: function(req, res) {
                    expect(res.body.toString()).toEqual(content);
                    expect(res.rawBody.toString('base64')).toEqual(data.toString('base64'));
                },
                reporter: function() {}
            });

            var res = new Response(done);
            head.handle(simpleReq('/'), res, function(req, res) {
                res.headers['content-encoding'] = 'deflate';
                res.send(data);
            });
        });
    });

    it("pass the same response to the reporter", function(done) {
        var path = 'random/path';
        var content = "Some random (but initially deflated) content";

        zlib.deflate(content, function(err, data) {
            if (err) { throw new Error("WTF DUDE"); }

            var head = new RoboHydraHeadWatchdog({
                watcher: function(/*req, res*/) { return true; },
                reporter: function(req, res) {
                    expect(req.url).toEqual(path);
                    expect(res.body.toString()).toEqual(content);
                    expect(res.rawBody.toString('base64')).toEqual(data.toString('base64'));
                }
            });

            var res = new Response(done);
            head.handle(simpleReq(path), res, function(req, res) {
                res.headers['content-encoding'] = 'deflate';
                res.send(data);
            });
        });
    });
});
