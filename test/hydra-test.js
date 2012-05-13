/*global require, describe, it, expect, JSON*/
var buster = require("buster");
var sinon = require("sinon");
var fs = require("fs");
var hydra    = require("../lib/hydra"),
    Hydra    = hydra.Hydra,
    Response = hydra.Response;
var HydraHeadStatic = require("../lib/hydraHead").HydraHeadStatic,
    HydraHead       = require("../lib/hydraHead").HydraHead;
var helpers              = require("./helpers"),
    fakeReq              = helpers.fakeReq,
    headWithFail = helpers.headWithFail,
    headWithPass = helpers.headWithPass;

buster.spec.expose();

buster.assertions.add("hasHeadAttached", {
    assert: function (actual, pluginName, headName) {
        var head = actual.findHead(pluginName, headName);
        if (head) {
            return head.attached();
        } else {
            throw new Error("Head " + pluginName + "/" + headName +
                            " didn't even exist!");
        }
    },
    assertMessage: "Expected ${0} to have a head '${1}/${2}' attached!",
    refuteMessage: "Expected ${0} to have a head '${1}/${2}' detached!",
    expectation: "toHaveHeadAttached"
});

buster.assertions.add("isAHydraHead", {
    assert: function (actual) {
        return typeof(actual.attach) === 'function';
    },
    assertMessage: "Expected ${0} to be a hydra head!",
    refuteMessage: "Expected ${0} to not be a hydra head!",
    expectation: "toBeAHydraHead"
});

buster.assertions.add("hasPluginList", {
    assert: function (actual, expectedPluginList) {
        var list = this.actualPluginList = actual.getPluginNames();
        this.countSpecialPlugins = !!arguments[2];
        if (! this.countSpecialPlugins) {
            list = list.filter(function(p) { return p.indexOf("*") === -1 });
        }
        return buster.assertions.deepEqual(list, expectedPluginList);
    },
    assertMessage: "Expected plugin list (counting hydra-admin: ${countHydraAdmin}) to be ${1} (was ${actualPluginList})!",
    refuteMessage: "Expected plugin list (counting hydra-admin: ${countHydraAdmin}) to not be ${1}!",
    expectation: "toHavePluginList"
});

buster.assertions.add("hasPluginWithHeadcount", {
    assert: function (actual, pluginName, expectedHeadcount) {
        return actual.getPlugin(pluginName).heads.length === expectedHeadcount;
    },
    assertMessage: "Expected hydra to have headcount ${2} in plugin ${1}!",
    refuteMessage: "Expected hydra to not have headcount ${2} in plugin ${1}!",
    expectation: "toHavePluginWithHeadcount"
});

function simpleHydraHead(path, content, name) {
    var props = {path:    path    || '/.*',
                 content: content || 'foo'};
    if (name) props.name = name;
    return new HydraHeadStatic(props);
}

describe("Hydras", function() {
    it("can be created", function() {
        expect(new Hydra()).toBeDefined();
    });

    it("can't register plugins without heads or tests", function() {
        var hydra = new Hydra();
        expect(function() {
            hydra.registerPluginObject({heads: []});
        }).toThrow("InvalidHydraPluginException");
    });

    it("can't register plugins without name", function() {
        var hydra = new Hydra();
        expect(function() {
            hydra.registerPluginObject({heads: [new HydraHeadStatic({content: 'foo'})]});
        }).toThrow("InvalidHydraPluginException");
    });

    it("can't register plugins with invalid names", function() {
        var hydra = new Hydra();
        var heads = [simpleHydraHead()];

        ['', ' ', '..', 'foo.bar', 'foo/bar'].forEach(function(v) {
            expect(function() {
                hydra.registerPluginObject({name: v,
                                            heads: heads});
            }).toThrow("InvalidHydraPluginException");
        });
    });

    it("can register plugins with one head", function() {
        var hydra = new Hydra();
        hydra.registerPluginObject({name: 'simple_plugin',
                                    heads: [simpleHydraHead()]});
        expect(hydra).toHavePluginList(['simple_plugin']);
        expect(hydra).toHavePluginWithHeadcount('simple_plugin', 1);
    });

    it("can register plugins with one test", function() {
        var hydra = new Hydra();
        hydra.registerPluginObject({name: 'simple_plugin',
                                    tests: {simpleTest:{}}});
        expect(hydra).toHavePluginList(['simple_plugin']);
    });

    it("can't register two plugins with the same name", function() {
        var hydra = new Hydra();
        var plugin1 = {name: 'simple_plugin',
                       heads: [simpleHydraHead('/', 'foo')]};
        var plugin2 = {name: 'simple_plugin',
                       heads: [simpleHydraHead('/.*', 'bar')]};
        hydra.registerPluginObject(plugin1);
        expect(hydra).toHavePluginList(['simple_plugin']);
        expect(hydra).toHavePluginWithHeadcount('simple_plugin', 1);
        expect(function() {
            hydra.registerPluginObject(plugin2);
        }).toThrow("DuplicateHydraPluginException");
    });

    it("can register several plugins", function() {
        var hydra = new Hydra();
        var plugin1 = {name: 'plugin1',
                       heads: [simpleHydraHead('/hydra-admin',
                                               'Hydra Admin UI')]};
        var plugin2 = {name: 'plugin2',
                       heads: [simpleHydraHead('/.*', 'Not Found')]};
        hydra.registerPluginObject(plugin1);
        expect(hydra).toHavePluginList(['plugin1']);
        expect(hydra).toHavePluginWithHeadcount('plugin1', 1);
        hydra.registerPluginObject(plugin2);
        expect(hydra).toHavePluginList(['plugin1', 'plugin2']);
        expect(hydra).toHavePluginWithHeadcount('plugin1', 1);
        expect(hydra).toHavePluginWithHeadcount('plugin2', 1);
    });

    it("can get a plugin by name", function() {
        var hydra = new Hydra();
        var plugin1 = {name: 'plugin1',
                       heads: [simpleHydraHead('/.*', 'Not Found')]};
        hydra.registerPluginObject(plugin1);
        var p = hydra.getPlugin('plugin1');
        expect(p.name).toEqual('plugin1');
    });

    it("throw an exception when getting a non-existent plugin by name", function() {
        var hydra = new Hydra();
        var plugin1 = {name: 'plugin1',
                       heads: [simpleHydraHead('/.*', 'Not Found')]};
        hydra.registerPluginObject(plugin1);
        expect(function() {
            hydra.getPlugin("plugin11");
        }).toThrow("HydraPluginNotFoundException");
    });

    it("fail when loading non-existent plugins", function() {
        var hydra = new Hydra();
        expect(function() {
            hydra.requirePlugin('i-dont-exist',
                                {},
                                {rootDir: __dirname + '/plugin-fs'});
        }).toThrow('HydraPluginNotFoundException');
    });

    it("can load a simple plugin", function() {
        var configKeyValue = 'config value';
        var hydra = new Hydra();
        var rootDir = __dirname + '/plugin-fs';
        var plugin = hydra.requirePlugin('simple',
                                         {configKey: configKeyValue},
                                         {rootDir: rootDir});
        expect(plugin.module.testProperty).toEqual('testValue');
        expect(plugin.module.getBodyParts).toBeFunction();
        expect(plugin.config).toEqual({path: rootDir + '/usr/share/hydra/plugins/simple',
                                       hydra: hydra,
                                       configKey: configKeyValue});
    });

    it("loads plugins in the right order of preference", function() {
        var hydra = new Hydra();
        var rootDir = __dirname + '/plugin-fs';
        var plugin = hydra.requirePlugin('definedtwice',
                                         {},
                                         {rootDir: rootDir});
        expect(plugin.module.testProperty).toEqual('/usr/local version');
        expect(plugin.config).toEqual({path: rootDir + '/usr/local/share/hydra/plugins/definedtwice',
                                       hydra: hydra});
    });

    it("can define own load path, and takes precedence", function() {
        var hydra = new Hydra();
        hydra.addPluginLoadPath('/opt/hydra/plugins');
        var rootDir = __dirname + '/plugin-fs';
        var plugin = hydra.requirePlugin('definedtwice',
                                         {},
                                         {rootDir: rootDir});
        expect(plugin.module.testProperty).toEqual('/opt version');
        expect(plugin.config).toEqual({path: rootDir + '/opt/hydra/plugins/definedtwice',
                                       hydra: hydra});
    });

    it("can define more than one load path, latest has precedence", function() {
        var hydra = new Hydra();
        hydra.addPluginLoadPath('/opt/hydra/plugins');
        hydra.addPluginLoadPath('/opt/project/hydra-plugins');

        var rootDir = __dirname + '/plugin-fs';
        var plugin = hydra.requirePlugin('definedtwice',
                                         {},
                                         {rootDir: rootDir});
        expect(plugin.module.testProperty).toEqual('/opt/project version');
        expect(plugin.config).toEqual({path: rootDir + '/opt/project/hydra-plugins/definedtwice',
                                       hydra: hydra});
    });

    it("can define more than one load path, first is still valid", function() {
        var hydra = new Hydra();
        hydra.addPluginLoadPath('/opt/hydra/plugins');
        hydra.addPluginLoadPath('/opt/project/hydra-plugins');
        var rootDir = __dirname + '/plugin-fs';
        var plugin = hydra.requirePlugin('customloadpath',
                                         {},
                                         {rootDir: rootDir});
        expect(plugin.module.testProperty).toEqual('custom plugin in /opt');
        expect(plugin.config).toEqual({path: rootDir + '/opt/hydra/plugins/customloadpath',
                                       hydra: hydra});
    });

    it("consider all paths 404 when there are no plugins", function() {
        var hydra = new Hydra();
        hydra.handle(fakeReq('/'),
                     new Response(function() {
                         expect(this.statusCode).toEqual(404);
                         expect(this.body).toEqual('Not Found');
                     }));
    });

    it("can dispatch a single, catch-all path", function() {
        var hydra = new Hydra();
        var content = 'It works!';
        var heads = [simpleHydraHead('/.*', content)];
        hydra.registerPluginObject({name: 'plugin1', heads: heads});
        hydra.handle(fakeReq('/'),
                     new Response(function() {
                         expect(this.statusCode).toEqual(200);
                         expect(this.body).toEqual(content);
                     }));
    });

    it("traverse heads in order when dispatching", function() {
        var hydra = new Hydra();
        var content = 'It works!';
        var heads = [simpleHydraHead('/', content),
                     simpleHydraHead('/.*', 'Fail!')];
        hydra.registerPluginObject({name: 'plugin1', heads: heads});
        hydra.handle(fakeReq('/'),
                     new Response(function() {
                         expect(this.statusCode).toEqual(200);
                         expect(this.body).toEqual(content);
                     }));
    });

    it("deliver 404 when there are routes, but none match", function() {
        var hydra = new Hydra();
        var heads = [simpleHydraHead('/foo'), simpleHydraHead('/bar')];
        hydra.registerPluginObject({name: 'plugin1', heads: heads});
        ['/', '/qux', '/foobar', '/foo/bar'].forEach(function(path) {
            hydra.handle(fakeReq(path),
                         new Response(function() {
                             expect(this.statusCode).toEqual(404);
                         }));
        });
    });

    it("respond correctly with a 404 when no routes match", function(done) {
        var hydra = new Hydra();
        var heads = [simpleHydraHead('/foo')];
        hydra.registerPluginObject({name: 'plugin1', heads: heads});
        hydra.handle(fakeReq('/'), new Response(function() {
                                       expect(this.statusCode).toEqual(404);
                                       done();
                                   }));
    });

    it("don't allow registering a plugin with duplicate head names", function() {
        var hydra = new Hydra();
        var heads = [simpleHydraHead('/foo', 'dummy name', 'name'),
                     simpleHydraHead('/bar', 'dummy name', 'name')];
        expect(function() {
            hydra.registerPluginObject({name: 'plugin1', heads: heads});
        }).toThrow("DuplicateHydraHeadNameException");
        expect(hydra).toHavePluginList([]);
    });

    it("allow registering different plugins with common head names", function() {
        var hydra = new Hydra();
        var headsPlugin1 = [simpleHydraHead('/foo', 'content', 'head1'),
                            simpleHydraHead('/bar', 'content', 'head2')];
        var headsPlugin2 = [simpleHydraHead('/foo', 'content', 'head1'),
                            simpleHydraHead('/bar', 'content', 'head2')];
        hydra.registerPluginObject({name: 'plugin1', heads: headsPlugin1});
        hydra.registerPluginObject({name: 'plugin2', heads: headsPlugin2});
        expect(hydra).toHavePluginList(['plugin1', 'plugin2']);
        expect(hydra).toHavePluginWithHeadcount('plugin1', 2);
        expect(hydra).toHavePluginWithHeadcount('plugin2', 2);
    });

    it("find existing heads", function() {
        var hydra = new Hydra();
        var heads = [simpleHydraHead('/foo', 'foo path',  'head1'),
                     simpleHydraHead('/.*',  'catch-all', 'head2')];
        hydra.registerPluginObject({name: 'plugin', heads: heads});

        expect(hydra.findHead('plugin', 'head1').name).toEqual('head1');
        expect(hydra.findHead('plugin', 'head2').name).toEqual('head2');
    });

    it("throw an error when finding non-existing heads", function() {
        var hydra = new Hydra();
        var heads = [simpleHydraHead('/foo', 'foo path',  'head1'),
                     simpleHydraHead('/.*',  'catch-all', 'head2')];
        hydra.registerPluginObject({name: 'plugin', heads: heads});

        expect(function() {
            hydra.findHead('plugin1', 'head1');
        }).toThrow("HydraHeadNotFoundException");
        expect(function() {
            hydra.findHead('plugin', 'head3');
        }).toThrow("HydraHeadNotFoundException");
        expect(function() {
            hydra.findHead('plugin', 'head22');
        }).toThrow("HydraHeadNotFoundException");
        expect(function() {
            hydra.findHead('_plugin', 'head2');
        }).toThrow("HydraHeadNotFoundException");
    });

    it("allow attaching and detaching heads", function() {
        var hydra = new Hydra();
        var heads = [simpleHydraHead('/foo', 'foo path', 'head1')];
        hydra.registerPluginObject({name: 'plugin', heads: heads});

        hydra.detachHead('plugin', 'head1');
        expect(hydra).not.toHaveHeadAttached('plugin', 'head1');
        hydra.attachHead('plugin', 'head1');
        expect(hydra).toHaveHeadAttached('plugin', 'head1');
    });

    it("throw an error when attaching/detaching non-existing heads", function() {
        var hydra = new Hydra();
        var heads = [simpleHydraHead('/foo', 'foo path', 'head1')];
        hydra.registerPluginObject({name: 'plugin', heads: heads});

        expect(function() {
            hydra.detachHead('plugin', 'head2');
        }).toThrow("HydraHeadNotFoundException");
        expect(function() {
            hydra.detachHead('plugin2', 'head1');
        }).toThrow("HydraHeadNotFoundException");
        expect(function() {
            hydra.detachHead('_plugin', 'head1');
        }).toThrow("HydraHeadNotFoundException");
    });

    it("throw an error when attaching/detaching already attached/detached heads", function() {
        var hydra = new Hydra();
        var heads = [simpleHydraHead('/foo', 'foo path', 'head1')];
        hydra.registerPluginObject({name: 'plugin', heads: heads});

        expect(function() {
            hydra.attachHead('plugin', 'head1');
        }).toThrow("InvalidHydraHeadStateException");
        hydra.detachHead('plugin', 'head1');
        expect(function() {
            hydra.detachHead('plugin', 'head1');
        }).toThrow("InvalidHydraHeadStateException");
    });

    it("skips detached heads when dispatching", function(done) {
        var hydra = new Hydra();
        var path = '/foo';
        var heads = [simpleHydraHead(path,   'foo path', 'head1'),
                     simpleHydraHead('/.*',  'catch-all', 'head2')];
        hydra.registerPluginObject({name: 'plugin', heads: heads});
        hydra.handle(fakeReq(path), new Response(function() {
            expect(this.statusCode).toEqual(200);
            expect(this.body).toEqual('foo path');

            hydra.detachHead('plugin', 'head1');
            hydra.handle(fakeReq(path), new Response(function() {
                expect(this.statusCode).toEqual(200);
                expect(this.body).toEqual('catch-all');

                hydra.attachHead('plugin', 'head1');
                hydra.handle(fakeReq(path), new Response(function() {
                    expect(this.statusCode).toEqual(200);
                    expect(this.body).toEqual('foo path');
                    done();
                }));
            }));
        }));
    });

    it("can create additional heads dynamically", function(done) {
        var hydra = new Hydra();
        var path = '/foo';

        hydra.registerDynamicHead(simpleHydraHead(path, 'some content'));
        expect(hydra).toHavePluginWithHeadcount('*dynamic*', 1);

        hydra.handle(fakeReq(path), new Response(function() {
            expect(this.body).toEqual('some content');
            done();
        }));
    });

    it("can register several dynamic heads", function(done) {
        var hydra = new Hydra();
        var path1    = '/foo',         path2    = '/bar';
        var content1 = 'some content', content2 = 'another content';

        hydra.registerDynamicHead(simpleHydraHead(path1, content1));
        hydra.registerDynamicHead(simpleHydraHead(path2, content2));

        hydra.handle(fakeReq(path1), new Response(function() {
            expect(this.body).toEqual(content1);
            hydra.handle(fakeReq(path2), new Response(function() {
                expect(this.body).toEqual(content2);
                done();
            }));
        }));
    });

    it("can find dynamic heads", function() {
        var hydra = new Hydra();
        var path = '/foo', content = 'some content', name = 'head1';

        hydra.registerDynamicHead(simpleHydraHead(path, content, name));
        var dynamicHead = hydra.findHead('*dynamic*', name);
        expect(dynamicHead).toBeDefined();
    });

    it("can detach dynamic heads", function(done) {
        var hydra = new Hydra();
        var path = '/foo', content = 'some content', name = 'head1';

        hydra.registerDynamicHead(simpleHydraHead(path, content, name));

        hydra.handle(fakeReq(path), new Response(function() {
            expect(this.body).toEqual(content);

            hydra.detachHead('*dynamic*', name);
            hydra.handle(fakeReq(path), new Response(function() {
                expect(this.statusCode).toEqual(404);
                done();
            }));
        }));
    });

    it("can detach one dynamic head and leave the rest working", function(done) {
        var hydra = new Hydra();
        var path1 = '/foo', content1 = 'some content',  name1 = 'head1';
        var path2 = '/bar', name2 = 'head2';

        hydra.registerDynamicHead(simpleHydraHead(path1, content1,   name1));
        hydra.registerDynamicHead(simpleHydraHead(path2, 'whatever', name2));
        hydra.detachHead('*dynamic*', name2);

        hydra.handle(fakeReq(path1), new Response(function() {
            expect(this.body).toEqual(content1);
            done();
        }));
    });

    it("assign different names to unnamed dynamic heads", function() {
        var hydra = new Hydra();
        hydra.registerDynamicHead(simpleHydraHead());
        hydra.registerDynamicHead(simpleHydraHead());

        var dynamicHeads = hydra.getPlugin('*dynamic*').heads;
        expect(dynamicHeads[0].name).not.toEqual(dynamicHeads[1].name);
    });

    it("can chain a request with two heads", function(done) {
        var hydra = new Hydra();
        var resultList = [];
        var headCallingNext = new HydraHead({
            path: '/foo',
            handler: function(req, res, next) {
                resultList.push('headCallingNext');
                next(req, res);
            }});
        var headBeingCalled = new HydraHead({
            path: '/.*',
            handler: function(req, res) {
                resultList.push('headBeingCalled');
                res.end();
            }});
        hydra.registerPluginObject({name: 'plugin',
                                    heads: [headCallingNext,
                                            headBeingCalled]});
        hydra.handle(fakeReq('/foo'), new Response(function() {
            expect(resultList).toEqual(['headCallingNext', 'headBeingCalled']);
            done();
        }));
    });

    it("can chain a request with more than two heads", function(done) {
        var hydra = new Hydra();
        var resultList = [];
        var headCallingNext = new HydraHead({
            name: 'callingNext',
            path: '/foo',
            handler: function(req, res, next) {
                resultList.push('headCallingNext');
                next(req, res);
            }});
        var headBeingCalled = new HydraHead({
            name: 'beingCalled',
            path: '/.*',
            handler: function(req, res, next) {
                resultList.push('headBeingCalled');
                next(req, res);
            }});
        var headBeingCalledLast = new HydraHead({
            name: 'beingCalledLast',
            path: '/f.*',
            handler: function(req, res) {
                resultList.push('headBeingCalledLast');
                res.end();
            }});
        hydra.registerPluginObject({name: 'plugin',
                                    heads: [headCallingNext,
                                            headBeingCalled,
                                            headBeingCalledLast]});
        hydra.handle(fakeReq('/foo'), new Response(function() {
            expect(resultList).toEqual(['headCallingNext',
                                        'headBeingCalled',
                                        'headBeingCalledLast']);
            done();
        }));
    });

    it("can chain a request that doesn't match any more heads", function(done) {
        var hydra = new Hydra();
        var finalRes;
        var headCallingNext = new HydraHead({
            path: '/foo',
            handler: function(req, res, next) {
                next(req, new Response(function() {
                              finalRes = this;
                              res.end();
                          }));
            }});
        hydra.registerPluginObject({name: 'plugin', heads: [headCallingNext]});
        hydra.handle(fakeReq('/foo'), new Response(function() {
            expect(finalRes.statusCode).toEqual(404);
            done();
        }));
    });

    it("throw an exception if the 'next' function is called without parameters", function() {
        var hydra = new Hydra();
        var finalRes;
        var headCallingNext = new HydraHead({
            path: '/foo',
            handler: function(req, res, next) {
                // http://bit.ly/KkdH81
                next();
            }});
        hydra.registerDynamicHead(headCallingNext);
        expect(function() {
            hydra.handle(fakeReq('/foo'),
                         new Response(function() {}));
        }).toThrow("InvalidHydraNextParameters");
    });
});

describe("Hydra test system", function() {
    it("has '*default*' as the default test", function() {
        var hydra = new Hydra();
        expect(hydra.currentTest).toEqual({plugin: '*default*',
                                           test:   '*default*'});
    });

    it("can start tests", function() {
        var hydra = new Hydra();
        hydra.registerPluginObject({name: 'plugin',
                                    tests: {
                                        simpleTest: {
                                            heads: [simpleHydraHead()]
                                        }
                                    }});
        hydra.startTest('plugin', 'simpleTest');
        expect(hydra.currentTest).toEqual({plugin: 'plugin',
                                           test: 'simpleTest'});
    });

    it("throws an exception when starting non-existent tests", function() {
        var hydra = new Hydra();
        expect(function() {
            hydra.startTest('plugin', 'simpleTest');
        }).toThrow("InvalidHydraTestException");
    });

    it("can stop tests", function() {
        var hydra = new Hydra();
        hydra.registerPluginObject({name: 'plugin',
                                    tests: {
                                        simpleTest: {
                                            heads: [simpleHydraHead()]
                                        }
                                    }});
        hydra.startTest('plugin', 'simpleTest');
        hydra.stopTest();
        expect(hydra.currentTest).toEqual({plugin: '*default*',
                                           test:   '*default*'});
    });

    it("stops the previous test when starting a new one", function() {
        var hydra = new Hydra();
        hydra.registerPluginObject({name: 'plugin',
                                    tests: {
                                        simpleTest: {
                                            heads: [simpleHydraHead()]
                                        }
                                    }});
        hydra.registerPluginObject({name: 'plugin2',
                                    tests: {
                                        anotherSimpleTest: {
                                            heads: [simpleHydraHead()]
                                        }
                                    }});
        hydra.startTest('plugin', 'simpleTest');
        hydra.startTest('plugin2', 'anotherSimpleTest');
        expect(hydra.currentTest).toEqual({plugin: 'plugin2',
                                           test:   'anotherSimpleTest'});
    });

    it("doesn't activate test heads if no test is active", function(done) {
        var hydra = new Hydra();
        var path  = '/foo';
        hydra.registerPluginObject({name: 'plugin',
                                    tests: {
                                        simpleTest: {
                                            heads: [simpleHydraHead(path)]
                                        }
                                    }});
        hydra.handle(fakeReq(path), new Response(function() {
            expect(this.statusCode).toEqual(404);
            done();
        }));
    });

    it("activates test heads when test is active", function(done) {
        var hydra = new Hydra();
        var path = '/foo';
        var testHeads = [simpleHydraHead(path)];
        hydra.registerPluginObject({name: 'plugin',
                                    tests: {
                                        someTest: {
                                            heads: testHeads
                                        }
                                    }});
        hydra.startTest('plugin', 'someTest');
        hydra.handle(fakeReq(path), new Response(function() {
            expect(this.statusCode).toEqual(200);
            done();
        }));
    });

    it("deactivates test heads when a test is stopped", function(done) {
        var hydra = new Hydra();
        var path = '/foo';
        hydra.registerPluginObject({name: 'plugin',
                                    tests: {
                                        someTest: {
                                            heads: [simpleHydraHead(path)]
                                        }
                                    }});
        hydra.startTest('plugin', 'someTest');
        hydra.stopTest();
        hydra.handle(fakeReq(path), new Response(function() {
            expect(this.statusCode).toEqual(404);
            done();
        }));
    });

    it("deactivates test heads when a new test is started", function(done) {
        var hydra = new Hydra();
        var path = '/foo', path2 = '/bar';
        hydra.registerPluginObject({name: 'plugin',
                                    tests: {
                                        someTest: {
                                            heads: [simpleHydraHead(path)]
                                        },
                                        anotherTest: {
                                            heads: [simpleHydraHead(path2)]
                                        }
                                    }});
        hydra.startTest('plugin', 'someTest');
        hydra.startTest('plugin', 'anotherTest');
        var res = new Response(function() {
                      expect(res.statusCode).toEqual(404);

                      var res2 = new Response(function() {
                                     expect(res2.statusCode).toEqual(200);
                                     done();
                                 });
                      hydra.handle({url: path2}, res2);
                  });
        hydra.handle(fakeReq(path), res);
    });

    it("has an empty result when starting a test", function() {
        var hydra = new Hydra();
        hydra.registerPluginObject({
            name: 'plugin',
            tests: { testWithAssertion: {heads: [
                headWithFail('/f', hydra.getUtilsObject(), "some message")
            ]}}});
        hydra.startTest('plugin', 'testWithAssertion');
        expect(hydra).toHaveTestResult('plugin',
                                       'testWithAssertion',
                                       {result: undefined,
                                        passes: [],
                                        failures: []});
    });

    it("can execute and count a passing assertion", function(done) {
        var assertionMessage = "should do something simple but useful";
        var hydra = new Hydra();
        hydra.registerPluginObject({
            name: 'plugin',
            tests: {
                testWithAssertion: {
                    heads: [headWithPass('/', hydra.getUtilsObject(),
                                         assertionMessage)]
                }
            }});
        hydra.startTest('plugin', 'testWithAssertion');
        hydra.handle(
            fakeReq('/'),
            new Response(function() {
                expect(hydra).toHaveTestResult('plugin', 'testWithAssertion',
                                               {result: 'pass',
                                                passes: [assertionMessage],
                                                failures: []});
                done();
            })
        );
    });

    it("can execute and count a failing assertion", function(done) {
        var hydra = new Hydra();
        var assertionMessage = "should have this and that";
        hydra.registerPluginObject({
            name: 'plugin',
            tests: { testWithAssertion: {
                heads: [headWithFail('/', hydra.getUtilsObject(),
                                     assertionMessage)]
            }}
        });
        hydra.startTest('plugin', 'testWithAssertion');
        hydra.handle(
            fakeReq('/'),
            new Response(function() {
                expect(hydra).toHaveTestResult('plugin',
                                               'testWithAssertion',
                                               {result: 'fail',
                                                passes: [],
                                                failures: [assertionMessage]});
                done();
            })
        );
    });

    it("can save more than one test result", function(done) {
        var hydra = new Hydra();
        var passMessage = "should have this and that (and did)";
        var failMessage = "should have this and that (and didn't)";
        hydra.registerPluginObject({
            name: 'plugin',
            tests: { testWithAssertion: {heads: [
                headWithFail('/f', hydra.getUtilsObject(), failMessage),
                headWithPass('/p', hydra.getUtilsObject(), passMessage)
            ]}}});
        hydra.startTest('plugin', 'testWithAssertion');
        hydra.handle(
            fakeReq('/f'),
            new Response(function() {
                hydra.handle(
                    fakeReq('/p'),
                    new Response(function() {
                        expect(hydra).toHaveTestResult(
                            'plugin',
                            'testWithAssertion',
                            {result: 'fail',
                             passes: [passMessage],
                             failures: [failMessage]}
                        );
                        done();
                    })
                );
            })
        );
    });

    it("resets results after re-starting a test", function(done) {
        var hydra = new Hydra();
        var passMessage = "should have this and that (and did)";
        var failMessage = "should have this and that (and didn't)";
        hydra.registerPluginObject({
            name: 'plugin',
            tests: { testWithAssertion: {heads: [
                headWithFail('/f', hydra.getUtilsObject(), failMessage),
                headWithPass('/p', hydra.getUtilsObject(), passMessage)
            ]}}});
        hydra.startTest('plugin', 'testWithAssertion');
        hydra.handle(
            fakeReq('/f'),
            new Response(function() {
                expect(hydra).toHaveTestResult('plugin',
                                               'testWithAssertion',
                                               {result: 'fail',
                                                passes: [],
                                                failures: [failMessage]});
                hydra.startTest('plugin', 'testWithAssertion');
                expect(hydra).toHaveTestResult('plugin',
                                               'testWithAssertion',
                                               {result: undefined,
                                                passes: [],
                                                failures: []});
                done();
            })
        );
    });

    it("counts assertions without having run tests as *default*", function(done) {
        var hydra = new Hydra();
        var passMessage = "should have this and that (and did)";
        hydra.registerPluginObject({
            name: 'plugin',
            heads: [
                headWithPass('/p', hydra.getUtilsObject(), passMessage)
            ]});
        hydra.handle(
            fakeReq('/p'),
            new Response(function() {
                expect(hydra).toHaveTestResult('*default*',
                                               '*default*',
                                               {result: 'pass',
                                                passes: [passMessage],
                                                failures: []});
                done();
            })
        );
    });

    it("counts assertions after stopping tests as *default*", function(done) {
        var hydra = new Hydra();
        var passMessage = "should have this and that (and did)";
        hydra.registerPluginObject({
            name: 'plugin',
            heads: [
                headWithPass('/p', hydra.getUtilsObject(), passMessage)
            ],
            tests: {testWithAssertion: {heads: []}}});
        hydra.startTest('plugin', 'testWithAssertion');
        hydra.stopTest();
        hydra.handle(
            fakeReq('/p'),
            new Response(function() {
                expect(hydra).toHaveTestResult('*default*',
                                               '*default*',
                                               {result: 'pass',
                                                passes: [passMessage],
                                                failures: []});
                done();
            })
        );
    });

    it("counts assertions in non-test heads as in the current test", function(done) {
        var hydra = new Hydra();
        var passMessage = "should have this and that (and did)";
        hydra.registerPluginObject({
            name: 'plugin',
            heads: [
                headWithPass('/p', hydra.getUtilsObject(), passMessage)
            ],
            tests: {testWithAssertion: {heads: []}}});
        hydra.startTest('plugin', 'testWithAssertion');
        hydra.handle(
            fakeReq('/p'),
            new Response(function() {
                expect(hydra).toHaveTestResult('plugin',
                                               'testWithAssertion',
                                               {result: 'pass',
                                                passes: [passMessage],
                                                failures: []});
                done();
            })
        );
    });

    it("stopping a test doesn't erase previous results", function(done) {
        var hydra = new Hydra();
        var passMessage = "should have this and that (and did)";
        hydra.registerPluginObject({
            name: 'plugin',
            heads: [
                headWithPass('/p', hydra.getUtilsObject(), passMessage)
            ],
            tests: {testWithAssertion: {heads: []}}});
        hydra.startTest('plugin', 'testWithAssertion');
        hydra.handle(
            fakeReq('/p'),
            new Response(function() {
                hydra.stopTest();
                expect(hydra).toHaveTestResult('plugin',
                                               'testWithAssertion',
                                               {result: 'pass',
                                                passes: [passMessage],
                                                failures: []});
                done();
            })
        );
    });

    it("doesn't erase the previous test's results when starting a new one", function(done) {
        var hydra = new Hydra();
        var passMessage = "should have this and that (and did)";
        hydra.registerPluginObject({
            name: 'plugin',
            heads: [
                headWithPass('/p', hydra.getUtilsObject(), passMessage)
            ],
            tests: {testWithAssertion: {heads: []},
                    anotherTest:       {heads: []}}});
        hydra.startTest('plugin', 'testWithAssertion');
        hydra.handle(
            fakeReq('/p'),
            new Response(function() {
                hydra.startTest('plugin', 'anotherTest');
                expect(hydra).toHaveTestResult('plugin',
                                               'testWithAssertion',
                                               {result: 'pass',
                                                passes: [passMessage],
                                                failures: []});
                done();
            })
        );
    });

    it("doesn't run the code after an assertion failure", function(done) {
        var hydra = new Hydra();
        var passMessage = "should have this and that (and did NOT)";
        var executesAfterAssertion = false;
        hydra.registerPluginObject({
            name: 'plugin',
            heads: [
                new HydraHead({
                    path: '/',
                    handler: function(req, res) {
                        hydra.getUtilsObject().assert.equal(0, 1);
                        executesAfterAssertion = true;
                        res.end();
                    }
                })
            ]});
        hydra.handle(
            fakeReq('/'),
            new Response(function() {
                expect(executesAfterAssertion).toBeFalsy();
                done();
            })
        );
    });

    it("does run code after an assertion pass", function(done) {
        var hydra = new Hydra();
        var passMessage = "should have this and that (and did)";
        var executesAfterAssertion = false;
        hydra.registerPluginObject({
            name: 'plugin',
            heads: [
                new HydraHead({
                    path: '/',
                    handler: function(req, res) {
                        hydra.getUtilsObject().assert.equal(1, 1);
                        executesAfterAssertion = true;
                        res.end();
                    }
                })
            ]});
        hydra.handle(
            fakeReq('/'),
            new Response(function() {
                expect(executesAfterAssertion).toBeTruthy();
                done();
            })
        );
    });

    it("gives a default assertion message to those that don't have one", function(done) {
        var hydra = new Hydra();
        hydra.registerPluginObject({
            name: 'plugin',
            tests: {
                testWithAssertion: {heads: [
                    new HydraHead({
                        path: '/',
                        handler: function(req, res) {
                            hydra.getUtilsObject().assert.equal("foo", "bar");
                            res.end();
                        }
                    })
                ]}
            }});
        hydra.startTest('plugin', 'testWithAssertion');
        hydra.handle(
            fakeReq('/'),
            new Response(function() {
                expect(hydra).toHaveTestResult(
                    'plugin',
                    'testWithAssertion',
                    {result: 'fail',
                     passes: [],
                     failures: ["*unnamed-assertion*"]});
                done();
            })
        );
    });

    it("can access a test instructions", function() {
        var hydra = new Hydra();
        var instructions = "Click here, then there";
        hydra.registerPluginObject({
            name: 'plugin',
            tests: {
                testWithInstructions: {
                    heads: [],
                    instructions: instructions
                }
            }});
       expect(hydra.getPlugin('plugin').tests.testWithInstructions.instructions).toEqual(instructions);
    });
});
