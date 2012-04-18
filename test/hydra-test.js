var buster = require("buster");
var sinon = require("sinon");
var fs = require("fs");
var Hydra = require("../lib/hydra").Hydra;
var summonHydraBodyParts = require("../lib/hydra").summonHydraBodyParts;
var HydraHeadStatic = require("../lib/hydraHead").HydraHeadStatic;

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
        this.countHydraAdmin = !!arguments[2];
        if (! this.countHydraAdmin) {
            list = list.slice(1);
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
    path    = path    || '/.*';
    content = content || 'foo';
    return new HydraHeadStatic({name: name, path: path, content: content})
}

describe("Hydras", function() {
    it("can be created", function() {
        expect(new Hydra()).toBeDefined();
    });

    it("can't register plugins without heads", function() {
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
        var res = {send: sinon.spy()};
        hydra.handle({url: '/'}, res, function() {});
        expect(res.statusCode).toEqual(404);
        expect(res.send).toBeCalledWith('Not Found');
    });

    it("can dispatch a single, catch-all path", function() {
        var hydra = new Hydra();
        var content = 'It works!';
        var heads = [simpleHydraHead('/.*', content)];
        hydra.registerPluginObject({name: 'plugin1', heads: heads});
        var res = {send: sinon.spy()};
        hydra.handle({url: '/'}, res, function() {});
        expect(res.statusCode).toEqual(200);
        expect(res.send).toBeCalledWith(content);
    });

    it("traverse heads in order when dispatching", function() {
        var hydra = new Hydra();
        var content = 'It works!';
        var heads = [simpleHydraHead('/', content),
                     simpleHydraHead('/.*', 'Fail!')];
        hydra.registerPluginObject({name: 'plugin1', heads: heads});
        var res = {send: sinon.spy()};
        hydra.handle({url: '/'}, res, function() {});
        expect(res.statusCode).toEqual(200);
        expect(res.send).toBeCalledWith(content);
    });

    it("deliver 404 when there are routes, but none match", function() {
        var hydra = new Hydra();
        var heads = [simpleHydraHead('/foo'), simpleHydraHead('/bar')];
        hydra.registerPluginObject({name: 'plugin1', heads: heads});
        ['/', '/qux', '/foobar', '/foo/bar'].forEach(function(path) {
            var res = {send: function() {}};
            hydra.handle({url: path}, res, function() {});
            expect(res.statusCode).toEqual(404);
        });
    });

    it("respond correctly with a 404 when no routes match", function(done) {
        var hydra = new Hydra();
        var heads = [simpleHydraHead('/foo')];
        hydra.registerPluginObject({name: 'plugin1', heads: heads});
        var res = {send: function() {}};
        hydra.handle({url: '/'}, res, function() {
            expect(res.statusCode).toEqual(404);
            done();
        });
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
        expect(hydra).not().toHaveHeadAttached('plugin', 'head1');
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
        var res = {send: sinon.spy()};
        hydra.handle({url: path}, res, function() {
            expect(res.statusCode).toEqual(200);
            expect(res.send).toBeCalledWith('foo path');

            hydra.detachHead('plugin', 'head1');
            var res2 = {send: sinon.spy()};
            hydra.handle({url: path}, res2, function() {
                expect(res2.statusCode).toEqual(200);
                expect(res2.send).toBeCalledWith('catch-all');

                hydra.attachHead('plugin', 'head1');
                var res3 = {send: sinon.spy()};
                hydra.handle({url: path}, res3, function() {
                    expect(res3.statusCode).toEqual(200);
                    expect(res3.send).toBeCalledWith('foo path');
                    done();
                });
            });
        });
    });
});

describe("Hydra Head summoner", function() {
    it("fails with an empty definition", function() {
        expect(function() {
            new summonHydraBodyParts({})
        }).toThrow("InvalidHydraPluginException");
    });

    it("can summon an empty definition", function() {
        expect(new summonHydraBodyParts({heads: []})).toEqual({heads: []});
    });

    it("can summon a single Hydra Head", function() {
        var bodyPartDef = {heads: [{type: 'static',
                                    content: 'foo'}]};
        var bodyParts = new summonHydraBodyParts(bodyPartDef);
        expect(bodyParts.heads.length).toEqual(1);
        expect(bodyParts.heads[0]).toBeAHydraHead();
    });

    it("can summon multiple Hydra Heads", function() {
        var bodyPartDef = {heads: [{type: 'static',
                                    content: 'foo'},
                                   {type: 'generic',
                                    path: '/',
                                    handler: function() {}},
                                   {type: 'filesystem',
                                    basePath: '/',
                                    documentRoot: '/var/www/foo'},
                                   {type: 'proxy',
                                    basePath: '/',
                                    proxyTo: "http://example.com"}]};
        var bodyParts = new summonHydraBodyParts(bodyPartDef);
        expect(bodyParts.heads.length).toEqual(4);
        for (var i = 0, len = bodyParts.heads.lenght; i < len; i++) {
            expect(bodyParts.heads[i]).toBeAHydraHead();
        }
    });
});
