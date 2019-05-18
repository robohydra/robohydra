/*global describe, it*/

var mocha = require("mocha");
var chai = require("chai"),
    expect = chai.expect;
var utils   = require("../lib/utils"),
    Request = utils.Request;
var helpers               = require("./helpers"),
    checkWebSocketRouting = helpers.checkWebSocketRouting,
    simpleWsReq           = helpers.simpleWsReq;
var heads                       = require("../lib/heads"),
    RoboHydraWebSocketHead      = heads.RoboHydraWebSocketHead,
    RoboHydraWebSocketHeadProxy = heads.RoboHydraWebSocketHeadProxy;
var exceptions = require('../lib/exceptions'),
    InvalidRoboHydraHeadException =
        exceptions.InvalidRoboHydraHeadException,
    InvalidRoboHydraHeadStateException =
        exceptions.InvalidRoboHydraHeadStateException;

describe("Generic RoboHydraWebSocket heads", function() {
    "use strict";

    it("can't be created without necessary properties", function() {
        expect(function() {
            /*jshint nonew: false*/
            new RoboHydraWebSocketHead({path: '/'});
        }).to.throw(InvalidRoboHydraHeadException);
    });

    it("can have a name", function() {
        var head = new RoboHydraWebSocketHead({name: 'foo',
                                               handler: function() {}});
        expect(head.name).to.equal('foo');

        var namelessHead = new RoboHydraWebSocketHead({path: '/', handler: function() {}});
        expect(namelessHead.name).not.to.be.a('string');
    });

    it("match all paths by default", function() {
        var head = new RoboHydraWebSocketHead({handler: function() {}});

        expect(head).to.be.an('object');
    });

    it("can match simple paths", function() {
        var head = new RoboHydraWebSocketHead({
            path: '/foobar',
            handler: function(req, socket) {
                socket.send('Response for ' + req.url);
            }
        });

        expect(head).to.handle(simpleWsReq('/foobar'));
        expect(head).to.not.handle(simpleWsReq('/foobar2'));
        expect(head).to.not.handle(simpleWsReq('/foobar/2'));
        expect(head).to.not.handle(simpleWsReq('/'));
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
        expect(detachedHead.attached()).to.equal(false);

        var normalHead = new RoboHydraWebSocketHead({
            path: '/',
            handler: function() {}
        });
        expect(normalHead.attached()).to.equal(true);

        var explicitHead = new RoboHydraWebSocketHead({
            path: '/',
            handler: function() {}
        });
        expect(explicitHead.attached()).to.equal(true);
    });

    it("can be attached/detached dynamically", function() {
        var head = new RoboHydraWebSocketHead({path: '/', handler: function() {}});
        expect(head.attached()).to.equal(true);
        head.detach();
        expect(head.attached()).to.equal(false);
        head.attach();
        expect(head.attached()).to.equal(true);
    });

    it("can't be attached/detached when already in that state", function() {
        var head = new RoboHydraWebSocketHead({path: '/', handler: function() {}});
        expect(function() {
            head.attach();
        }).to.throw(InvalidRoboHydraHeadStateException);
        expect(head.attached()).to.equal(true);
        head.detach();
        expect(head.attached()).to.equal(false);
        expect(function() {
            head.detach();
        }).to.throw(InvalidRoboHydraHeadStateException);
        expect(head.attached()).to.equal(false);
    });

    it("never dispatch any paths when detached", function() {
        var headStatic = new RoboHydraWebSocketHead({detached: true, path: '/foo.*',
                                                     handler: function() {}});
        var headDynamic = new RoboHydraWebSocketHead({path: '/foo.*',
                                                      handler: function() {}});
        headDynamic.detach();

        var reqs = [simpleWsReq('/foo'), simpleWsReq('/foo/bar')];
        [headStatic, headDynamic].forEach(function(head) {
            expect(head).not.to.handle(simpleWsReq('/'));
            reqs.forEach(function(path) {
                expect(head).not.to.handle(path);
            });
            head.attach();
            expect(head).not.to.handle(simpleWsReq('/'));
            reqs.forEach(function(path) {
                expect(head).to.handle(path);
            });
        });
    });

    it("know which static paths they can dispatch", function() {
        var validPaths = ['/foo/ba', '/foo/b/',
                          '/foo/baaaa', '/foo/baa?param=value'];
        var invalidPaths = ['/foo/bar', '/foo/'];

        var head = new RoboHydraWebSocketHead({path: '/foo/ba*', handler: function() {}});
        validPaths.forEach(function(path) {
            expect(head).to.handle(simpleWsReq(path));
        });
        invalidPaths.forEach(function(path) {
            expect(head).not.to.handle(simpleWsReq(path));
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
            expect(head).to.handle(simpleWsReq(path));
        });
        invalidPaths.forEach(function(path) {
            expect(head).not.to.handle(simpleWsReq(path));
        });
    });

    it("dispatch heads only if they match the hostname", function() {
        var handler = function(req, res) { res.end(); };
        var head = new RoboHydraWebSocketHead({path: '/.*',
                                               hostname: 'example.com',
                                               handler: handler});

        expect(head).to.handle(new Request({
            url: '/',
            upgrade: true,
            headers: {host: 'example.com',
                      upgrade: 'websocket'}
        }));
        expect(head).not.to.handle(new Request({
            url: '/',
            upgrade: true,
            headers: {host: 'localhost',
                      upgrade: 'websocket'}
        }));
    });

    it("dispatch treats hostname as regex", function() {
        var handler = function(req, res) { res.end(); };
        var head = new RoboHydraWebSocketHead({path: '/.*',
                                               hostname: 'local.*',
                                               handler: handler});

        expect(head).not.to.handle(new Request({
            url: '/',
            upgrade: true,
            headers: {host: 'example.com', upgrade: 'websocket'}
        }));
        expect(head).not.to.handle(new Request({
            url: '/',
            upgrade: true,
            headers: {host: 'www.local', upgrade: 'websocket'}
        }));
        expect(head).to.handle(new Request({
            url: '/',
            upgrade: true,
            headers: {host: 'localhost', upgrade: 'websocket'}
        }));
        expect(head).to.handle(new Request({
            url: '/',
            upgrade: true,
            headers: {host: 'localserver', upgrade: 'websocket'}
        }));
    });

    it("dispatch ignores port when matching hostname", function() {
        var handler = function(req, res) { res.end(); };
        var head = new RoboHydraWebSocketHead({path: '/.*',
                                               hostname: 'example.com',
                                               handler: handler});

        expect(head).to.handle(new Request({
            url: '/',
            upgrade: true,
            headers: {host: 'example.com:3000',
                      upgrade: 'websocket'}
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

        head.handle(simpleWsReq('/article/show/123'));
        expect(controller).to.equal('article');
        expect(action).to.equal('show');
        expect(id).to.equal('123');

        head.handle(simpleWsReq('/page/edit/456/'));
        expect(controller).to.equal('page');
        expect(action).to.equal('edit');
        expect(id).to.equal('456');

        head.handle(simpleWsReq('/widget/search/term?page=2'));
        expect(controller).to.equal('widget');
        expect(action).to.equal('search');
        expect(id).to.equal('term');
    });
});

describe("RoboHydraWebSocketProxy heads", function() {
    "use strict";

    it("proxy connections", function(done) {
        var head = new RoboHydraWebSocketHeadProxy({
            mountPath: '/foo/',
            proxyTo: 'ws://example.com/bar',
            webSocketConstructor: function(url) {
                this.on = function() {};
                expect(url).to.equal('ws://example.com/bar/qux');
                done();
            }
        });

        head.handle(simpleWsReq('/foo/qux'), {on: function() {},
                                              close: function() {}});
    });

    it("send data to the final server", function(done) {
        var expectedMessage = "Test WebSocket message";
        var head = new RoboHydraWebSocketHeadProxy({
            proxyTo: 'ws://example.com',
            webSocketConstructor: function() {
                this.on = function(eventName, f) {
                    if (eventName === 'open') { f(); }
                };
                this.send = function(msg) {
                    expect(msg).to.equal(expectedMessage);
                    done();
                };
            }
        });

        head.handle(simpleWsReq('/foo/qux'), {
            on: function(event, f) {
                if (event === 'message') {
                    f(expectedMessage);
                }
            },
            close: function() {}
        });
    });

    it("brings data back from the final server", function(done) {
        var expectedMessage = "Test WebSocket message";
        var head = new RoboHydraWebSocketHeadProxy({
            proxyTo: 'ws://example.com',
            webSocketConstructor: function() {
                this.on = function(event, f) {
                    if (event === 'message') {
                        f(expectedMessage);
                    }
                };
                this.send = function() {};
            }
        });

        head.handle(simpleWsReq('/foo/qux'), {
            on: function() {},
            send: function(msg) {
                expect(msg).to.equal(expectedMessage);
                done();
            },
            close: function() {}
        });
    });

    it("close the socket when the final server closes", function(done) {
        var head = new RoboHydraWebSocketHeadProxy({
            proxyTo: 'ws://example.com',
            webSocketConstructor: function() {
                this.on = function(event, f) {
                    if (event === 'close') {
                        f();
                    }
                };
                this.send = function() {};
            }
        });

        head.handle(simpleWsReq('/foo/qux'), {
            on: function() {},
            send: function() {},
            close: function() {
                expect(true).to.equal(true);
                done();
            }
        });
    });

    it("close the final server socket when the client closes", function(done) {
        var head = new RoboHydraWebSocketHeadProxy({
            proxyTo: 'ws://example.com',
            webSocketConstructor: function() {
                this.on = function() {};
                this.close = function() {
                    expect(true).to.equal(true);
                    done();
                };
            }
        });

        head.handle(simpleWsReq('/foo/qux'), {
            on: function(event, f) {
                if (event === 'close') {
                    f();
                }
            },
            close: function() {}
        });
    });

    it("can change the data before it's sent to the final server", function(done) {
        var message = "Original message",
            appendedBit = " (edited)";
        var head = new RoboHydraWebSocketHeadProxy({
            proxyTo: 'ws://example.com',
            preProcessor: function(msg) {
                return msg + appendedBit;
            },
            webSocketConstructor: function() {
                this.on = function(eventName, f) {
                    if (eventName === 'open') { f(); }
                };
                this.send = function(msg) {
                    expect(msg).to.equal(message + appendedBit);
                    done();
                };
                this.close = function() {};
            }
        });

        head.handle(simpleWsReq('/foo/qux'), {
            on: function(event, f) {
                if (event === 'message') {
                    f(message);
                }
            },
            close: function() {}
        });
    });

    it("can change the data before it's returned from the final server", function(done) {
        var message = "Original message",
            appendedBit = " (edited)";
        var head = new RoboHydraWebSocketHeadProxy({
            proxyTo: 'ws://example.com',
            postProcessor: function(msg) {
                return msg + appendedBit;
            },
            webSocketConstructor: function() {
                this.on = function(event, f) {
                    if (event === 'message') {
                        f(message);
                    }
                };
                this.send = function() {};
                this.close = function() {};
            }
        });

        head.handle(simpleWsReq('/foo/qux'), {
            on: function() {},
            send: function(msg) {
                expect(msg).to.equal(message + appendedBit);
                done();
            },
            close: function() {}
        });
    });

    it("sends data to the final server when processors return nothing", function(done) {
        var message = "Original message";
        var head = new RoboHydraWebSocketHeadProxy({
            proxyTo: 'ws://example.com',
            preProcessor: function() {
                return;
            },
            webSocketConstructor: function() {
                this.on = function(eventName, f) {
                    if (eventName === 'open') { f(); }
                };
                this.send = function(msg) {
                    expect(msg).to.equal(message);
                    done();
                };
                this.close = function() {};
            }
        });

        head.handle(simpleWsReq('/foo/qux'), {
            on: function(event, f) {
                if (event === 'message') {
                    f(message);
                }
            },
            close: function() {}
        });
    });

    it("sends data to the final server when processors return nothing", function(done) {
        var message = "Original message";
        var head = new RoboHydraWebSocketHeadProxy({
            proxyTo: 'ws://example.com',
            postProcessor: function(msg) {
                return msg;
            },
            webSocketConstructor: function() {
                this.on = function(event, f) {
                    if (event === 'message') {
                        f(message);
                    }
                };
                this.send = function() {};
                this.close = function() {};
            }
        });

        head.handle(simpleWsReq('/foo/qux'), {
            on: function() {},
            send: function(msg) {
                expect(msg).to.equal(message);
                done();
            },
            close: function() {}
        });
    });

    it("can prevent the data from being sent to the final server", function(done) {
        var head = new RoboHydraWebSocketHeadProxy({
            proxyTo: 'ws://example.com',
            preProcessor: function() {
                // This means ignoring the data
                return false;
            },
            webSocketConstructor: function() {
                this.on = function(eventName, f) {
                    if (eventName === 'open') { f(); }
                };
                this.send = function() {
                    expect(true).to.equal(false);
                };
                this.close = function() {
                    expect(true).to.equal(true);
                    done();
                };
            }
        });

        head.handle(simpleWsReq('/foo/qux'), {
            on: function(event, f) {
                switch (event) {
                case 'message':
                    f("Something");
                    break;
                case 'close':
                    f();
                }
            },
            send: function() {},
            close: function() {}
        });
    });

    it("can prevent the data from being received by the client", function(done) {
        var head = new RoboHydraWebSocketHeadProxy({
            proxyTo: 'ws://example.com',
            postProcessor: function() {
                // This means ignoring the data
                return false;
            },
            webSocketConstructor: function() {
                this.on = function(event, f) {
                    if (event === 'message') {
                        f("Some message");
                    }
                };
                this.send = function() {};
                this.close = function() {
                    expect(true).to.equal(true);
                    done();
                };
            }
        });

        head.handle(simpleWsReq('/foo/qux'), {
            on: function(event, f) {
                if (event === 'close') {
                    f();
                }
            },
            send: function() {
                expect(true).to.equal(false);
            },
            close: function() {}
        });
    });
});
