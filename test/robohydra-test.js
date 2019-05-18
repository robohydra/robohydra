/*global require, describe, it, before, Buffer */

var mocha = require("mocha");
var chai = require("chai"),
    expect = chai.expect;
var deepEql = require("deep-eql");
var path = require("path");
var RoboHydra = require("../lib/RoboHydra");
var utils         = require("../lib/utils"),
    Request       = utils.Request,
    Response      = utils.Response,
    resolveConfig = utils.resolveConfig,
    extendObject  = utils.extendObject;
var heads                  = require("../lib/heads"),
    RoboHydraHeadStatic    = heads.RoboHydraHeadStatic,
    RoboHydraHead          = heads.RoboHydraHead,
    RoboHydraWebSocketHead = heads.RoboHydraWebSocketHead;
var helpers              = require("./helpers"),
    simpleReq            = helpers.simpleReq,
    headWithFail         = helpers.headWithFail,
    headWithPass         = helpers.headWithPass,
    pluginInfoObject     = helpers.pluginInfoObject,
    pluginObjectFromPath = helpers.pluginObjectFromPath;
var exceptions = require('../lib/exceptions'),
    InvalidRoboHydraConfigurationException =
        exceptions.InvalidRoboHydraConfigurationException,
    InvalidRoboHydraPluginException =
        exceptions.InvalidRoboHydraPluginException,
    RoboHydraPluginNotFoundException =
        exceptions.RoboHydraPluginNotFoundException,
    RoboHydraHeadNotFoundException =
        exceptions.RoboHydraHeadNotFoundException,
    DuplicateRoboHydraHeadNameException =
        exceptions.DuplicateRoboHydraHeadNameException,
    InvalidRoboHydraHeadStateException =
        exceptions.InvalidRoboHydraHeadStateException,
    InvalidRoboHydraResponseException =
        exceptions.InvalidRoboHydraResponseException,
    InvalidRoboHydraNextParametersException =
        exceptions.InvalidRoboHydraNextParametersException,
    InvalidRoboHydraScenarioException =
        exceptions.InvalidRoboHydraScenarioException,
    RoboHydraException =
        exceptions.RoboHydraException;

chai.Assertion.addMethod('haveHeadAttached', function(pluginName, headName) {
    var actual = this._obj;

    this.assert(
        actual.isHeadAttached(pluginName, headName),
        "expected #{this} to have a head #{exp} attached",
        "expected #{this} to have a head #{exp} DETACHED",
        null,
        pluginName + "/" + headName
    );
});

chai.Assertion.addMethod('havePluginList', function(expectedList) {
    var actual = this._obj;
    var actualList = actual.getPluginNames().filter(function(pluginName) {
        return pluginName.indexOf("*") === -1;
    });
    var actualListFlat = actualList.join(",");
    var expectedListFlat = expectedList.join(",");

    this.assert(
        deepEql(actualListFlat, expectedListFlat),
        "expected #{this} to have these plugins: #{exp} (had: #{act})",
        "expected #{this} to NOT have these plugins: #{exp}",
        actualListFlat,
        expectedListFlat
    );
});

chai.Assertion.addMethod('havePluginWithHeadcount', function(pluginName, expectedHeadcount) {
    var actual = this._obj;
    var actualPluginHeadcount = actual.getPlugin(pluginName).heads.length;

    this.assert(
        actualPluginHeadcount === expectedHeadcount,
        "expected #{this} to have headcount: #{exp} (had: #{act})",
        "expected #{this} to NOT have headcount: #{exp}",
        actualPluginHeadcount,
        expectedHeadcount
    );
});

chai.Assertion.addMethod('haveBeenCalled', function() {
    var actual = this._obj;

    this.assert(
        actual.calls.length > 0,
        "expected #{this} to have been called",
        "expected #{this} to NOT have been called",
        actual.calls.length,
        null
    );
});

chai.Assertion.addMethod('haveBeenCalledOnce', function() {
    var actual = this._obj;

    this.assert(
        actual.calls.length === 1,
        "expected #{this} to have been called once (was: #{act})",
        "expected #{this} to NOT have been called once",
        actual.calls.length,
        null
    );
});

chai.Assertion.addMethod('haveBeenCalledWith', function(expectedCall) {
    var actual = this._obj;
    var lastCall = actual.calls[actual.calls.length - 1];

    this.assert(
        deepEql(lastCall[0], expectedCall),
        "expected #{this} to have been called once with #{exp} (was: #{act})",
        "expected #{this} to NOT have been called once with #{exp}",
        lastCall[0],
        expectedCall
    );
});

function simpleRoboHydraHead(path, content, moreProps) {
    "use strict";
    moreProps = moreProps || {};
    var props = extendObject({path:    path    || '/.*',
                              content: content || 'foo'},
                             moreProps);
    return new RoboHydraHeadStatic(props);
}

function simpleRoboHydraWebSocketHead(path, handler, moreProps) {
    "use strict";
    var props = extendObject({path:    path    || '/.*',
                              handler: handler || function() {}},
                             moreProps || {});
    return new RoboHydraWebSocketHead(props);
}

function spy() {
    var spyFunction = function() {
        spyFunction.calls.push([].slice.call(arguments, 0));
    };
    spyFunction.calls = [];

    return spyFunction;
}

describe("RoboHydras", function() {
    "use strict";

    it("can be created", function() {
        expect(new RoboHydra()).to.be.an('object');
    });

    it("can't have unknown/mistyped properties", function() {
        var hydra = new RoboHydra();
        expect(function() {
            hydra.registerPluginObject(pluginInfoObject({
                heds: []
            }));
        }).to.throw(InvalidRoboHydraPluginException);
    });

    it("can't register plugins without name", function() {
        var hydra = new RoboHydra();
        expect(function() {
            hydra.registerPluginObject(pluginInfoObject({
                name: undefined,
                heads: [new RoboHydraHeadStatic({content: 'foo'})]
            }));
        }).to.throw(InvalidRoboHydraPluginException);
    });

    it("can't register plugins with invalid names", function() {
        var hydra = new RoboHydra();
        var heads = [simpleRoboHydraHead()];

        ['', ' ', '..', 'foo.bar', 'foo/bar'].forEach(function(v) {
            expect(function() {
                hydra.registerPluginObject(pluginInfoObject({name: v,
                                                             heads: heads}));
            }).to.throw(InvalidRoboHydraPluginException);
        });
    });

    it("can register plugins with one head", function() {
        var hydra = new RoboHydra();
        hydra.registerPluginObject(pluginInfoObject({
            name: 'simple_plugin',
            heads: [simpleRoboHydraHead()]
        }));
        expect(hydra).to.havePluginList(['simple_plugin']);
        expect(hydra).to.havePluginWithHeadcount('simple_plugin', 1);
    });

    it("can register plugins with one scenario", function() {
        var hydra = new RoboHydra();
        hydra.registerPluginObject(pluginInfoObject({
            name: 'simple_plugin',
            scenarios: {simpleScenario:{heads:[]}}
        }));
        expect(hydra).to.havePluginList(['simple_plugin']);
    });

    it("can register plugins with websocket heads", function() {
        var hydra = new RoboHydra();
        hydra.registerPluginObject(pluginInfoObject({
            name: 'simple_plugin',
            heads: [simpleRoboHydraWebSocketHead()]
        }));
        expect(hydra).to.havePluginList(['simple_plugin']);
    });

    it("reject scenarios without heads", function() {
        var hydra = new RoboHydra();
        expect(function() {
            hydra.registerPluginObject(pluginInfoObject({
                name: 'simple_plugin',
                scenarios: {simpleScenario: {instructions: "No heads lol"}}
            }));
        }).to.throw(InvalidRoboHydraPluginException);
    });

    it("reject scenarios with unknown properties", function() {
        var hydra = new RoboHydra();
        expect(function() {
            hydra.registerPluginObject(pluginInfoObject({
                name: 'simple_plugin',
                scenarios: {simpleScenario: {heads: [],
                                             path: '/wat/no/staph/it'}}
            }));
        }).to.throw(InvalidRoboHydraPluginException);
    });

    it("can register plugins with one head and one scenario", function() {
        var hydra = new RoboHydra();
        hydra.registerPluginObject(pluginInfoObject({
            name: 'simple_plugin',
            heads: [simpleRoboHydraHead()],
            scenarios: {simpleScenario: {heads: []}}
        }));
        expect(hydra).to.havePluginList(['simple_plugin']);
    });

    it("can't register two plugins with the same name", function() {
        var hydra = new RoboHydra();
        var plugin1 = {name: 'simple_plugin',
                       heads: [simpleRoboHydraHead('/', 'foo')]};
        var plugin2 = {name: 'simple_plugin',
                       heads: [simpleRoboHydraHead('/.*', 'bar')]};
        hydra.registerPluginObject(pluginInfoObject(plugin1));
        expect(hydra).to.havePluginList(['simple_plugin']);
        expect(hydra).to.havePluginWithHeadcount('simple_plugin', 1);
        expect(function() {
            hydra.registerPluginObject(pluginInfoObject(plugin2));
        }).to.throw(InvalidRoboHydraConfigurationException);
    });

    it("can register several plugins", function() {
        var hydra = new RoboHydra();
        var plugin1 = {name: 'plugin1',
                       heads: [simpleRoboHydraHead('/robohydra-admin',
                                                   'RoboHydra Admin UI')]};
        var plugin2 = {name: 'plugin2',
                       heads: [simpleRoboHydraHead('/.*', 'Not Found')]};
        hydra.registerPluginObject(pluginInfoObject(plugin1));
        expect(hydra).to.havePluginList(['plugin1']);
        expect(hydra).to.havePluginWithHeadcount('plugin1', 1);
        hydra.registerPluginObject(pluginInfoObject(plugin2));
        expect(hydra).to.havePluginList(['plugin1', 'plugin2']);
        expect(hydra).to.havePluginWithHeadcount('plugin1', 1);
        expect(hydra).to.havePluginWithHeadcount('plugin2', 1);
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
                    expect(conf.myConfVariable).to.equal(value);
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
                    expect(conf.configKey).to.equal(overridenConfigKeyValue);
                    expect(conf.newConfigKey).to.equal(newConfigKeyValue);
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
        expect(p.name).to.equal('plugin1');
    });

    it("throw an exception when getting a non-existent plugin by name", function() {
        var hydra = new RoboHydra();
        var plugin1 = {name: 'plugin1',
                       heads: [simpleRoboHydraHead('/.*', 'Not Found')]};
        hydra.registerPluginObject(pluginInfoObject(plugin1));
        expect(function() {
            hydra.getPlugin("plugin11");
        }).to.throw(RoboHydraPluginNotFoundException);
    });

    it("consider all paths 404 when there are no plugins", function() {
        var hydra = new RoboHydra();
        hydra.handle(simpleReq('/'),
                     new Response(function() {
                         expect(this.statusCode).to.equal(404);
                         expect(this.body).to.haveEqualBody('Not Found');
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
                         expect(this.statusCode).to.equal(200);
                         expect(this.body).to.haveEqualBody(content);
                     }));
    });

    it("traverse heads in order when dispatching", function(done) {
        var hydra = new RoboHydra();
        var content = 'It works!';
        var heads = [simpleRoboHydraHead('/', content),
                     simpleRoboHydraHead('/.*', 'Fail!')];
        hydra.registerPluginObject(pluginInfoObject({name: 'plugin1',
                                                     heads: heads}));
        hydra.handle(simpleReq('/'),
                     new Response(function() {
                         expect(this.statusCode).to.equal(200);
                         expect(this.body).to.haveEqualBody(content);
                         done();
                     }));
    });

    it("deliver 404 when there are routes, but none match", function() {
        var hydra = new RoboHydra();
        var heads = [simpleRoboHydraHead('/foo'), simpleRoboHydraHead('/bar')];
        hydra.registerPluginObject(pluginInfoObject({
            name: 'plugin1',
            heads: heads
        }));
        ['/', '/qux', '/foobar', '/foo/bar', '/bar/foo'].forEach(function(path) {
            hydra.handle(simpleReq(path),
                         new Response(function() {
                             expect(this.statusCode).to.equal(404);
                         }));
        });
    });

    it("respond correctly with a 404 when no routes match", function(done) {
        var hydra = new RoboHydra();
        var heads = [simpleRoboHydraHead('/foo')];
        hydra.registerPluginObject(pluginInfoObject({name: 'plugin1',
                                                     heads: heads}));
        hydra.handle(simpleReq('/'), new Response(function() {
            expect(this.statusCode).to.equal(404);
            done();
        }));
    });

    it("don't allow registering a plugin with duplicate head names", function() {
        var hydra = new RoboHydra();
        var heads = [simpleRoboHydraHead('/foo', 'dummy', {name: 'name'}),
                     simpleRoboHydraHead('/bar', 'dummy', {name: 'name'})];
        expect(function() {
            hydra.registerPluginObject(pluginInfoObject({name: 'plugin1',
                                                         heads: heads}));
        }).to.throw(DuplicateRoboHydraHeadNameException);
        expect(hydra).to.havePluginList([]);
    });

    it("allow registering different plugins with common head names", function() {
        var hydra = new RoboHydra();
        var headsPlugin1 = [simpleRoboHydraHead('/foo',
                                                'content',
                                                {name: 'head1'}),
                            simpleRoboHydraHead('/bar',
                                                'content',
                                                {name: 'head2'})];
        var headsPlugin2 = [simpleRoboHydraHead('/foo',
                                                'content',
                                                {name: 'head1'}),
                            simpleRoboHydraHead('/bar',
                                                'content',
                                                {name: 'head2'})];
        hydra.registerPluginObject(pluginInfoObject({name: 'plugin1',
                                                     heads: headsPlugin1}));
        hydra.registerPluginObject(pluginInfoObject({name: 'plugin2',
                                                     heads: headsPlugin2}));
        expect(hydra).to.havePluginList(['plugin1', 'plugin2']);
        expect(hydra).to.havePluginWithHeadcount('plugin1', 2);
        expect(hydra).to.havePluginWithHeadcount('plugin2', 2);
    });

    it("find existing heads", function() {
        var hydra = new RoboHydra();
        var heads = [simpleRoboHydraHead('/foo', 'foo path',  {name: 'head1'}),
                     simpleRoboHydraHead('/.*',  'catch-all', {name: 'head2'})];
        hydra.registerPluginObject(pluginInfoObject({name: 'plugin',
                                                     heads: heads}));

        expect(hydra.findHead('plugin', 'head1').name).to.equal('head1');
        expect(hydra.findHead('plugin', 'head2').name).to.equal('head2');
    });

    it("throw an error when finding non-existing heads", function() {
        var hydra = new RoboHydra();
        var heads = [simpleRoboHydraHead('/foo', 'foo path',  {name: 'head1'}),
                     simpleRoboHydraHead('/.*',  'catch-all', {name: 'head2'})];
        hydra.registerPluginObject(pluginInfoObject({name: 'plugin',
                                                     heads: heads}));

        expect(function() {
            hydra.findHead('plugin1', 'head1');
        }).to.throw(RoboHydraHeadNotFoundException);
        expect(function() {
            hydra.findHead('plugin', 'head3');
        }).to.throw(RoboHydraHeadNotFoundException);
        expect(function() {
            hydra.findHead('plugin', 'head22');
        }).to.throw(RoboHydraHeadNotFoundException);
        expect(function() {
            hydra.findHead('_plugin', 'head2');
        }).to.throw(RoboHydraHeadNotFoundException);
    });

    it("allow attaching and detaching heads", function() {
        var hydra = new RoboHydra();
        var heads = [simpleRoboHydraHead('/foo', 'foo path', {name: 'head1'})];
        hydra.registerPluginObject(pluginInfoObject({name: 'plugin',
                                                     heads: heads}));

        hydra.detachHead('plugin', 'head1');
        expect(hydra).not.to.haveHeadAttached('plugin', 'head1');
        hydra.attachHead('plugin', 'head1');
        expect(hydra).to.haveHeadAttached('plugin', 'head1');
    });

    it("throw an error when attaching/detaching non-existing heads", function() {
        var hydra = new RoboHydra();
        var heads = [simpleRoboHydraHead('/foo', 'foo path', {name: 'head1'})];
        hydra.registerPluginObject(pluginInfoObject({name: 'plugin',
                                                     heads: heads}));

        expect(function() {
            hydra.detachHead('plugin', 'head2');
        }).to.throw(RoboHydraHeadNotFoundException);
        expect(function() {
            hydra.detachHead('plugin2', 'head1');
        }).to.throw(RoboHydraHeadNotFoundException);
        expect(function() {
            hydra.detachHead('_plugin', 'head1');
        }).to.throw(RoboHydraHeadNotFoundException);
    });

    it("throw an error when attaching/detaching already attached/detached heads", function() {
        var hydra = new RoboHydra();
        var heads = [simpleRoboHydraHead('/foo', 'foo path', {name: 'head1'})];
        hydra.registerPluginObject(pluginInfoObject({name: 'plugin',
                                                     heads: heads}));

        expect(function() {
            hydra.attachHead('plugin', 'head1');
        }).to.throw(InvalidRoboHydraHeadStateException);
        hydra.detachHead('plugin', 'head1');
        expect(function() {
            hydra.detachHead('plugin', 'head1');
        }).to.throw(InvalidRoboHydraHeadStateException);
    });

    it("skips detached heads when dispatching", function(done) {
        var hydra = new RoboHydra();
        var path = '/foo';
        var heads = [simpleRoboHydraHead(path,  'foo path', {name: 'head1'}),
                     simpleRoboHydraHead('/.*', 'catch-all', {name: 'head2'})];
        hydra.registerPluginObject(pluginInfoObject({name: 'plugin',
                                                     heads: heads}));
        hydra.handle(simpleReq(path), new Response(function() {
            expect(this.statusCode).to.equal(200);
            expect(this.body).to.haveEqualBody('foo path');

            hydra.detachHead('plugin', 'head1');
            hydra.handle(simpleReq(path), new Response(function() {
                expect(this.statusCode).to.equal(200);
                expect(this.body).to.haveEqualBody('catch-all');

                hydra.attachHead('plugin', 'head1');
                hydra.handle(simpleReq(path), new Response(function() {
                    expect(this.statusCode).to.equal(200);
                    expect(this.body).to.haveEqualBody('foo path');
                    done();
                }));
            }));
        }));
    });

    it("can create additional heads dynamically", function(done) {
        var hydra = new RoboHydra();
        var path = '/foo';

        hydra.registerDynamicHead(simpleRoboHydraHead(path, 'some content'));
        expect(hydra).to.havePluginWithHeadcount('*dynamic*', 1);

        hydra.handle(simpleReq(path), new Response(function() {
            expect(this.body).to.haveEqualBody('some content');
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
            expect(this.body).to.haveEqualBody(content2);
            done();
        }));
    });

    it("can create additional heads dynamically with explicit priority", function(done) {
        var hydra = new RoboHydra();
        var path = '/foo';

        hydra.registerDynamicHead(simpleRoboHydraHead(path, 'some content'),
                                  {priority: 'normal'});
        expect(hydra).to.havePluginWithHeadcount('*dynamic*', 1);

        hydra.handle(simpleReq(path), new Response(function() {
            expect(this.body).to.haveEqualBody('some content');
            done();
        }));
    });

    it("can create additional high priority heads dynamically", function(done) {
        var hydra = new RoboHydra();
        var path = '/foo';

        hydra.registerDynamicHead(simpleRoboHydraHead(path, 'some content'),
                                  {priority: 'high'});
        expect(hydra).to.havePluginWithHeadcount('*priority-dynamic*', 1);

        hydra.handle(simpleReq(path), new Response(function() {
            expect(this.body).to.haveEqualBody('some content');
            done();
        }));
    });

    it("can create admin priority heads dynamically", function(done) {
        var hydra = new RoboHydra();
        var path = '/robohydra-admin';

        hydra.registerDynamicHead(simpleRoboHydraHead(path, "NO ADMIN 4 U"),
                                  {priority: 'admin'});
        expect(hydra).to.havePluginWithHeadcount('*admin-dynamic*', 1);

        hydra.handle(simpleReq(path), new Response(function() {
            expect(this.body).to.haveEqualBody("NO ADMIN 4 U");
            done();
        }));
    });

    it("throw exceptions on wrong priority for dynamic heads", function() {
        var hydra = new RoboHydra();

        expect(function() {
            hydra.registerDynamicHead(simpleRoboHydraHead('/foo',
                                                          'some content'),
                                      {priority: 'normall'});
        }).to.throw(RoboHydraException);
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
        expect(hydra).to.havePluginWithHeadcount('*priority-dynamic*', 2);
        expect(hydra).to.havePluginWithHeadcount('*dynamic*', 1);

        hydra.handle(simpleReq(path1), new Response(function() {
            expect(this.body).to.haveEqualBody(highPrioContent);
            hydra.handle(simpleReq(path2), new Response(function() {
                expect(this.body).to.haveEqualBody(highPrioContent);
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
            expect(this.body).to.haveEqualBody(content1);
            hydra.handle(simpleReq(path2), new Response(function() {
                expect(this.body).to.haveEqualBody(content2);
                done();
            }));
        }));
    });

    it("can find dynamic heads", function() {
        var hydra = new RoboHydra();
        var path = '/foo', content = 'some content', name = 'head1';

        hydra.registerDynamicHead(simpleRoboHydraHead(path, content, {name: name}));
        var dynamicHead = hydra.findHead('*dynamic*', name);
        expect(dynamicHead).to.be.an('object');
    });

    it("can detach dynamic heads", function(done) {
        var hydra = new RoboHydra();
        var path = '/foo', content = 'some content', name = 'head1';

        hydra.registerDynamicHead(simpleRoboHydraHead(path,
                                                      content,
                                                      {name: name}));

        hydra.handle(simpleReq(path), new Response(function() {
            expect(this.body).to.haveEqualBody(content);

            hydra.detachHead('*dynamic*', name);
            hydra.handle(simpleReq(path), new Response(function() {
                expect(this.statusCode).to.equal(404);
                done();
            }));
        }));
    });

    it("can detach one dynamic head and leave the rest working", function(done) {
        var hydra = new RoboHydra();
        var path1 = '/foo', content1 = 'some content',  name1 = 'head1';
        var path2 = '/bar', name2 = 'head2';

        hydra.registerDynamicHead(simpleRoboHydraHead(path1,
                                                      content1,
                                                      {name: name1}));
        hydra.registerDynamicHead(simpleRoboHydraHead(path2,
                                                      'whatever',
                                                      {name: name2}));
        hydra.detachHead('*dynamic*', name2);

        hydra.handle(simpleReq(path1), new Response(function() {
            expect(this.body).to.haveEqualBody(content1);
            done();
        }));
    });

    it("assign different names to unnamed dynamic heads", function() {
        var hydra = new RoboHydra();
        hydra.registerDynamicHead(simpleRoboHydraHead());
        hydra.registerDynamicHead(simpleRoboHydraHead());

        var dynamicHeads = hydra.getPlugin('*dynamic*').heads;
        expect(dynamicHeads[0].name).not.to.equal(dynamicHeads[1].name);
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
            expect(resultList).to.eql(['headCallingNext', 'headBeingCalled']);
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
            expect(resultList).to.eql(['headCallingNext',
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
            expect(finalRes.statusCode).to.equal(404);
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
                }).to.throw(InvalidRoboHydraNextParametersException);
                res.end();
            }});
        hydra.registerDynamicHead(headCallingNext);
        hydra.handle(simpleReq('/foo'), new Response(function() { done(); }));
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
            expect(this.statusCode).to.equal(500);
            expect(this.body.toString()).to.match(new RegExp('dying'));
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
        expect(Object.keys(hydra.getPlugin(pluginName).scenarios)).to.eql(
            ['firstScenario']);
    });

    it("can load scenarios from both external files and main file", function() {
        var hydra = new RoboHydra();
        var pluginName = 'external-scenarios-mixed';
        var pluginPath = path.join(__dirname, 'plugins', pluginName);
        hydra.registerPluginObject(pluginObjectFromPath(pluginPath));
        expect(Object.keys(hydra.getPlugin(pluginName).scenarios).sort()).to.eql(
            ['external', 'internal']);
    });

    it("can load a plugin without heads, and with only external scenarios", function() {
        var hydra = new RoboHydra();
        var pluginName = 'external-scenarios-headless';
        var pluginPath = path.join(__dirname, 'plugins', pluginName);
        hydra.registerPluginObject(pluginObjectFromPath(pluginPath));
        var scenarios = Object.keys(hydra.getPlugin(pluginName).scenarios);
        expect(scenarios.sort()).to.eql(['firstTest', 'secondTest']);
    });

    it("doesn't allow internal and external scenarios with the same name", function() {
        var hydra = new RoboHydra();
        var pluginName = 'external-scenarios-conflicting-names';
        var pluginPath = path.join(__dirname, 'plugins', pluginName);
        expect(function() {
            hydra.registerPluginObject(pluginObjectFromPath(pluginPath));
        }).to.throw(InvalidRoboHydraPluginException);
    });
});

describe("RoboHydra scenario system", function() {
    "use strict";

    it("has '*default*' as the default scenario", function() {
        var hydra = new RoboHydra();
        expect(hydra.currentScenario).to.eql({plugin: '*default*',
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
        expect(hydra.currentScenario).to.eql({plugin: 'plugin',
                                              scenario: 'simpleTest'});
    });

    it("throws an exception when starting non-existent scenarios", function() {
        var hydra = new RoboHydra();
        expect(function() {
            hydra.startScenario('plugin', 'simpleTest');
        }).to.throw(InvalidRoboHydraScenarioException);
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
        expect(hydra.currentScenario).to.eql({plugin:   '*default*',
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
        expect(hydra.currentScenario).to.eql({plugin:   'plugin2',
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
            expect(this.statusCode).to.equal(404);
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
            expect(this.statusCode).to.equal(200);
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
            expect(this.body).to.haveEqualBody(content1);
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
            expect(evt.response.body.toString()).to.equal(resp1);
            hydra.startScenario('plugin', 'someTest');
            hydra.handle(simpleReq('/'), new Response(function(evt2) {
                expect(evt2.response.body.toString()).to.equal(resp1);
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
            expect(this.statusCode).to.equal(404);
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
            expect(res.statusCode).to.equal(404);

            var res2 = new Response(function() {
                expect(res2.statusCode).to.equal(200);
                done();
            });
            hydra.handle(new Request({url: path2}), res2);
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
        expect(hydra).to.haveTestResult('plugin',
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
                expect(hydra).to.haveTestResult('plugin', 'testWithAssertion',
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
                expect(hydra).to.haveTestResult('plugin',
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
                        expect(hydra).to.haveTestResult(
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
                expect(hydra).to.haveTestResult('plugin',
                                                'testWithAssertion',
                                                {result: 'fail',
                                                 passes: [],
                                                 failures: [failMessage]});
                hydra.startScenario('plugin', 'testWithAssertion');
                expect(hydra).to.haveTestResult('plugin',
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
                expect(hydra).to.haveTestResult('*default*',
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
                expect(hydra).to.haveTestResult('*default*',
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
                expect(hydra).to.haveTestResult('plugin',
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
                expect(hydra).to.haveTestResult('plugin',
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
            scenarios: {scenarioWithAssertion: {heads: []},
                        anotherTest:           {heads: []}}
        }));
        hydra.startScenario('plugin', 'scenarioWithAssertion');
        hydra.handle(
            simpleReq('/p'),
            new Response(function() {
                hydra.startScenario('plugin', 'anotherTest');
                expect(hydra).to.haveTestResult('plugin',
                                                'scenarioWithAssertion',
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
                expect(executesAfterAssertion).to.be.true;
                expect(testResult).to.be.false;
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
                expect(executesAfterAssertion).to.be.true;
                expect(testResult).to.be.true;
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
                expect(hydra).to.haveTestResult(
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
        expect(hydra.getPlugin('plugin').scenarios.testWithInstructions.instructions).to.equal(instructions);
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
                              expect(this.body.toString()).to.match(
                                  new RegExp('Simple fixture'));
                              done();
                          }));
    });

    it("fails when the fixture doesn't exist", function(done) {
        this.hydra.handle(simpleReq('/fixtures/non-existent'),
                          new Response(function() {
                              expect(this.statusCode).to.equal(500);
                              done();
                          }));
    });

    it("loads non-ASCII fixtures", function(done) {
        this.hydra.handle(simpleReq('/fixtures/non-ascii.txt'),
                          new Response(function() {
                              expect(this.body.toString()).to.equal(
                                  'Velázquez\n');
                              done();
                          }));
    });

    it("doesn't try to load fixtures from other directories", function(done) {
        this.hydra.handle(simpleReq('/absolute-directory-fixture'),
                          new Response(function() {
                              expect(this.body.toString()).to.equal(
                                  'This is a fake /etc/passwd\n');
                              done();
                          }));
    });

    it("doesn't allow leaving the fixture directory", function(done) {
        this.hydra.handle(simpleReq('/relative-directory-fixture'),
                          new Response(function() {
                              expect(this.body.toString()).to.equal(
                                  'This is a fake /etc/passwd\n');
                              done();
                          }));
    });

    it("works from external tests", function(done) {
        this.hydra.startScenario('simple-fixtures', 'fixtureLoader');
        this.hydra.handle(simpleReq('/external-test-fixture'),
                          new Response(function() {
                              expect(this.body.toString()).to.equal(
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
        expect(req.bodyParams.foo).to.equal("bar");
        expect(req.bodyParams.qux).to.equal("meh");
    });

    it("doesn't freak out if there's no body", function() {
        expect(function() {
            /*jshint nonew: false*/
            new Request({url: '/foo/bar'});
        }).not.to.throw();
    });

    it("normalises the HTTP method name", function() {
        var req = new Request({url: '/foo/bar', method: 'PoSt'});
        expect(req.method).to.equal('POST');
    });

    describe("body property", function() {
        it("is null for useless content-type headers", function() {
            var data = new Buffer("Here is some data"),
                reqNoCT = new Request({url: '/foo/bar', rawBody: data}),
                reqEmptyCT = new Request({url: '/foo/bar',
                                          rawBody: data,
                                          headers: {'content-type': ''}}),
                reqInvalidCT = new Request({url: '/foo/bar',
                                            rawBody: data,
                                            headers: {'content-type': 'blah'}}),
                reqOctetStm = new Request({url: '/foo/bar',
                                           rawBody: data,
                                           headers: {'content-type': 'application/octet-stream'}}),
                reqTextXml = new Request({url: '/foo/bar',
                                          rawBody: new Buffer("<madeup/>"),
                                          headers: {'content-type': 'application/octet-stream'}});

            expect(reqNoCT.body).to.equal(null);
            expect(reqEmptyCT.body).to.equal(null);
            expect(reqInvalidCT.body).to.equal(null);
            expect(reqOctetStm.body).to.equal(null);
            expect(reqTextXml.body).to.equal(null);
        });

        it("is an object for 'application/json' content type", function() {
            var obj = {a: 'banana'};
            var data = new Buffer(JSON.stringify(obj));
            var req = new Request({url: '/foo/bar',
                                   rawBody: data,
                                   headers: {'content-type': 'application/json'}});

            expect(req.body).to.eql(obj);
        });

        it("is null for 'application/json' content type but invalid JSON", function() {
            var data = new Buffer('banana');
            var req = new Request({url: '/foo/bar',
                                   rawBody: data,
                                   headers: {'content-type': 'application/json' }});

            expect(req.body).to.equal(null);
        });

        it("is null for 'application/json' content type but invalid 'charset'", function() {
            var obj = { a: 'banana' };
            var data = new Buffer(JSON.stringify(obj));
             var req = new Request({url: '/foo/bar',
                                   rawBody: data,
                                   headers: {'content-type': 'application/json',
                                             'charset': 'utf-16' }});

            expect(req.body).to.equal(null);
        });

        it("is a valid string for 'text/html' content type", function() {
            var data = new Buffer("<h2>Some</h2> <h1>html-marked-up</h1> <b>text</b>");
            var req = new Request({url: '/foo/bar',
                                   rawBody: data,
                                   headers: {'content-type': 'text/html'}});

            expect(req.body).to.equal(data.toString());
        });

        it("is a valid string for 'text/plain' content-type", function() {
            var data = new Buffer("Some plaintext");
            var req = new Request({url: '/foo/bar',
                                   rawBody: data,
                                   headers: {'content-type': 'text/plain'}});

            expect(req.body).to.equal(data.toString());
        });

        it("picks up charset from 2-part content-type headers", function() {
            var data = new Buffer("Some plaintext");

            expect(function() {
                /*jshint nonew: false*/
                new Request({url: '/foo/bar',
                                   rawBody: data,
                                   headers: {'content-type': 'text/plain;charset=UTF-8' }});
            }).not.to.throw();
        });

        it("picks up charset from the actual charset header", function() {
            var targetCharset = 'utf-8';
            var data = new Buffer("Some plaintext");
            var req = new Request({url: '/foo/bar',
                                   rawBody: data,
                                   headers: {'content-type': 'text/plain',
                                             'charset': targetCharset }});

            expect(req.body).to.equal(data.toString(targetCharset.replace('-', '')));
        });

        it("prefers charset header to the value in content-type", function() {
            var targetCharset = 'utf-8';
            var charsetToAvoid = 'UTF-16';
            var data = new Buffer("Some plaintext");
            var req = new Request({url: '/foo/bar',
                                   rawBody: data,
                                   headers: {'content-type': 'text/plain;charset=' + charsetToAvoid,
                                             'charset': targetCharset }});

            expect(req.body).to.equal(data.toString(targetCharset.replace('-', '')));
        });

        it("is null for invalid charsets", function() {
            var targetCharset = 'bananas';
            var data = new Buffer("Some plaintext");
            var plainreq;
            var htmlreq;
            
            expect(function() {
                plainreq = new Request({url: '/foo/bar',
                                   rawBody: data,
                                   headers: {'content-type': 'text/plain',
                                             'charset': targetCharset }});    
            }).not.to.throw();
            expect(plainreq.body).to.equal(null);

            expect(function() {
                htmlreq = new Request({url: '/foo/bar',
                                   rawBody: data,
                                   headers: {'content-type': 'text/html',
                                             'charset': targetCharset }});    
            }).not.to.throw();
            expect(htmlreq.body).to.equal(null);
        });

        it("check that body parses x-www-form-urlencoded, too", function () {
            var req = new Request({url: '/',
                                   rawBody: "foo=bar&qux=fluxx",
                                   headers: {'content-type': 'application/x-www-form-urlencoded'}});
            expect(req.body.foo).to.equal("bar");
            expect(req.body.qux).to.equal("fluxx");
        });
    });
});

describe("Response object", function() {
    "use strict";

    it("can't be used without an 'end' handler", function() {
        var r = new Response();
        expect(function() {
            r.end();
        }).to.throw(InvalidRoboHydraResponseException);
    });

    it("supports basic observers", function() {
        var headHandler = spy();
        var dataHandler = spy();
        var endHandler  = spy();
        var r = new Response().on('head', headHandler).
                               on('data', dataHandler).
                               on('end',  endHandler);
        r.writeHead(200);
        expect(headHandler).to.haveBeenCalled();
        expect(dataHandler).not.to.haveBeenCalled();
        expect(endHandler).not.to.haveBeenCalled();
        r.write("");
        expect(dataHandler).to.haveBeenCalled();
        expect(endHandler).not.to.haveBeenCalled();
        r.end();
        expect(endHandler).to.haveBeenCalled();
    });

    it("supports more than one listener for each event", function() {
        var headHandler1 = spy();
        var dataHandler1 = spy();
        var endHandler1  = spy();
        var headHandler2 = spy();
        var dataHandler2 = spy();
        var endHandler2  = spy();
        var r = new Response().on('head', headHandler1).
                               on('data', dataHandler1).
                               on('end',  endHandler1).
                               on('head', headHandler2).
                               on('data', dataHandler2).
                               on('end',  endHandler2);
        r.write("");
        r.end();
        expect(headHandler1).to.haveBeenCalled();
        expect(dataHandler1).to.haveBeenCalled();
        expect(endHandler1).to.haveBeenCalled();
        expect(headHandler2).to.haveBeenCalled();
        expect(dataHandler2).to.haveBeenCalled();
        expect(endHandler2).to.haveBeenCalled();
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
        expect(callOrder).to.eql(["head", "data", "end"]);
    });

    it("doesn't produce a head event if writeHead was called", function() {
        var headHandler = spy();
        var r = new Response().on('head', headHandler).
                               on('end',  spy());
        r.writeHead(200);
        r.write("");
        expect(headHandler).to.haveBeenCalledOnce();
    });

    it("doesn't produce a head event if one was produced already", function() {
        var headHandler = spy();
        var r = new Response().on('head', headHandler).
                               on('end',  spy());
        r.write("");
        r.write("");
        expect(headHandler).to.haveBeenCalledOnce();
    });

    it("calls explicit 'head' event handler with empty header object if no headers", function() {
        var headHandler = spy();
        var r = new Response().on('head', headHandler).
                               on('end',  spy());
        var statusCode = 200;
        r.writeHead(statusCode);
        expect(headHandler).to.haveBeenCalledWith({type: 'head',
                                                   statusCode: statusCode,
                                                   headers: {}});
    });

    it("calls implicit 'head' event handler with empty header object if no headers", function() {
        var headHandler = spy();
        var r = new Response().on('head', headHandler).
                               on('end',  spy());
        var statusCode = 200;
        r.statusCode = statusCode;
        r.write("");
        expect(headHandler).to.haveBeenCalledWith({type: 'head',
                                                   statusCode: statusCode,
                                                   headers: {}});
    });

    it("calls implicit 'head' event with correct headers", function() {
        var headHandler = spy();
        var r = new Response().on('head', headHandler).
                               on('end',  spy());
        var statusCode = 200, headers = {foobar: 'qux'};
        r.statusCode = statusCode;
        r.headers    = headers;
        r.write("");
        expect(headHandler).to.haveBeenCalledWith({type: 'head',
                                                   statusCode: statusCode,
                                                   headers: headers});
    });

    it("produces a head event on (but before!) 'end', if there was no data", function() {
        var callOrder = [];
        var statusCode = 302, locationHeader = 'http://example.com';
        var r = new Response().
            on('head', function(evt) {
                var sc = evt.statusCode, h = evt.headers;
                expect(sc).to.equal(statusCode);
                expect(h.location).to.equal(locationHeader);
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
        expect(callOrder).to.eql(["head", "end"]);
    });

    it("doesn't produce a head event on 'end', if there was one already", function() {
        var callOrder = [];
        var statusCode = 302, locationHeader = 'http://example.com';
        var r = new Response().
            on('head', function(evt) {
                var sc = evt.statusCode, h = evt.headers;
                expect(sc).to.equal(statusCode);
                expect(h.location).to.equal(locationHeader);
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
        expect(callOrder).to.eql(["head", "end"]);
    });

    it("allows easy response chaining (deprecated)", function() {
        var headHandler = spy();
        var dataHandler = spy();
        var endHandler  = spy();
        var r1 = new Response().on('head', headHandler).
                                on('data', dataHandler).
                                on('end',  endHandler);
        var r2 = new Response().chain(r1);

        // Do things on r2, expect them to happen on r1
        var statusCode = 200, headers = {foobar: 'qux'};
        r2.writeHead(statusCode, headers);
        expect(headHandler).to.haveBeenCalledWith({type: 'head',
                                                   statusCode: statusCode,
                                                   headers: headers});
        var buffer = new Buffer("foobar");
        r2.write(buffer);
        expect(dataHandler).to.haveBeenCalledWith({type: 'data',
                                                   data: buffer});
        var buffer2 = new Buffer("qux");
        r2.write(buffer2);
        expect(dataHandler).to.haveBeenCalledWith({type: 'data',
                                                   data: buffer2});
        r2.end();
        expect(endHandler).to.haveBeenCalledWith({type: 'end',
                                                  response: r1});
    });

    it("allows follow other responses", function() {
        var headHandler = spy();
        var dataHandler = spy();
        var endHandler  = spy();
        var r1 = new Response().on('head', headHandler).
                                on('data', dataHandler).
                                on('end',  endHandler);
        var r2 = r1.follow(new Response());

        // Do things on r2, expect them to happen on r1
        var statusCode = 200, headers = {foobar: 'qux'};
        r2.writeHead(statusCode, headers);
        expect(headHandler).to.haveBeenCalledWith({type: 'head',
                                                   statusCode: statusCode,
                                                   headers: headers});
        var buffer = new Buffer("foobar");
        r2.write(buffer);
        expect(dataHandler).to.haveBeenCalledWith({type: 'data',
                                                   data: buffer});
        var buffer2 = new Buffer("qux");
        r2.write(buffer2);
        expect(dataHandler).to.haveBeenCalledWith({type: 'data',
                                                   data: buffer2});
        r2.end();
        expect(endHandler).to.haveBeenCalledWith({type: 'end',
                                                  response: r1});
    });

    it("triggers implicit head events when chaining (deprecated)", function() {
        var headHandler = spy();
        var r1 = new Response().on('head', headHandler).
                                on('data', spy()).
                                on('end',  spy());
        var r2 = new Response().chain(r1);

        // Do things on r2, expect them to happen on r1
        var statusCode = 200, headers = {foobar: 'qux'};
        r2.statusCode = statusCode;
        r2.headers    = headers;
        r2.write("foobar");
        expect(headHandler).to.haveBeenCalledWith({type: 'head',
                                                   statusCode: statusCode,
                                                   headers: headers});
    });

    it("triggers implicit head events when following", function() {
        var headHandler = spy();
        var r1 = new Response().on('head', headHandler).
                                on('data', spy()).
                                on('end',  spy());
        var r2 = r1.follow(new Response());

        // Do things on r2, expect them to happen on r1
        var statusCode = 200, headers = {foobar: 'qux'};
        r2.statusCode = statusCode;
        r2.headers    = headers;
        r2.write("foobar");
        expect(headHandler).to.haveBeenCalledWith({type: 'head',
                                                   statusCode: statusCode,
                                                   headers: headers});
    });

    it("doesn't write an empty body when copying responses", function() {
        var r1 = new Response(function() {});
        r1.write = spy();
        var r2 = new Response(function() {});

        r2.statusCode = 200;
        r2.end();
        r1.copyFrom(r2);
        r1.end();
        expect(r1.write).not.to.haveBeenCalled();
    });

    it("doesn't break streaming when using copyFrom", function() {
        var dataSpy = spy();
        var r1 = new Response().on('data', dataSpy).on('end', function() {});
        r1.write = spy();
        var r2 = new Response(function() {});

        r2.write("foobar");
        r2.end();
        r1.copyFrom(r2);
        expect(dataSpy).not.to.haveBeenCalled();
        r1.end();
        expect(dataSpy).to.haveBeenCalledOnce();
    });
});

describe("Configuration resolver", function() {
    it("should return simple, correct configuration as-is", function() {
        var config = {plugins: [{name: "logger", config: {}}]};
        expect(resolveConfig(config)).to.eql(config);
    });

    it("should reject configurations with unknown keys", function() {
        var config = {plugins: ["logger"],
                      madeUpKey: true};
        expect(function() {
            resolveConfig(config);
        }).to.throw(InvalidRoboHydraConfigurationException);
    });

    it("should accept all valid configuration keys", function() {
        var config = {plugins: [{name: "logger", config: {}}],
                      pluginConfigDefaults: {},
                      pluginLoadPaths: [],
                      summoner: {},
                      secure: false,
                      sslOptions: {},
                      port: 3001,
                      quiet: false};
        expect(resolveConfig(config)).to.eql(config);
    });

    it("should inject default configuration into plugin configurations", function() {
        var config = {pluginConfigDefaults: {foo: "bar"},
                      plugins: [{name: "logger", config: {}}]};
        expect(resolveConfig(config).plugins[0].config.foo).to.equal("bar");
    });

    it("should inject plugin defaults also in compact notation", function() {
        var config = {pluginConfigDefaults: {foo: "bar"},
                      plugins: ["logger"]};
        expect(resolveConfig(config).plugins[0].config.foo).to.equal("bar");
    });

    it("should never mix configuration from different plugins", function() {
        var config = {pluginConfigDefaults: {foo: "bar"},
                      plugins: ["logger",
                                {"name": "blah",
                                 "config": {
                                     "foo": "fail"
                                 }}]};
        expect(resolveConfig(config).plugins[0].config.foo).not.to.equal("fail");
    });
});
