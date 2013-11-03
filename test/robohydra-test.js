/*global require, describe, it, expect, before*/

var buster = require("buster");
var path = require("path");
var robohydra = require("../lib/robohydra"),
    RoboHydra = robohydra.RoboHydra,
    Request   = robohydra.Request,
    Response  = robohydra.Response;
var heads               = require("../lib/heads"),
    RoboHydraHeadStatic = heads.RoboHydraHeadStatic,
    RoboHydraHead       = heads.RoboHydraHead;
var helpers              = require("./helpers"),
    simpleReq            = helpers.simpleReq,
    headWithFail         = helpers.headWithFail,
    headWithPass         = helpers.headWithPass,
    pluginInfoObject     = helpers.pluginInfoObject,
    pluginObjectFromPath = helpers.pluginObjectFromPath;

buster.spec.expose();

buster.assertions.add("hasHeadAttached", {
    assert: function (actual, pluginName, headName) {
        "use strict";
        return actual.isHeadAttached(pluginName, headName);
    },
    assertMessage: "Expected ${0} to have a head '${1}/${2}' attached!",
    refuteMessage: "Expected ${0} to have a head '${1}/${2}' detached!",
    expectation: "toHaveHeadAttached"
});

buster.assertions.add("isARoboHydraHead", {
    assert: function (actual) {
        "use strict";
        return typeof(actual.attach) === 'function';
    },
    assertMessage: "Expected ${0} to be a hydra head!",
    refuteMessage: "Expected ${0} to not be a hydra head!",
    expectation: "toBeARoboHydraHead"
});

buster.assertions.add("hasPluginList", {
    assert: function (actual, expectedPluginList) {
        "use strict";
        var list = this.actualPluginList = actual.getPluginNames();
        this.countSpecialPlugins = !!arguments[2];
        if (! this.countSpecialPlugins) {
            list = list.filter(function(p) { return p.indexOf("*") === -1; });
        }
        return buster.assertions.deepEqual(list, expectedPluginList);
    },
    assertMessage: "Expected plugin list (counting hydra-admin: ${countSpecialPlugins}) to be ${1} (was ${actualPluginList})!",
    refuteMessage: "Expected plugin list (counting hydra-admin: ${countSpecialPlugins}) to not be ${1}!",
    expectation: "toHavePluginList"
});

buster.assertions.add("hasPluginWithHeadcount", {
    assert: function (actual, pluginName, expectedHeadcount) {
        "use strict";
        return actual.getPlugin(pluginName).heads.length === expectedHeadcount;
    },
    assertMessage: "Expected hydra to have headcount ${2} in plugin ${1}!",
    refuteMessage: "Expected hydra to not have headcount ${2} in plugin ${1}!",
    expectation: "toHavePluginWithHeadcount"
});

function simpleRoboHydraHead(path, content, name) {
    "use strict";
    var props = {path:    path    || '/.*',
                 content: content || 'foo'};
    if (name) { props.name = name; }
    return new RoboHydraHeadStatic(props);
}

describe("RoboHydras", function() {
    "use strict";

    it("can be created", function() {
        expect(new RoboHydra()).toBeDefined();
    });

    it("can't have unknown/mistyped properties", function() {
        var hydra = new RoboHydra();
        expect(function() {
            hydra.registerPluginObject(pluginInfoObject({
                heds: []
            }));
        }).toThrow("InvalidRoboHydraPluginException");
    });

    it("can't register plugins without name", function() {
        var hydra = new RoboHydra();
        expect(function() {
            hydra.registerPluginObject(pluginInfoObject({
                name: undefined,
                heads: [new RoboHydraHeadStatic({content: 'foo'})]
            }));
        }).toThrow("InvalidRoboHydraPluginException");
    });

    it("can't register plugins with invalid names", function() {
        var hydra = new RoboHydra();
        var heads = [simpleRoboHydraHead()];

        ['', ' ', '..', 'foo.bar', 'foo/bar'].forEach(function(v) {
            expect(function() {
                hydra.registerPluginObject(pluginInfoObject({name: v,
                                                             heads: heads}));
            }).toThrow("InvalidRoboHydraPluginException");
        });
    });

    it("can register plugins with one head", function() {
        var hydra = new RoboHydra();
        hydra.registerPluginObject(pluginInfoObject({
            name: 'simple_plugin',
            heads: [simpleRoboHydraHead()]
        }));
        expect(hydra).toHavePluginList(['simple_plugin']);
        expect(hydra).toHavePluginWithHeadcount('simple_plugin', 1);
    });

    it("can register plugins with one test (deprecated)", function() {
        var hydra = new RoboHydra();
        hydra.registerPluginObject(pluginInfoObject({
            name: 'simple_plugin',
            tests: {simpleTest:{}}
        }));
        expect(hydra).toHavePluginList(['simple_plugin']);
    });

    it("can register plugins with one scenario", function() {
        var hydra = new RoboHydra();
        hydra.registerPluginObject(pluginInfoObject({
            name: 'simple_plugin',
            scenarios: {simpleScenario:{}}
        }));
        expect(hydra).toHavePluginList(['simple_plugin']);
    });

    it("can register plugins with one head and one test (deprecated)", function() {
        var hydra = new RoboHydra();
        hydra.registerPluginObject(pluginInfoObject({
            name: 'simple_plugin',
            heads: [simpleRoboHydraHead()],
            tests: {simpleTest:{}}
        }));
        expect(hydra).toHavePluginList(['simple_plugin']);
    });

    it("can register plugins with one head and one scenario", function() {
        var hydra = new RoboHydra();
        hydra.registerPluginObject(pluginInfoObject({
            name: 'simple_plugin',
            heads: [simpleRoboHydraHead()],
            scenarios: {simpleScenario:{}}
        }));
        expect(hydra).toHavePluginList(['simple_plugin']);
    });

    it("can't register two plugins with the same name", function() {
        var hydra = new RoboHydra();
        var plugin1 = {name: 'simple_plugin',
                       heads: [simpleRoboHydraHead('/', 'foo')]};
        var plugin2 = {name: 'simple_plugin',
                       heads: [simpleRoboHydraHead('/.*', 'bar')]};
        hydra.registerPluginObject(pluginInfoObject(plugin1));
        expect(hydra).toHavePluginList(['simple_plugin']);
        expect(hydra).toHavePluginWithHeadcount('simple_plugin', 1);
        expect(function() {
            hydra.registerPluginObject(pluginInfoObject(plugin2));
        }).toThrow("InvalidRoboHydraConfigurationException");
    });

    it("can register several plugins", function() {
        var hydra = new RoboHydra();
        var plugin1 = {name: 'plugin1',
                       heads: [simpleRoboHydraHead('/robohydra-admin',
                                               'RoboHydra Admin UI')]};
        var plugin2 = {name: 'plugin2',
                       heads: [simpleRoboHydraHead('/.*', 'Not Found')]};
        hydra.registerPluginObject(pluginInfoObject(plugin1));
        expect(hydra).toHavePluginList(['plugin1']);
        expect(hydra).toHavePluginWithHeadcount('plugin1', 1);
        hydra.registerPluginObject(pluginInfoObject(plugin2));
        expect(hydra).toHavePluginList(['plugin1', 'plugin2']);
        expect(hydra).toHavePluginWithHeadcount('plugin1', 1);
        expect(hydra).toHavePluginWithHeadcount('plugin2', 1);
    });

    it("considers plugin configuration when registering plugins", function() {
        var hydra = new RoboHydra();
        var value = 'configuration key value';
        hydra.registerPluginObject({
            name: 'plugin1',
            path: '/',
            config: {myConfVariable: value},
            module: {
                getBodyParts: function(conf) {
                    expect(conf.myConfVariable).toEqual(value);
                    return {};
                }
            }
        });
    });

    it("considers extraVars when registering plugins", function() {
        var configKeyValue = 'config value',
            overridenConfigKeyValue = 'overriden value',
            newConfigKeyValue = 'new value';

        var hydra = new RoboHydra({configKey: overridenConfigKeyValue,
                                   newConfigKey: newConfigKeyValue});
        hydra.registerPluginObject({
            name: 'plugin1',
            path: '/',
            config: {configKey: configKeyValue},
            module: {
                getBodyParts: function(conf) {
                    expect(conf.configKey).toEqual(overridenConfigKeyValue);
                    expect(conf.newConfigKey).toEqual(newConfigKeyValue);
                    return {};
                }
            }
        });
    });

    it("can get a plugin by name", function() {
        var hydra = new RoboHydra();
        var plugin1 = {name: 'plugin1',
                       heads: [simpleRoboHydraHead('/.*', 'Not Found')]};
        hydra.registerPluginObject(pluginInfoObject(plugin1));
        var p = hydra.getPlugin('plugin1');
        expect(p.name).toEqual('plugin1');
    });

    it("throw an exception when getting a non-existent plugin by name", function() {
        var hydra = new RoboHydra();
        var plugin1 = {name: 'plugin1',
                       heads: [simpleRoboHydraHead('/.*', 'Not Found')]};
        hydra.registerPluginObject(pluginInfoObject(plugin1));
        expect(function() {
            hydra.getPlugin("plugin11");
        }).toThrow("RoboHydraPluginNotFoundException");
    });

    it("consider all paths 404 when there are no plugins", function() {
        var hydra = new RoboHydra();
        hydra.handle(simpleReq('/'),
                     new Response(function() {
                         expect(this.statusCode).toEqual(404);
                         expect(this.body).toEqual('Not Found');
                     }));
    });

    it("can dispatch a single, catch-all path", function() {
        var hydra = new RoboHydra();
        var content = 'It works!';
        var heads = [simpleRoboHydraHead('/.*', content)];
        hydra.registerPluginObject(pluginInfoObject({name: 'plugin1',
                                                     heads: heads}));
        hydra.handle(simpleReq('/'),
                     new Response(function() {
                         expect(this.statusCode).toEqual(200);
                         expect(this.body).toEqual(content);
                     }));
    });

    it("traverse heads in order when dispatching", function() {
        var hydra = new RoboHydra();
        var content = 'It works!';
        var heads = [simpleRoboHydraHead('/', content),
                     simpleRoboHydraHead('/.*', 'Fail!')];
        hydra.registerPluginObject(pluginInfoObject({name: 'plugin1',
                                                     heads: heads}));
        hydra.handle(simpleReq('/'),
                     new Response(function() {
                         expect(this.statusCode).toEqual(200);
                         expect(this.body).toEqual(content);
                     }));
    });

    it("deliver 404 when there are routes, but none match", function() {
        var hydra = new RoboHydra();
        var heads = [simpleRoboHydraHead('/foo'), simpleRoboHydraHead('/bar')];
        hydra.registerPluginObject(pluginInfoObject({
            name: 'plugin1',
            heads: heads
        }));
        ['/', '/qux', '/foobar', '/foo/bar'].forEach(function(path) {
            hydra.handle(simpleReq(path),
                         new Response(function() {
                             expect(this.statusCode).toEqual(404);
                         }));
        });
    });

    it("respond correctly with a 404 when no routes match", function(done) {
        var hydra = new RoboHydra();
        var heads = [simpleRoboHydraHead('/foo')];
        hydra.registerPluginObject(pluginInfoObject({name: 'plugin1',
                                                     heads: heads}));
        hydra.handle(simpleReq('/'), new Response(function() {
                                       expect(this.statusCode).toEqual(404);
                                       done();
                                   }));
    });

    it("don't allow registering a plugin with duplicate head names", function() {
        var hydra = new RoboHydra();
        var heads = [simpleRoboHydraHead('/foo', 'dummy name', 'name'),
                     simpleRoboHydraHead('/bar', 'dummy name', 'name')];
        expect(function() {
            hydra.registerPluginObject(pluginInfoObject({name: 'plugin1',
                                                         heads: heads}));
        }).toThrow("DuplicateRoboHydraHeadNameException");
        expect(hydra).toHavePluginList([]);
    });

    it("allow registering different plugins with common head names", function() {
        var hydra = new RoboHydra();
        var headsPlugin1 = [simpleRoboHydraHead('/foo', 'content', 'head1'),
                            simpleRoboHydraHead('/bar', 'content', 'head2')];
        var headsPlugin2 = [simpleRoboHydraHead('/foo', 'content', 'head1'),
                            simpleRoboHydraHead('/bar', 'content', 'head2')];
        hydra.registerPluginObject(pluginInfoObject({name: 'plugin1',
                                                     heads: headsPlugin1}));
        hydra.registerPluginObject(pluginInfoObject({name: 'plugin2',
                                                     heads: headsPlugin2}));
        expect(hydra).toHavePluginList(['plugin1', 'plugin2']);
        expect(hydra).toHavePluginWithHeadcount('plugin1', 2);
        expect(hydra).toHavePluginWithHeadcount('plugin2', 2);
    });

    it("find existing heads", function() {
        var hydra = new RoboHydra();
        var heads = [simpleRoboHydraHead('/foo', 'foo path',  'head1'),
                     simpleRoboHydraHead('/.*',  'catch-all', 'head2')];
        hydra.registerPluginObject(pluginInfoObject({name: 'plugin',
                                                     heads: heads}));

        expect(hydra.findHead('plugin', 'head1').name).toEqual('head1');
        expect(hydra.findHead('plugin', 'head2').name).toEqual('head2');
    });

    it("throw an error when finding non-existing heads", function() {
        var hydra = new RoboHydra();
        var heads = [simpleRoboHydraHead('/foo', 'foo path',  'head1'),
                     simpleRoboHydraHead('/.*',  'catch-all', 'head2')];
        hydra.registerPluginObject(pluginInfoObject({name: 'plugin',
                                                     heads: heads}));

        expect(function() {
            hydra.findHead('plugin1', 'head1');
        }).toThrow("RoboHydraHeadNotFoundException");
        expect(function() {
            hydra.findHead('plugin', 'head3');
        }).toThrow("RoboHydraHeadNotFoundException");
        expect(function() {
            hydra.findHead('plugin', 'head22');
        }).toThrow("RoboHydraHeadNotFoundException");
        expect(function() {
            hydra.findHead('_plugin', 'head2');
        }).toThrow("RoboHydraHeadNotFoundException");
    });

    it("allow attaching and detaching heads", function() {
        var hydra = new RoboHydra();
        var heads = [simpleRoboHydraHead('/foo', 'foo path', 'head1')];
        hydra.registerPluginObject(pluginInfoObject({name: 'plugin',
                                                     heads: heads}));

        hydra.detachHead('plugin', 'head1');
        expect(hydra).not.toHaveHeadAttached('plugin', 'head1');
        hydra.attachHead('plugin', 'head1');
        expect(hydra).toHaveHeadAttached('plugin', 'head1');
    });

    it("throw an error when attaching/detaching non-existing heads", function() {
        var hydra = new RoboHydra();
        var heads = [simpleRoboHydraHead('/foo', 'foo path', 'head1')];
        hydra.registerPluginObject(pluginInfoObject({name: 'plugin',
                                                     heads: heads}));

        expect(function() {
            hydra.detachHead('plugin', 'head2');
        }).toThrow("RoboHydraHeadNotFoundException");
        expect(function() {
            hydra.detachHead('plugin2', 'head1');
        }).toThrow("RoboHydraHeadNotFoundException");
        expect(function() {
            hydra.detachHead('_plugin', 'head1');
        }).toThrow("RoboHydraHeadNotFoundException");
    });

    it("throw an error when attaching/detaching already attached/detached heads", function() {
        var hydra = new RoboHydra();
        var heads = [simpleRoboHydraHead('/foo', 'foo path', 'head1')];
        hydra.registerPluginObject(pluginInfoObject({name: 'plugin',
                                                     heads: heads}));

        expect(function() {
            hydra.attachHead('plugin', 'head1');
        }).toThrow("InvalidRoboHydraHeadStateException");
        hydra.detachHead('plugin', 'head1');
        expect(function() {
            hydra.detachHead('plugin', 'head1');
        }).toThrow("InvalidRoboHydraHeadStateException");
    });

    it("skips detached heads when dispatching", function(done) {
        var hydra = new RoboHydra();
        var path = '/foo';
        var heads = [simpleRoboHydraHead(path,   'foo path', 'head1'),
                     simpleRoboHydraHead('/.*',  'catch-all', 'head2')];
        hydra.registerPluginObject(pluginInfoObject({name: 'plugin',
                                                     heads: heads}));
        hydra.handle(simpleReq(path), new Response(function() {
            expect(this.statusCode).toEqual(200);
            expect(this.body).toEqual('foo path');

            hydra.detachHead('plugin', 'head1');
            hydra.handle(simpleReq(path), new Response(function() {
                expect(this.statusCode).toEqual(200);
                expect(this.body).toEqual('catch-all');

                hydra.attachHead('plugin', 'head1');
                hydra.handle(simpleReq(path), new Response(function() {
                    expect(this.statusCode).toEqual(200);
                    expect(this.body).toEqual('foo path');
                    done();
                }));
            }));
        }));
    });

    it("can create additional heads dynamically", function(done) {
        var hydra = new RoboHydra();
        var path = '/foo';

        hydra.registerDynamicHead(simpleRoboHydraHead(path, 'some content'));
        expect(hydra).toHavePluginWithHeadcount('*dynamic*', 1);

        hydra.handle(simpleReq(path), new Response(function() {
            expect(this.body).toEqual('some content');
            done();
        }));
    });

    it("gives newer dynamic heads precedence", function(done) {
        var hydra = new RoboHydra();
        var path = '/foo';
        var content1 = 'some content',
            content2 = 'newer content';

        hydra.registerDynamicHead(simpleRoboHydraHead(path, content1));
        hydra.registerDynamicHead(simpleRoboHydraHead(path, content2));

        hydra.handle(simpleReq(path), new Response(function() {
            expect(this.body).toEqual(content2);
            done();
        }));
    });

    it("can create additional heads dynamically with explicit priority", function(done) {
        var hydra = new RoboHydra();
        var path = '/foo';

        hydra.registerDynamicHead(simpleRoboHydraHead(path, 'some content'),
                                  {priority: 'normal'});
        expect(hydra).toHavePluginWithHeadcount('*dynamic*', 1);

        hydra.handle(simpleReq(path), new Response(function() {
            expect(this.body).toEqual('some content');
            done();
        }));
    });

    it("can create additional high priority heads dynamically", function(done) {
        var hydra = new RoboHydra();
        var path = '/foo';

        hydra.registerDynamicHead(simpleRoboHydraHead(path, 'some content'),
                                  {priority: 'high'});
        expect(hydra).toHavePluginWithHeadcount('*priority-dynamic*', 1);

        hydra.handle(simpleReq(path), new Response(function() {
            expect(this.body).toEqual('some content');
            done();
        }));
    });

    it("throw exceptions on wrong priority for dynamic heads", function() {
        var hydra = new RoboHydra();

        expect(function() {
            hydra.registerDynamicHead(simpleRoboHydraHead('/foo',
                                                          'some content'),
                                      {priority: 'normall'});
        }).toThrow("RoboHydraException");
    });

    it("places high priority heads above normal priority heads", function(done) {
        var hydra = new RoboHydra();
        var path1 = '/foo', path2 = '/bar';
        var highPrioContent = 'This is high-priority content!',
            normalContent = 'Normal prio content';

        hydra.registerDynamicHead(simpleRoboHydraHead(path1, highPrioContent),
                                  {priority: 'high'});
        hydra.registerDynamicHead(simpleRoboHydraHead('/.*', normalContent));
        hydra.registerDynamicHead(simpleRoboHydraHead(path2, highPrioContent),
                                  {priority: 'high'});
        expect(hydra).toHavePluginWithHeadcount('*priority-dynamic*', 2);
        expect(hydra).toHavePluginWithHeadcount('*dynamic*', 1);

        hydra.handle(simpleReq(path1), new Response(function() {
            expect(this.body).toEqual(highPrioContent);
            hydra.handle(simpleReq(path2), new Response(function() {
                expect(this.body).toEqual(highPrioContent);
                done();
            }));
        }));
    });

    it("can register several dynamic heads", function(done) {
        var hydra = new RoboHydra();
        var path1    = '/foo',         path2    = '/bar';
        var content1 = 'some content', content2 = 'another content';

        hydra.registerDynamicHead(simpleRoboHydraHead(path1, content1));
        hydra.registerDynamicHead(simpleRoboHydraHead(path2, content2));

        hydra.handle(simpleReq(path1), new Response(function() {
            expect(this.body).toEqual(content1);
            hydra.handle(simpleReq(path2), new Response(function() {
                expect(this.body).toEqual(content2);
                done();
            }));
        }));
    });

    it("can find dynamic heads", function() {
        var hydra = new RoboHydra();
        var path = '/foo', content = 'some content', name = 'head1';

        hydra.registerDynamicHead(simpleRoboHydraHead(path, content, name));
        var dynamicHead = hydra.findHead('*dynamic*', name);
        expect(dynamicHead).toBeDefined();
    });

    it("can detach dynamic heads", function(done) {
        var hydra = new RoboHydra();
        var path = '/foo', content = 'some content', name = 'head1';

        hydra.registerDynamicHead(simpleRoboHydraHead(path, content, name));

        hydra.handle(simpleReq(path), new Response(function() {
            expect(this.body).toEqual(content);

            hydra.detachHead('*dynamic*', name);
            hydra.handle(simpleReq(path), new Response(function() {
                expect(this.statusCode).toEqual(404);
                done();
            }));
        }));
    });

    it("can detach one dynamic head and leave the rest working", function(done) {
        var hydra = new RoboHydra();
        var path1 = '/foo', content1 = 'some content',  name1 = 'head1';
        var path2 = '/bar', name2 = 'head2';

        hydra.registerDynamicHead(simpleRoboHydraHead(path1, content1,   name1));
        hydra.registerDynamicHead(simpleRoboHydraHead(path2, 'whatever', name2));
        hydra.detachHead('*dynamic*', name2);

        hydra.handle(simpleReq(path1), new Response(function() {
            expect(this.body).toEqual(content1);
            done();
        }));
    });

    it("assign different names to unnamed dynamic heads", function() {
        var hydra = new RoboHydra();
        hydra.registerDynamicHead(simpleRoboHydraHead());
        hydra.registerDynamicHead(simpleRoboHydraHead());

        var dynamicHeads = hydra.getPlugin('*dynamic*').heads;
        expect(dynamicHeads[0].name).not.toEqual(dynamicHeads[1].name);
    });

    it("can chain a request with two heads", function(done) {
        var hydra = new RoboHydra();
        var resultList = [];
        var headCallingNext = new RoboHydraHead({
            path: '/foo',
            handler: function(req, res, next) {
                resultList.push('headCallingNext');
                next(req, res);
            }});
        var headBeingCalled = new RoboHydraHead({
            path: '/.*',
            handler: function(req, res) {
                resultList.push('headBeingCalled');
                res.end();
            }});
        hydra.registerPluginObject(pluginInfoObject({
            name: 'plugin',
            heads: [headCallingNext,
                    headBeingCalled]
        }));
        hydra.handle(simpleReq('/foo'), new Response(function() {
            expect(resultList).toEqual(['headCallingNext', 'headBeingCalled']);
            done();
        }));
    });

    it("can chain a request with more than two heads", function(done) {
        var hydra = new RoboHydra();
        var resultList = [];
        var headCallingNext = new RoboHydraHead({
            name: 'callingNext',
            path: '/foo',
            handler: function(req, res, next) {
                resultList.push('headCallingNext');
                next(req, res);
            }});
        var headBeingCalled = new RoboHydraHead({
            name: 'beingCalled',
            path: '/.*',
            handler: function(req, res, next) {
                resultList.push('headBeingCalled');
                next(req, res);
            }});
        var headBeingCalledLast = new RoboHydraHead({
            name: 'beingCalledLast',
            path: '/f.*',
            handler: function(req, res) {
                resultList.push('headBeingCalledLast');
                res.end();
            }});
        hydra.registerPluginObject(pluginInfoObject({
            name: 'plugin',
            heads: [headCallingNext,
                    headBeingCalled,
                    headBeingCalledLast]
        }));
        hydra.handle(simpleReq('/foo'), new Response(function() {
            expect(resultList).toEqual(['headCallingNext',
                                        'headBeingCalled',
                                        'headBeingCalledLast']);
            done();
        }));
    });

    it("can chain a request that doesn't match any more heads", function(done) {
        var hydra = new RoboHydra();
        var finalRes;
        var headCallingNext = new RoboHydraHead({
            path: '/foo',
            handler: function(req, res, next) {
                next(req, new Response(function() {
                              finalRes = this;
                              res.end();
                          }));
            }});
        hydra.registerPluginObject(pluginInfoObject({
            name: 'plugin',
            heads: [headCallingNext]
        }));
        hydra.handle(simpleReq('/foo'), new Response(function() {
            expect(finalRes.statusCode).toEqual(404);
            done();
        }));
    });

    it("throw an exception if the 'next' function is called without parameters", function(done) {
        var hydra = new RoboHydra();
        var headCallingNext = new RoboHydraHead({
            path: '/foo',
            handler: function(req, res, next) {
                expect(function() {
                    // http://bit.ly/KkdH81
                    next();
                }).toThrow("InvalidRoboHydraNextParametersException");
                res.end();
            }});
        hydra.registerDynamicHead(headCallingNext);
        hydra.handle(simpleReq('/foo'), new Response(done));
    });

    it("return 500 if a head dies", function(done) {
        var hydra = new RoboHydra();
        var dyingHead = new RoboHydraHead({
            path: '/.*',
            handler: function() {
                throw new Error("I'm dying... I'M DYING!");
            }
        });
        hydra.registerDynamicHead(dyingHead);
        hydra.handle(simpleReq('/whatever'), new Response(function() {
            expect(this.statusCode).toEqual(500);
            expect(this.body.toString()).toMatch(new RegExp('dying'));
            done();
        }));
    });
});

describe("RoboHydra plugin load system", function() {
    "use strict";

    it("can load scenarios from external files", function() {
        var hydra = new RoboHydra();
        var pluginName = 'external-scenarios-simple';
        var pluginPath = path.join(__dirname, 'plugins', pluginName);
        hydra.registerPluginObject(pluginObjectFromPath(pluginPath));
        expect(Object.keys(hydra.getPlugin(pluginName).scenarios)).toEqual(
            ['firstScenario']);
    });

    it("can load scenarios from both external files and main file", function() {
        var hydra = new RoboHydra();
        var pluginName = 'external-scenarios-mixed';
        var pluginPath = path.join(__dirname, 'plugins', pluginName);
        hydra.registerPluginObject(pluginObjectFromPath(pluginPath));
        expect(Object.keys(hydra.getPlugin(pluginName).scenarios).sort()).toEqual(
            ['external', 'internal']);
    });

    it("can load a plugin without heads, and with only external scenarios", function() {
        var hydra = new RoboHydra();
        var pluginName = 'external-scenarios-headless';
        var pluginPath = path.join(__dirname, 'plugins', pluginName);
        hydra.registerPluginObject(pluginObjectFromPath(pluginPath));
        var scenarios = Object.keys(hydra.getPlugin(pluginName).scenarios);
        expect(scenarios.sort()).toEqual(['firstTest', 'secondTest']);
    });

    it("doesn't allow internal and external scenarios with the same name", function() {
        var hydra = new RoboHydra();
        var pluginName = 'external-scenarios-conflicting-names';
        var pluginPath = path.join(__dirname, 'plugins', pluginName);
        expect(function() {
            hydra.registerPluginObject(pluginObjectFromPath(pluginPath));
        }).toThrow('InvalidRoboHydraPluginException');
    });
});

describe("RoboHydra test system (deprecated)", function() {
    "use strict";

    it("has '*default*' as the default test", function() {
        var hydra = new RoboHydra();
        expect(hydra.currentTest).toEqual({plugin: '*default*',
                                           test:   '*default*'});
    });

    it("can start tests", function() {
        var hydra = new RoboHydra();
        hydra.registerPluginObject(pluginInfoObject({
            name: 'plugin',
            tests: {
                simpleTest: {
                    heads: [simpleRoboHydraHead()]
                }
            }
        }));
        hydra.startTest('plugin', 'simpleTest');
        expect(hydra.currentTest).toEqual({plugin: 'plugin',
                                           test: 'simpleTest'});
    });

    it("throws an exception when starting non-existent tests", function() {
        var hydra = new RoboHydra();
        expect(function() {
            hydra.startTest('plugin', 'simpleTest');
        }).toThrow("InvalidRoboHydraScenarioException");
    });

    it("can stop tests", function() {
        var hydra = new RoboHydra();
        hydra.registerPluginObject(pluginInfoObject({
            name: 'plugin',
            tests: {
                simpleTest: {
                    heads: [simpleRoboHydraHead()]
                }
            }
        }));
        hydra.startTest('plugin', 'simpleTest');
        hydra.stopTest();
        expect(hydra.currentTest).toEqual({plugin: '*default*',
                                           test:   '*default*'});
    });

    it("stops the previous test when starting a new one", function() {
        var hydra = new RoboHydra();
        hydra.registerPluginObject(pluginInfoObject({
            name: 'plugin',
            tests: {
                simpleTest: {
                    heads: [simpleRoboHydraHead()]
                }
            }
        }));
        hydra.registerPluginObject(pluginInfoObject({
            name: 'plugin2',
            tests: {
                anotherSimpleTest: {
                    heads: [simpleRoboHydraHead()]
                }
            }
        }));
        hydra.startTest('plugin', 'simpleTest');
        hydra.startTest('plugin2', 'anotherSimpleTest');
        expect(hydra.currentTest).toEqual({plugin: 'plugin2',
                                           test:   'anotherSimpleTest'});
    });

    it("doesn't activate test heads if no test is active", function(done) {
        var hydra = new RoboHydra();
        var path  = '/foo';
        hydra.registerPluginObject(pluginInfoObject({
            name: 'plugin',
            tests: {
                simpleTest: {
                    heads: [simpleRoboHydraHead(path)]
                }
            }
        }));
        hydra.handle(simpleReq(path), new Response(function() {
            expect(this.statusCode).toEqual(404);
            done();
        }));
    });

    it("activates test heads when test is active", function(done) {
        var hydra = new RoboHydra();
        var path = '/foo';
        var testHeads = [simpleRoboHydraHead(path)];
        hydra.registerPluginObject(pluginInfoObject({
            name: 'plugin',
            tests: {
                someTest: {
                    heads: testHeads
                }
            }
        }));
        hydra.startTest('plugin', 'someTest');
        hydra.handle(simpleReq(path), new Response(function() {
            expect(this.statusCode).toEqual(200);
            done();
        }));
    });

    it("deactivates test heads when a test is stopped", function(done) {
        var hydra = new RoboHydra();
        var path = '/foo';
        hydra.registerPluginObject(pluginInfoObject({
            name: 'plugin',
            tests: {
                someTest: {
                    heads: [simpleRoboHydraHead(path)]
                }
            }
        }));
        hydra.startTest('plugin', 'someTest');
        hydra.stopTest();
        hydra.handle(simpleReq(path), new Response(function() {
            expect(this.statusCode).toEqual(404);
            done();
        }));
    });

    it("deactivates test heads when a new test is started", function(done) {
        var hydra = new RoboHydra();
        var path = '/foo', path2 = '/bar';
        hydra.registerPluginObject(pluginInfoObject({
            name: 'plugin',
            tests: {
                someTest: {
                    heads: [simpleRoboHydraHead(path)]
                },
                anotherTest: {
                    heads: [simpleRoboHydraHead(path2)]
                }
            }
        }));
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
        hydra.handle(simpleReq(path), res);
    });

    it("has an empty result when starting a test", function() {
        var hydra = new RoboHydra();
        hydra.registerPluginObject(pluginInfoObject({
            name: 'plugin',
            tests: { testWithAssertion: {heads: [
                headWithFail('/f', hydra.getModulesObject(), "some message")
            ]}}
        }));
        hydra.startTest('plugin', 'testWithAssertion');
        expect(hydra).toHaveTestResult('plugin',
                                       'testWithAssertion',
                                       {result: undefined,
                                        passes: [],
                                        failures: []});
    });

    it("can execute and count a passing assertion", function(done) {
        var assertionMessage = "should do something simple but useful";
        var hydra = new RoboHydra();
        hydra.registerPluginObject(pluginInfoObject({
            name: 'plugin',
            tests: {
                testWithAssertion: {
                    heads: [headWithPass('/', hydra.getModulesObject(),
                                         assertionMessage)]
                }
            }
        }));
        hydra.startTest('plugin', 'testWithAssertion');
        hydra.handle(
            simpleReq('/'),
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
        var hydra = new RoboHydra();
        var assertionMessage = "should have this and that";
        hydra.registerPluginObject(pluginInfoObject({
            name: 'plugin',
            tests: { testWithAssertion: {
                heads: [headWithFail('/', hydra.getModulesObject(),
                                     assertionMessage)]
            }}
        }));
        hydra.startTest('plugin', 'testWithAssertion');
        hydra.handle(
            simpleReq('/'),
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
        var hydra = new RoboHydra();
        var passMessage = "should have this and that (and did)";
        var failMessage = "should have this and that (and didn't)";
        hydra.registerPluginObject(pluginInfoObject({
            name: 'plugin',
            tests: { testWithAssertion: {heads: [
                headWithFail('/f', hydra.getModulesObject(), failMessage),
                headWithPass('/p', hydra.getModulesObject(), passMessage)
            ]}}}));
        hydra.startTest('plugin', 'testWithAssertion');
        hydra.handle(
            simpleReq('/f'),
            new Response(function() {
                hydra.handle(
                    simpleReq('/p'),
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
        var hydra = new RoboHydra();
        var passMessage = "should have this and that (and did)";
        var failMessage = "should have this and that (and didn't)";
        hydra.registerPluginObject(pluginInfoObject({
            name: 'plugin',
            tests: { testWithAssertion: {heads: [
                headWithFail('/f', hydra.getModulesObject(), failMessage),
                headWithPass('/p', hydra.getModulesObject(), passMessage)
            ]}}
        }));
        hydra.startTest('plugin', 'testWithAssertion');
        hydra.handle(
            simpleReq('/f'),
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
        var hydra = new RoboHydra();
        var passMessage = "should have this and that (and did)";
        hydra.registerPluginObject(pluginInfoObject({
            name: 'plugin',
            heads: [
                headWithPass('/p', hydra.getModulesObject(), passMessage)
            ]
        }));
        hydra.handle(
            simpleReq('/p'),
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
        var hydra = new RoboHydra();
        var passMessage = "should have this and that (and did)";
        hydra.registerPluginObject(pluginInfoObject({
            name: 'plugin',
            heads: [
                headWithPass('/p', hydra.getModulesObject(), passMessage)
            ],
            tests: {testWithAssertion: {heads: []}}
        }));
        hydra.startTest('plugin', 'testWithAssertion');
        hydra.stopTest();
        hydra.handle(
            simpleReq('/p'),
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
        var hydra = new RoboHydra();
        var passMessage = "should have this and that (and did)";
        hydra.registerPluginObject(pluginInfoObject({
            name: 'plugin',
            heads: [
                headWithPass('/p', hydra.getModulesObject(), passMessage)
            ],
            tests: {testWithAssertion: {heads: []}}
        }));
        hydra.startTest('plugin', 'testWithAssertion');
        hydra.handle(
            simpleReq('/p'),
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
        var hydra = new RoboHydra();
        var passMessage = "should have this and that (and did)";
        hydra.registerPluginObject(pluginInfoObject({
            name: 'plugin',
            heads: [
                headWithPass('/p', hydra.getModulesObject(), passMessage)
            ],
            tests: {testWithAssertion: {heads: []}}
        }));
        hydra.startTest('plugin', 'testWithAssertion');
        hydra.handle(
            simpleReq('/p'),
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
        var hydra = new RoboHydra();
        var passMessage = "should have this and that (and did)";
        hydra.registerPluginObject(pluginInfoObject({
            name: 'plugin',
            heads: [
                headWithPass('/p', hydra.getModulesObject(), passMessage)
            ],
            tests: {testWithAssertion: {heads: []},
                    anotherTest:       {heads: []}}
        }));
        hydra.startTest('plugin', 'testWithAssertion');
        hydra.handle(
            simpleReq('/p'),
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

    it("simply returns false on assertion failure", function(done) {
        var hydra = new RoboHydra();
        var executesAfterAssertion = false, testResult = null;
        hydra.registerPluginObject(pluginInfoObject({
            name: 'plugin',
            heads: [
                new RoboHydraHead({
                    path: '/',
                    handler: function(req, res) {
                        testResult =
                            hydra.getModulesObject().assert.equal(0, 1);
                        executesAfterAssertion = true;
                        res.end();
                    }
                })
            ]
        }));
        hydra.handle(
            simpleReq('/'),
            new Response(function() {
                expect(executesAfterAssertion).toBeTrue();
                expect(testResult).toBeFalse();
                done();
            })
        );
    });

    it("returns true on assertion pass", function(done) {
        var hydra = new RoboHydra();
        var executesAfterAssertion = false, testResult = null;
        hydra.registerPluginObject(pluginInfoObject({
            name: 'plugin',
            heads: [
                new RoboHydraHead({
                    path: '/',
                    handler: function(req, res) {
                        testResult =
                            hydra.getModulesObject().assert.equal(1, 1);
                        executesAfterAssertion = true;
                        res.end();
                    }
                })
            ]
        }));
        hydra.handle(
            simpleReq('/'),
            new Response(function() {
                expect(executesAfterAssertion).toBeTrue();
                expect(testResult).toBeTrue();
                done();
            })
        );
    });

    it("gives a default assertion message to those that don't have one", function(done) {
        var hydra = new RoboHydra();
        hydra.registerPluginObject(pluginInfoObject({
            name: 'plugin',
            tests: {
                testWithAssertion: {heads: [
                    new RoboHydraHead({
                        path: '/',
                        handler: function(req, res) {
                            hydra.getModulesObject().assert.equal("foo", "bar");
                            res.end();
                        }
                    })
                ]}
            }
        }));
        hydra.startTest('plugin', 'testWithAssertion');
        hydra.handle(
            simpleReq('/'),
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

    it("can access a test's instructions", function() {
        var hydra = new RoboHydra();
        var instructions = "Click here, then there";
        hydra.registerPluginObject(pluginInfoObject({
            name: 'plugin',
            tests: {
                testWithInstructions: {
                    heads: [],
                    instructions: instructions
                }
            }
        }));
        expect(hydra.getPlugin('plugin').tests.testWithInstructions.instructions).toEqual(instructions);
    });
});

describe("RoboHydra scenario system", function() {
    "use strict";

    it("has '*default*' as the default scenario", function() {
        var hydra = new RoboHydra();
        expect(hydra.currentScenario).toEqual({plugin: '*default*',
                                               scenario: '*default*'});
    });

    it("can start scenarios", function() {
        var hydra = new RoboHydra();
        hydra.registerPluginObject(pluginInfoObject({
            name: 'plugin',
            scenarios: {
                simpleTest: {
                    heads: [simpleRoboHydraHead()]
                }
            }
        }));
        hydra.startScenario('plugin', 'simpleTest');
        expect(hydra.currentScenario).toEqual({plugin: 'plugin',
                                               scenario: 'simpleTest'});
    });

    it("throws an exception when starting non-existent scenarios", function() {
        var hydra = new RoboHydra();
        expect(function() {
            hydra.startScenario('plugin', 'simpleTest');
        }).toThrow("InvalidRoboHydraScenarioException");
    });

    it("can stop scenarios", function() {
        var hydra = new RoboHydra();
        hydra.registerPluginObject(pluginInfoObject({
            name: 'plugin',
            scenarios: {
                simpleTest: {
                    heads: [simpleRoboHydraHead()]
                }
            }
        }));
        hydra.startScenario('plugin', 'simpleTest');
        hydra.stopScenario();
        expect(hydra.currentScenario).toEqual({plugin:   '*default*',
                                               scenario: '*default*'});
    });

    it("stops the previous scenario when starting a new one", function() {
        var hydra = new RoboHydra();
        hydra.registerPluginObject(pluginInfoObject({
            name: 'plugin',
            scenarios: {
                simpleTest: {
                    heads: [simpleRoboHydraHead()]
                }
            }
        }));
        hydra.registerPluginObject(pluginInfoObject({
            name: 'plugin2',
            scenarios: {
                anotherSimpleTest: {
                    heads: [simpleRoboHydraHead()]
                }
            }
        }));
        hydra.startScenario('plugin', 'simpleTest');
        hydra.startScenario('plugin2', 'anotherSimpleTest');
        expect(hydra.currentScenario).toEqual({plugin:   'plugin2',
                                               scenario: 'anotherSimpleTest'});
    });

    it("doesn't activate scenario heads if no scenario is active", function(done) {
        var hydra = new RoboHydra();
        var path  = '/foo';
        hydra.registerPluginObject(pluginInfoObject({
            name: 'plugin',
            scenarios: {
                simpleTest: {
                    heads: [simpleRoboHydraHead(path)]
                }
            }
        }));
        hydra.handle(simpleReq(path), new Response(function() {
            expect(this.statusCode).toEqual(404);
            done();
        }));
    });

    it("activates scenario heads when scenario is active", function(done) {
        var hydra = new RoboHydra();
        var path = '/foo';
        var scenarioHeads = [simpleRoboHydraHead(path)];
        hydra.registerPluginObject(pluginInfoObject({
            name: 'plugin',
            scenarios: {
                someTest: {
                    heads: scenarioHeads
                }
            }
        }));
        hydra.startScenario('plugin', 'someTest');
        hydra.handle(simpleReq(path), new Response(function() {
            expect(this.statusCode).toEqual(200);
            done();
        }));
    });

    it("honours the head order when activating scenarios", function(done) {
        var hydra = new RoboHydra();
        var path = '/foo';
        var content1 = 'first content',
            content2 = 'second content';
        hydra.registerPluginObject(pluginInfoObject({
            name: 'plugin',
            scenarios: {
                someTest: {
                    heads: [simpleRoboHydraHead(path, content1),
                            simpleRoboHydraHead(path, content2)]
                }
            }
        }));
        hydra.startScenario('plugin', 'someTest');
        hydra.handle(simpleReq(path), new Response(function() {
            expect(this.body.toString()).toEqual(content1);
            done();
        }));
    });

    it("resets scenario heads when starting a scenario", function(done) {
        var hydra = new RoboHydra();
        var resp1 = 'response 1', resp2 = 'response 2';
        hydra.registerPluginObject(pluginInfoObject({
            name: 'plugin',
            scenarios: {
                someTest: {
                    heads: [
                        new RoboHydraHeadStatic({
                            responses: [
                                {content: resp1},
                                {content: resp2}
                            ]
                        })
                    ]
                }
            }
        }));
        hydra.startScenario('plugin', 'someTest');
        hydra.handle(simpleReq('/'), new Response(function(evt) {
            expect(evt.response.body.toString()).toEqual(resp1);
            hydra.startScenario('plugin', 'someTest');
            hydra.handle(simpleReq('/'), new Response(function(evt2) {
                expect(evt2.response.body.toString()).toEqual(resp1);
                done();
            }));
        }));
    });

    it("deactivates scenario heads when a scenario is stopped", function(done) {
        var hydra = new RoboHydra();
        var path = '/foo';
        hydra.registerPluginObject(pluginInfoObject({
            name: 'plugin',
            scenarios: {
                someTest: {
                    heads: [simpleRoboHydraHead(path)]
                }
            }
        }));
        hydra.startScenario('plugin', 'someTest');
        hydra.stopScenario();
        hydra.handle(simpleReq(path), new Response(function() {
            expect(this.statusCode).toEqual(404);
            done();
        }));
    });

    it("deactivates scenario heads when a new scenario is started", function(done) {
        var hydra = new RoboHydra();
        var path = '/foo', path2 = '/bar';
        hydra.registerPluginObject(pluginInfoObject({
            name: 'plugin',
            scenarios: {
                someTest: {
                    heads: [simpleRoboHydraHead(path)]
                },
                anotherTest: {
                    heads: [simpleRoboHydraHead(path2)]
                }
            }
        }));
        hydra.startScenario('plugin', 'someTest');
        hydra.startScenario('plugin', 'anotherTest');
        var res = new Response(function() {
                      expect(res.statusCode).toEqual(404);

                      var res2 = new Response(function() {
                                     expect(res2.statusCode).toEqual(200);
                                     done();
                                 });
                      hydra.handle({url: path2}, res2);
                  });
        hydra.handle(simpleReq(path), res);
    });

    it("has an empty test result when starting a scenario", function() {
        var hydra = new RoboHydra();
        hydra.registerPluginObject(pluginInfoObject({
            name: 'plugin',
            scenarios: { testWithAssertion: {heads: [
                headWithFail('/f', hydra.getModulesObject(), "some message")
            ]}}
        }));
        hydra.startScenario('plugin', 'testWithAssertion');
        expect(hydra).toHaveTestResult('plugin',
                                       'testWithAssertion',
                                       {result: undefined,
                                        passes: [],
                                        failures: []});
    });

    it("can execute and count a passing assertion", function(done) {
        var assertionMessage = "should do something simple but useful";
        var hydra = new RoboHydra();
        hydra.registerPluginObject(pluginInfoObject({
            name: 'plugin',
            scenarios: {
                testWithAssertion: {
                    heads: [headWithPass('/', hydra.getModulesObject(),
                                         assertionMessage)]
                }
            }
        }));
        hydra.startScenario('plugin', 'testWithAssertion');
        hydra.handle(
            simpleReq('/'),
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
        var hydra = new RoboHydra();
        var assertionMessage = "should have this and that";
        hydra.registerPluginObject(pluginInfoObject({
            name: 'plugin',
            scenarios: { testWithAssertion: {
                heads: [headWithFail('/', hydra.getModulesObject(),
                                     assertionMessage)]
            }}
        }));
        hydra.startScenario('plugin', 'testWithAssertion');
        hydra.handle(
            simpleReq('/'),
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
        var hydra = new RoboHydra();
        var passMessage = "should have this and that (and did)";
        var failMessage = "should have this and that (and didn't)";
        hydra.registerPluginObject(pluginInfoObject({
            name: 'plugin',
            scenarios: { testWithAssertion: {heads: [
                headWithFail('/f', hydra.getModulesObject(), failMessage),
                headWithPass('/p', hydra.getModulesObject(), passMessage)
            ]}}}));
        hydra.startScenario('plugin', 'testWithAssertion');
        hydra.handle(
            simpleReq('/f'),
            new Response(function() {
                hydra.handle(
                    simpleReq('/p'),
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

    it("resets test results after re-starting a scenario", function(done) {
        var hydra = new RoboHydra();
        var passMessage = "should have this and that (and did)";
        var failMessage = "should have this and that (and didn't)";
        hydra.registerPluginObject(pluginInfoObject({
            name: 'plugin',
            scenarios: { testWithAssertion: {heads: [
                headWithFail('/f', hydra.getModulesObject(), failMessage),
                headWithPass('/p', hydra.getModulesObject(), passMessage)
            ]}}
        }));
        hydra.startScenario('plugin', 'testWithAssertion');
        hydra.handle(
            simpleReq('/f'),
            new Response(function() {
                expect(hydra).toHaveTestResult('plugin',
                                               'testWithAssertion',
                                               {result: 'fail',
                                                passes: [],
                                                failures: [failMessage]});
                hydra.startScenario('plugin', 'testWithAssertion');
                expect(hydra).toHaveTestResult('plugin',
                                               'testWithAssertion',
                                               {result: undefined,
                                                passes: [],
                                                failures: []});
                done();
            })
        );
    });

    it("counts scenario-less assertions as *default*", function(done) {
        var hydra = new RoboHydra();
        var passMessage = "should have this and that (and did)";
        hydra.registerPluginObject(pluginInfoObject({
            name: 'plugin',
            heads: [
                headWithPass('/p', hydra.getModulesObject(), passMessage)
            ]
        }));
        hydra.handle(
            simpleReq('/p'),
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

    it("counts assertions after stopping scenarios as *default*", function(done) {
        var hydra = new RoboHydra();
        var passMessage = "should have this and that (and did)";
        hydra.registerPluginObject(pluginInfoObject({
            name: 'plugin',
            heads: [
                headWithPass('/p', hydra.getModulesObject(), passMessage)
            ],
            scenarios: {testWithAssertion: {heads: []}}
        }));
        hydra.startScenario('plugin', 'testWithAssertion');
        hydra.stopScenario();
        hydra.handle(
            simpleReq('/p'),
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

    it("counts assertions in non-scenario heads as in the current scenario", function(done) {
        var hydra = new RoboHydra();
        var passMessage = "should have this and that (and did)";
        hydra.registerPluginObject(pluginInfoObject({
            name: 'plugin',
            heads: [
                headWithPass('/p', hydra.getModulesObject(), passMessage)
            ],
            scenarios: {testWithAssertion: {heads: []}}
        }));
        hydra.startScenario('plugin', 'testWithAssertion');
        hydra.handle(
            simpleReq('/p'),
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

    it("stopping a scenario doesn't erase previous results", function(done) {
        var hydra = new RoboHydra();
        var passMessage = "should have this and that (and did)";
        hydra.registerPluginObject(pluginInfoObject({
            name: 'plugin',
            heads: [
                headWithPass('/p', hydra.getModulesObject(), passMessage)
            ],
            scenarios: {testWithAssertion: {heads: []}}
        }));
        hydra.startScenario('plugin', 'testWithAssertion');
        hydra.handle(
            simpleReq('/p'),
            new Response(function() {
                hydra.stopScenario();
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
        var hydra = new RoboHydra();
        var passMessage = "should have this and that (and did)";
        hydra.registerPluginObject(pluginInfoObject({
            name: 'plugin',
            heads: [
                headWithPass('/p', hydra.getModulesObject(), passMessage)
            ],
            tests: {testWithAssertion: {heads: []},
                    anotherTest:       {heads: []}}
        }));
        hydra.startTest('plugin', 'testWithAssertion');
        hydra.handle(
            simpleReq('/p'),
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

    it("simply returns false on assertion failure", function(done) {
        var hydra = new RoboHydra();
        var executesAfterAssertion = false, testResult = null;
        hydra.registerPluginObject(pluginInfoObject({
            name: 'plugin',
            heads: [
                new RoboHydraHead({
                    path: '/',
                    handler: function(req, res) {
                        testResult =
                            hydra.getModulesObject().assert.equal(0, 1);
                        executesAfterAssertion = true;
                        res.end();
                    }
                })
            ]
        }));
        hydra.handle(
            simpleReq('/'),
            new Response(function() {
                expect(executesAfterAssertion).toBeTrue();
                expect(testResult).toBeFalse();
                done();
            })
        );
    });

    it("returns true on assertion pass", function(done) {
        var hydra = new RoboHydra();
        var executesAfterAssertion = false, testResult = null;
        hydra.registerPluginObject(pluginInfoObject({
            name: 'plugin',
            heads: [
                new RoboHydraHead({
                    path: '/',
                    handler: function(req, res) {
                        testResult =
                            hydra.getModulesObject().assert.equal(1, 1);
                        executesAfterAssertion = true;
                        res.end();
                    }
                })
            ]
        }));
        hydra.handle(
            simpleReq('/'),
            new Response(function() {
                expect(executesAfterAssertion).toBeTrue();
                expect(testResult).toBeTrue();
                done();
            })
        );
    });

    it("gives a default assertion message to those that don't have one", function(done) {
        var hydra = new RoboHydra();
        hydra.registerPluginObject(pluginInfoObject({
            name: 'plugin',
            scenarios: {
                testWithAssertion: {heads: [
                    new RoboHydraHead({
                        path: '/',
                        handler: function(req, res) {
                            hydra.getModulesObject().assert.equal("foo", "bar");
                            res.end();
                        }
                    })
                ]}
            }
        }));
        hydra.startScenario('plugin', 'testWithAssertion');
        hydra.handle(
            simpleReq('/'),
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

    it("can access a scenario instructions", function() {
        var hydra = new RoboHydra();
        var instructions = "Click here, then there";
        hydra.registerPluginObject(pluginInfoObject({
            name: 'plugin',
            scenarios: {
                testWithInstructions: {
                    heads: [],
                    instructions: instructions
                }
            }
        }));
        expect(hydra.getPlugin('plugin').scenarios.testWithInstructions.instructions).toEqual(instructions);
    });
});

describe("Fixture system", function() {
    "use strict";

    before(function() {
        this.hydra = new RoboHydra();
        var rootDir = __dirname + '/plugins/simple-fixtures';
        this.hydra.registerPluginObject({
            name: 'simple-fixtures',
            path: rootDir,
            module: require(path.join(rootDir, 'index.js'))
        });
    });

    it("can load basic fixtures", function(done) {
        this.hydra.handle(simpleReq('/fixtures/basic.txt'),
                          new Response(function() {
                              expect(this.body.toString()).toMatch(
                                  new RegExp('Simple fixture'));
                              done();
                          }));
    });

    it("fails when the fixture doesn't exist", function(done) {
        this.hydra.handle(simpleReq('/fixtures/non-existent'),
                          new Response(function() {
                              expect(this.statusCode).toEqual(500);
                              done();
                          }));
    });

    it("loads non-ASCII fixtures", function(done) {
        this.hydra.handle(simpleReq('/fixtures/non-ascii.txt'),
                          new Response(function() {
                              expect(this.body.toString()).toEqual(
                                  'Velázquez\n');
                              done();
                          }));
    });

    it("doesn't try to load fixtures from other directories", function(done) {
        this.hydra.handle(simpleReq('/absolute-directory-fixture'),
                          new Response(function() {
                              expect(this.body.toString()).toEqual(
                                  'This is a fake /etc/passwd\n');
                              done();
                          }));
    });

    it("doesn't allow leaving the fixture directory", function(done) {
        this.hydra.handle(simpleReq('/relative-directory-fixture'),
                          new Response(function() {
                              expect(this.body.toString()).toEqual(
                                  'This is a fake /etc/passwd\n');
                              done();
                          }));
    });

    it("works from external tests", function(done) {
        this.hydra.startScenario('simple-fixtures', 'fixtureLoader');
        this.hydra.handle(simpleReq('/external-test-fixture'),
                          new Response(function() {
                              expect(this.body.toString()).toEqual(
                                  'Simple fixture\n');
                              done();
                          }));
    });
});


describe("Request object", function() {
    "use strict";

    it("parses the body", function() {
        var req = new Request({url: '/foo/bar',
                               rawBody: new Buffer("foo=bar&qux=meh")});
        expect(req.bodyParams.foo).toEqual("bar");
        expect(req.bodyParams.qux).toEqual("meh");
    });

    it("doesn't freak out if there's no body", function() {
        expect(function() {
            /*jshint nonew: false*/
            new Request({url: '/foo/bar'});
        }).not.toThrow();
    });

    it("normalises the HTTP method name", function() {
        var req = new Request({url: '/foo/bar', method: 'PoSt'});
        expect(req.method).toEqual('POST');
    });
});

describe("Response object", function() {
    "use strict";

    it("can't be used without an 'end' handler", function() {
        var r = new Response();
        expect(function() {
            r.end();
        }).toThrow("InvalidRoboHydraResponseException");
    });

    it("supports basic observers", function() {
        var headHandler = this.spy();
        var dataHandler = this.spy();
        var endHandler  = this.spy();
        var r = new Response().on('head', headHandler).
                               on('data', dataHandler).
                               on('end',  endHandler);
        r.writeHead(200);
        expect(headHandler).toHaveBeenCalled();
        expect(dataHandler).not.toHaveBeenCalled();
        expect(endHandler).not.toHaveBeenCalled();
        r.write("");
        expect(dataHandler).toHaveBeenCalled();
        expect(endHandler).not.toHaveBeenCalled();
        r.end();
        expect(endHandler).toHaveBeenCalled();
    });

    it("supports more than one listener for each event", function() {
        var headHandler1 = this.spy();
        var dataHandler1 = this.spy();
        var endHandler1  = this.spy();
        var headHandler2 = this.spy();
        var dataHandler2 = this.spy();
        var endHandler2  = this.spy();
        var r = new Response().on('head', headHandler1).
                               on('data', dataHandler1).
                               on('end',  endHandler1).
                               on('head', headHandler2).
                               on('data', dataHandler2).
                               on('end',  endHandler2);
        r.write("");
        r.end();
        expect(headHandler1).toHaveBeenCalled();
        expect(dataHandler1).toHaveBeenCalled();
        expect(endHandler1).toHaveBeenCalled();
        expect(headHandler2).toHaveBeenCalled();
        expect(dataHandler2).toHaveBeenCalled();
        expect(endHandler2).toHaveBeenCalled();
    });

    it("produces a head event on (but before!) the first data event", function() {
        var callOrder = [];
        var r = new Response().
            on('head', function() {
                callOrder.push("head");
            }).
            on('data', function() {
                callOrder.push("data");
            }).
            on('end', function() {
                callOrder.push("end");
            });
        r.write("");
        r.end();
        expect(callOrder).toEqual(["head", "data", "end"]);
    });

    it("doesn't produce a head event if writeHead was called", function() {
        var headHandler = this.spy();
        var r = new Response().on('head', headHandler).
                               on('end',  this.spy());
        r.writeHead(200);
        r.write("");
        expect(headHandler).toHaveBeenCalledOnce();
    });

    it("doesn't produce a head event if one was produced already", function() {
        var headHandler = this.spy();
        var r = new Response().on('head', headHandler).
                               on('end',  this.spy());
        r.write("");
        r.write("");
        expect(headHandler).toHaveBeenCalledOnce();
    });

    it("calls explicit 'head' event handler with empty header object if no headers", function() {
        var headHandler = this.spy();
        var r = new Response().on('head', headHandler).
                               on('end',  this.spy());
        var statusCode = 200;
        r.writeHead(statusCode);
        expect(headHandler).toHaveBeenCalledWith({type: 'head',
                                                  statusCode: statusCode,
                                                  headers: {}});
    });

    it("calls implicit 'head' event handler with empty header object if no headers", function() {
        var headHandler = this.spy();
        var r = new Response().on('head', headHandler).
                               on('end',  this.spy());
        var statusCode = 200;
        r.statusCode = statusCode;
        r.write("");
        expect(headHandler).toHaveBeenCalledWith({type: 'head',
                                                  statusCode: statusCode,
                                                  headers: {}});
    });

    it("calls implicit 'head' event with correct headers", function() {
        var headHandler = this.spy();
        var r = new Response().on('head', headHandler).
                               on('end',  this.spy());
        var statusCode = 200, headers = {foobar: 'qux'};
        r.statusCode = statusCode;
        r.headers    = headers;
        r.write("");
        expect(headHandler).toHaveBeenCalledWith({type: 'head',
                                                  statusCode: statusCode,
                                                  headers: headers});
    });

    it("produces a head event on (but before!) 'end', if there was no data", function() {
        var callOrder = [];
        var statusCode = 302, locationHeader = 'http://example.com';
        var r = new Response().
            on('head', function(evt) {
                var sc = evt.statusCode, h = evt.headers;
                expect(sc).toEqual(statusCode);
                expect(h.location).toEqual(locationHeader);
                callOrder.push("head");
            }).
            on('data', function() {
                callOrder.push("data");
            }).
            on('end', function() {
                callOrder.push("end");
            });
        r.statusCode = statusCode;
        r.headers = {location: locationHeader};
        r.end();
        expect(callOrder).toEqual(["head", "end"]);
    });

    it("doesn't produce a head event on 'end', if there was one already", function() {
        var callOrder = [];
        var statusCode = 302, locationHeader = 'http://example.com';
        var r = new Response().
            on('head', function(evt) {
                var sc = evt.statusCode, h = evt.headers;
                expect(sc).toEqual(statusCode);
                expect(h.location).toEqual(locationHeader);
                callOrder.push("head");
            }).
            on('data', function() {
                callOrder.push("data");
            }).
            on('end', function() {
                callOrder.push("end");
            });
        r.writeHead(statusCode, {location: locationHeader});
        r.end();
        expect(callOrder).toEqual(["head", "end"]);
    });

    it("allows easy response chaining", function() {
        var headHandler = this.spy();
        var dataHandler = this.spy();
        var endHandler  = this.spy();
        var r1 = new Response().on('head', headHandler).
                                on('data', dataHandler).
                                on('end',  endHandler);
        var r2 = new Response().chain(r1);

        // Do things on r2, expect them to happen on r1
        var statusCode = 200, headers = {foobar: 'qux'};
        r2.writeHead(statusCode, headers);
        expect(headHandler).toHaveBeenCalledWith({type: 'head',
                                                  statusCode: statusCode,
                                                  headers: headers});
        var buffer = new Buffer("foobar");
        r2.write(buffer);
        expect(dataHandler).toHaveBeenCalledWith({type: 'data',
                                                  data: buffer});
        var buffer2 = new Buffer("qux");
        r2.write(buffer2);
        expect(dataHandler).toHaveBeenCalledWith({type: 'data',
                                                  data: buffer2});
        r2.end();
        expect(endHandler).toHaveBeenCalledWith({type: 'end',
                                                 response: r1});
    });

    it("triggers implicit head events when chaining", function() {
        var headHandler = this.spy();
        var r1 = new Response().on('head', headHandler).
                                on('data', this.spy()).
                                on('end',  this.spy());
        var r2 = new Response().chain(r1);

        // Do things on r2, expect them to happen on r1
        var statusCode = 200, headers = {foobar: 'qux'};
        r2.statusCode = statusCode;
        r2.headers    = headers;
        r2.write("foobar");
        expect(headHandler).toHaveBeenCalledWith({type: 'head',
                                                  statusCode: statusCode,
                                                  headers: headers});
    });

    it("doesn't write an empty body when copying responses", function() {
        var r1 = new Response(function() {});
        r1.write = this.spy();
        var r2 = new Response(function() {});

        r2.statusCode = 200;
        r2.end();
        r1.copyFrom(r2);
        r1.end();
        expect(r1.write).not.toHaveBeenCalled();
    });

    it("doesn't break streaming when using copyFrom", function() {
        var dataSpy = this.spy();
        var r1 = new Response().on('data', dataSpy).on('end', function() {});
        r1.write = this.spy();
        var r2 = new Response(function() {});

        r2.write("foobar");
        r2.end();
        r1.copyFrom(r2);
        expect(dataSpy).not.toHaveBeenCalled();
        r1.end();
        expect(dataSpy).toHaveBeenCalledOnce();
    });
});
