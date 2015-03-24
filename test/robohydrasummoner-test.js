/*global require, describe, it*/

var buster = require("buster");
var RoboHydraSummoner = require('../lib/robohydrasummoner').RoboHydraSummoner;
var Request = require("../lib/utils").Request;
var path = require('path');

buster.spec.expose();
var expect = buster.expect;

describe("RoboHydra picking system", function() {
    "use strict";

    it("detects multiple picking functions and fails to load", function() {
        expect(function() {
            /*jshint nonew: false*/
            new RoboHydraSummoner(
                [{name: 'simple-authenticator', config: {}},
                 {name: 'url-query-authenticator', config: {}}],
                {},
                {rootDir: __dirname + '/plugin-fs'}
            );
        }).toThrow('InvalidRoboHydraConfigurationException');
    });

    it("can specify a picking function when there are multiple", function() {
        var summoner = new RoboHydraSummoner(
            [{name: 'simple-authenticator', config: {}},
             {name: 'url-query-authenticator', config: {}}],
            {hydraPickerPlugin: 'simple-authenticator'},
            {rootDir: __dirname + '/plugin-fs'}
        );
        var h = summoner.summonRoboHydraForRequest(new Request({url: '/'}));
        expect(h.name).toEqual('simple-authenticator-fixed-user');
    });

    it("detects non-existent, specified picking functions", function() {
        expect(function() {
            /*jshint nonew: false */
            new RoboHydraSummoner(
                [{name: 'simple-authenticator', config: {}},
                 {name: 'url-query-authenticator', config: {}}],
                {hydraPickerPlugin: 'another-plugin'},
                {rootDir: __dirname + '/plugin-fs'}
            );
        }).toThrow('InvalidRoboHydraConfigurationException');
    });

    it("detects specified picking plugins without a picker function", function() {
        expect(function() {
            /*jshint nonew: false */
            new RoboHydraSummoner(
                [{name: 'simple-authenticator', config: {}},
                 {name: 'url-query-authenticator', config: {}},
                 {name: 'definedtwice', config: {}}],
                {hydraPickerPlugin: 'definedtwice'},
                {rootDir: __dirname + '/plugin-fs'}
            );
        }).toThrow('InvalidRoboHydraConfigurationException');
    });

    it("has a default picker function", function() {
        var summoner = new RoboHydraSummoner(
            [{name: 'simple', config: {}}],
            {},
            {rootDir: __dirname + '/plugin-fs'}
        );
        var seen = 'seen!';
        var hydra1 = summoner.summonRoboHydraForRequest(new Request({
            url: '/'
        }));
        hydra1.randomProperty = seen;
        var hydra2 = summoner.summonRoboHydraForRequest(new Request({
            url: '/?user=user2'
        }));
        expect(hydra2.randomProperty).toEqual(seen);
    });

    it("rejects pickers that are not functions", function() {
        expect(function() {
            var summoner = new RoboHydraSummoner(
                [{name: 'wrong-fixed-picker', config: {}}],
                {},
                {rootDir: __dirname + '/plugin-fs'}
            );
            summoner.summonRoboHydraForRequest(new Request({url: '/'}));
        }).toThrow('InvalidRoboHydraPluginException');
    });

    it("picks the right RoboHydra", function() {
        var summoner = new RoboHydraSummoner(
            [{name: 'right-robohydra-test', config: {}}],
            {},
            {rootDir: __dirname + '/plugin-fs'}
        );

        var hydra1 = summoner.summonRoboHydraForRequest(new Request({
            url: '/?user=user1'
        }));
        hydra1.startScenario('right-robohydra-test', 'robohydra1');
        hydra1.randomProperty = 'user 1';

        var hydra2 = summoner.summonRoboHydraForRequest(new Request({
            url: '/?user=user2'
        }));
        hydra2.startScenario('right-robohydra-test', 'robohydra2');

        expect(hydra2.randomProperty).not.toBeDefined();
        expect(hydra1.currentScenario.scenario).toEqual('robohydra1');
        expect(hydra2.currentScenario.scenario).toEqual('robohydra2');
    });

    it("Hydras know their own name", function() {
        var summoner = new RoboHydraSummoner(
            [{name: 'right-robohydra-test', config: {}}],
            {},
            {rootDir: __dirname + '/plugin-fs'}
        );

        var hydra1 = summoner.summonRoboHydraForRequest(new Request({
            url: '/?user=user1'
        }));
        var hydra2 = summoner.summonRoboHydraForRequest(new Request({
            url: '/?user=user2'
        }));

        expect(hydra1.name).toEqual('user1');
        expect(hydra2.name).toEqual('user2');
    });
});

describe("Plugin loader", function() {
    "use strict";

    var rootDir = path.join(__dirname, 'plugin-fs');

    it("fails when loading non-existent plugins", function() {
        expect(function() {
            new RoboHydraSummoner(
                [{name: 'i-dont-exist', config: {}}],
                {},
                {rootDir: rootDir}
            );
        }).toThrow('RoboHydraPluginNotFoundException');
    });

    it("can load a simple plugin", function() {
        var configKeyValue = 'config value';
        var lair = new RoboHydraSummoner(
            [{name: 'simple', config: {configKey: configKeyValue}}],
            {},
            {rootDir: rootDir}
        );
        expect(lair.pluginInfoList[0].path).toEqualPath(
            rootDir + '/usr/share/robohydra/plugins/simple');
        expect(lair.pluginInfoList[0].config.configKey).toEqual(configKeyValue);
    });

    it("can load plugins with the simplified syntax", function() {
        var lair = new RoboHydraSummoner(["simple"], {}, {rootDir: rootDir});
        expect(lair.pluginInfoList[0].path).toEqualPath(
            rootDir + '/usr/share/robohydra/plugins/simple');
    });

    it("loads plugins in the right order of preference", function() {
        var lair = new RoboHydraSummoner(
            [{name: 'definedtwice', config: {}}],
            {},
            {rootDir: rootDir}
        );
        expect(lair.pluginInfoList[0].path).toEqualPath(
            rootDir + '/usr/local/share/robohydra/plugins/definedtwice');
    });

    it("can define own load path, and takes precedence", function() {
        var lair = new RoboHydraSummoner(
            [{name: 'definedtwice', config: {}}],
            {},
            {rootDir: rootDir,
             extraPluginLoadPaths: ['/opt/robohydra/plugins']}
        );
        expect(lair.pluginInfoList[0].path).toEqualPath(
            rootDir + '/opt/robohydra/plugins/definedtwice');
    });

    it("can define more than one load path, latest has precedence", function() {
        var lair = new RoboHydraSummoner(
            [{name: 'definedtwice', config: {}}],
            {},
            {rootDir: rootDir,
             extraPluginLoadPaths: ['/opt/robohydra/plugins',
                                    '/opt/project/robohydra-plugins']}
        );
        expect(lair.pluginInfoList[0].path).toEqualPath(
            rootDir + '/opt/project/robohydra-plugins/definedtwice');
    });

    it("can define more than one load path, first is still valid", function() {
        var lair = new RoboHydraSummoner(
            [{name: 'customloadpath', config: {}}],
            {},
            {rootDir: rootDir,
             extraPluginLoadPaths: ['/opt/robohydra/plugins',
                                    '/opt/project/robohydra-plugins']}
        );
        expect(lair.pluginInfoList[0].path).toEqualPath(
            rootDir + '/opt/robohydra/plugins/customloadpath');
    });
});
