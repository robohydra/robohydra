var buster = require("buster");
var sinon = require('sinon');
var HydraHead = require("../lib/hydraHead").HydraHead;

buster.spec.expose();

buster.assertions.add("responseMatches", {
    assert: function (actual, expectedResponse) {
        var r = true;
        if (typeof(expectedResponse) === 'string') {
            expectedResponse = {content: expectedResponse};
        }
        if (expectedResponse.hasOwnProperty('content')) {
            r = r && (actual.send.getCall(0).args[0] ===
                      expectedResponse.content);
        }
        if (expectedResponse.hasOwnProperty('status')) {
            r = r && (actual.statusCode === expectedResponse.status);
        }
        return r;
    },
    assertMessage: "Expected ${0} to produce response '${1}'!",
    refuteMessage: "Expected ${0} to not produce response '${1}'!",
    expectation: "toMatchResponse"
});

function withResponse(head, path, cb) {
    var fakeReq = { url: path };
    var fakeRes = { send: sinon.spy(),
                    toString: function() {
                        return 'Fake response for ' + path;
                    } };
    head.handle(fakeReq, fakeRes, function() {
        cb(fakeRes);
    });
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



describe("Hydra heads", function() {
    it("can't be created without necessary properties", function() {
        var head;

        expect(function() {
            head = new HydraHead();
        }).toThrow("InvalidHydraHeadException");

        expect(function() {
            head = new HydraHead({path: '/'});
        }).toThrow("InvalidHydraHeadException");
    });

    it("can be created with only static content", function(done) {
        var text = 'static content';
        var head = new HydraHead({content: text});

        checkRouting(head, [
            ['/', text],
            ['/foobar', text]
        ], done);
    });

    it("can be created with path and static content", function(done) {
        var text = 'static content';
        var head = new HydraHead({path: '/', content: text});
        checkRouting(head, [
            ['/', text],
            ['/foobarqux', {status: 404}] // only the given path is served
        ], done);
    });

    it("return 404 when requesting unknown paths", function(done) {
        var head = new HydraHead({path: '/foobar', content: 'static content'});
        checkRouting(head, [
            ['/', {status: 404}],
            ['/foobarqux', {status: 404}],
            ['/fooba', {status: 404}]
        ], done);
    });

    it("serve files from the file system", function(done) {
        var fileContents = "file contents";
        var head = new HydraHead({path: '/foobar',
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
        var head = new HydraHead({path: '/foobar',
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
        var head = new HydraHead({path: '/foobar',
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
        var head = new HydraHead({path: '/foobar/',
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
        var head = new HydraHead({path: '/foobar/',
                                  documentRoot: '/var/www/',
                                  fs: fakeFs({'/var/www/file.txt':
                                              fileContents})});

        checkRouting(head, [
            ['/foobar/file.txt', fileContents],
            ['/foobar//file.txt', fileContents]
        ], done);
    });
});
