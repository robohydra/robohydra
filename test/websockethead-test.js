/*global describe, it*/

var buster = require("buster");
var utils   = require("../lib/utils"),
    Request = utils.Request;
var helpers               = require("./helpers"),
    checkWebSocketRouting = helpers.checkWebSocketRouting,
    simpleReq             = helpers.simpleReq;
var heads                  = require("../lib/heads"),
    RoboHydraWebSocketHead = heads.RoboHydraWebSocketHead;

buster.spec.expose();
var expect = buster.expect;

describe("Generic RoboHydraWebSocket heads", function() {
    "use strict";

    it("can't be created without necessary properties", function() {
        expect(function() {
            /*jshint nonew: false*/
            new RoboHydraWebSocketHead({path: '/'});
        }).toThrow("InvalidRoboHydraHeadException");

        expect(function() {
            /*jshint nonew: false*/
            new RoboHydraWebSocketHead({handler: function() {}});
        }).toThrow("InvalidRoboHydraHeadException");
    });

    it("can have a name", function() {
        var head = new RoboHydraWebSocketHead({name: 'foo',
                                               path: '/', handler: function() {}});
        expect(head.name).toEqual('foo');

        var namelessHead = new RoboHydraWebSocketHead({path: '/', handler: function() {}});
        expect(namelessHead.name).not.toBeDefined();
    });

    it("can match simple paths", function() {
        var head = new RoboHydraWebSocketHead({
            path: '/foobar',
            handler: function(req, socket) {
                socket.send('Response for ' + req.url);
            }
        });

        expect(head).toHandle('/foobar');
        expect(head).not.toHandle('/foobar2');
        expect(head).not.toHandle('/foobar/2');
        expect(head).not.toHandle('/');
    });

    it("can match paths with regular expressions", function(done) {
        var head = new RoboHydraWebSocketHead({
            path: '/foobar(/[a-z]*)?',
            handler: function(req, socket) {
                socket.send('Response for ' + req.url);
            }
        });

        checkWebSocketRouting(head, [
            ['/foobar', 'Response for /foobar'],
            ['/foobar/', 'Response for /foobar/'],
            ['/foobar/qux', 'Response for /foobar/qux'],
            ['/foobar/qux123', {statusCode: 404}],
            ['/foobar/123qux', {statusCode: 404}]
        ], done);
    });

    it("can be created attached/detached", function() {
        var detachedHead = new RoboHydraWebSocketHead({detached: true,
                                                       path: '/',
                                                       handler: function() {}});
        expect(detachedHead.attached()).toEqual(false);

        var normalHead = new RoboHydraWebSocketHead({path: '/', handler: function() {}});
        expect(normalHead.attached()).toEqual(true);

        var explicitHead = new RoboHydraWebSocketHead({path: '/', handler: function() {}});
        expect(explicitHead.attached()).toEqual(true);
    });

    it("can be attached/detached dynamically", function() {
        var head = new RoboHydraWebSocketHead({path: '/', handler: function() {}});
        expect(head.attached()).toEqual(true);
        head.detach();
        expect(head.attached()).toEqual(false);
        head.attach();
        expect(head.attached()).toEqual(true);
    });

    it("can't be attached/detached when already in that state", function() {
        var head = new RoboHydraWebSocketHead({path: '/', handler: function() {}});
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
        var headStatic = new RoboHydraWebSocketHead({detached: true, path: '/foo.*',
                                                     handler: function() {}});
        var headDynamic = new RoboHydraWebSocketHead({path: '/foo.*',
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

        var head = new RoboHydraWebSocketHead({path: '/foo/ba*', handler: function() {}});
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

        var head = new RoboHydraWebSocketHead({path: '/:controller/:action/:id',
                                               handler: function() {}});
        validPaths.forEach(function(path) {
            expect(head).toHandle(path);
        });
        invalidPaths.forEach(function(path) {
            expect(head).not.toHandle(path);
        });
    });

    it("dispatch heads only if they match the hostname", function() {
        var handler = function(req, res) { res.end(); };
        var head = new RoboHydraWebSocketHead({path: '/.*',
                                               hostname: 'example.com',
                                               handler: handler});

        expect(head).toHandle(new Request({url: '/',
                                           headers: {host: 'example.com'}}));
        expect(head).not.toHandle(new Request({url: '/',
                                               headers: {host: 'localhost'}}));
    });

    it("dispatch treats hostname as regex", function() {
        var handler = function(req, res) { res.end(); };
        var head = new RoboHydraWebSocketHead({path: '/.*',
                                               hostname: 'local.*',
                                               handler: handler});

        expect(head).not.toHandle(new Request({
            url: '/',
            headers: {host: 'example.com'}
        }));
        expect(head).not.toHandle(new Request({
            url: '/',
            headers: {host: 'www.local'}
        }));
        expect(head).toHandle(new Request({
            url: '/',
            headers: {host: 'localhost'}
        }));
        expect(head).toHandle(new Request({
            url: '/',
            headers: {host: 'localserver'}
        }));
    });

    it("dispatch ignores port when matching hostname", function() {
        var handler = function(req, res) { res.end(); };
        var head = new RoboHydraWebSocketHead({path: '/.*',
                                               hostname: 'example.com',
                                               handler: handler});

        expect(head).toHandle(new Request({
            url: '/',
            headers: {host: 'example.com:3000'}
        }));
    });

    it("set the appropriate request params with the request variables", function() {
        var controller, action, id;
        var head = new RoboHydraWebSocketHead({
            path: '/:controller/:action/:id',
            handler: function(req/*, socket*/) {
                controller = req.params.controller;
                action     = req.params.action;
                id         = req.params.id;
            }
        });

        head.handle(simpleReq('/article/show/123'));
        expect(controller).toEqual('article');
        expect(action).toEqual('show');
        expect(id).toEqual('123');

        head.handle(simpleReq('/page/edit/456/'));
        expect(controller).toEqual('page');
        expect(action).toEqual('edit');
        expect(id).toEqual('456');

        head.handle(simpleReq('/widget/search/term?page=2'));
        expect(controller).toEqual('widget');
        expect(action).toEqual('search');
        expect(id).toEqual('term');
    });
});
