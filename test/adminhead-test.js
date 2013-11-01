/*global describe, it, expect*/

var buster = require("buster");
var robohydra = require("../lib/robohydra"),
    RoboHydra = robohydra.RoboHydra,
    Request   = robohydra.Request,
    Response  = robohydra.Response;
var heads               = require("../lib/heads"),
    RoboHydraHeadStatic = heads.RoboHydraHeadStatic;
var helpers          = require("./helpers"),
    pluginInfoObject = helpers.pluginInfoObject,
    withResponse     = helpers.withResponse,
    headWithFail     = helpers.headWithFail;

buster.spec.expose();

function registerSimplePlugin(robohydra, props) {
    var scenarios = {};
    (props.scenarios || []).forEach(function(scenarioName) {
        scenarios[scenarioName] = {heads: [
            new RoboHydraHeadStatic({
                name: scenarioName,
                content: "Content for scenario " + scenarioName
            })
        ]};
    });

    robohydra.registerPluginObject(pluginInfoObject({
        name: props.name,
        heads: (props.heads || []).map(function(headName) {
            return new RoboHydraHeadStatic({
                name: headName,
                content: "Content for " + headName
            });
        }),
        scenarios: scenarios
    }));
}

describe("Admin RoboHydra UI", function() {
    "use strict";

    it("shows up by default on /robohydra-admin", function(done) {
        var robohydra = new RoboHydra();

        var req = new Request({url: '/robohydra-admin'});
        var res = new Response(function() {
            expect(res.statusCode).toEqual(200);
            var res2 = new Response(function() {
                expect(res2.statusCode).toEqual(404);
                done();
            });
            robohydra.handle({url: '/blah'}, res2);
        });
        robohydra.handle(req, res);
    });

    it("shows the plugin & head names on the front page", function(done) {
        var robohydra = new RoboHydra();
        var pluginName = 'plugin1', headName = 'some-head-name';
        robohydra.registerPluginObject(pluginInfoObject({
            name: pluginName,
            heads: [new RoboHydraHeadStatic({name: headName, content: 'foo'})]
        }));

        var req = new Request({url: '/robohydra-admin'});
        var res = new Response(function() {
            expect(this.body).toMatch(pluginName);
            expect(this.body).toMatch(headName);
            expect(this.body).toMatch(/RoboHydra Admin/);
            done();
        });
        robohydra.handle(req, res);
    });
});



function restUrl(path) {
    return '/robohydra-admin/rest' + path;
}

describe("REST API", function() {
    "use strict";

    it("shows list of plugins", function(done) {
        var robohydra = new RoboHydra();
        var pluginName = 'plugin1';
        registerSimplePlugin(robohydra, { name: pluginName });

        withResponse(robohydra, restUrl('/plugins'), function(resp) {
            expect(resp.statusCode).toEqual(200);
            var info = JSON.parse(resp.body.toString());
            expect(info.plugins).toEqual([pluginName]);
            done();
        });
    });

    it("shows information for the given plugin", function(done) {
        var robohydra = new RoboHydra();
        var pluginName = 'plugin1', headName = 'some-head-name',
            headName2 = 'some-other-head-name';
        registerSimplePlugin(robohydra, {
            name: pluginName,
            heads: [headName, headName2],
            scenarios: ['oneAndOnlyScenario']
        });

        var url = restUrl('/plugins/' + pluginName);
        withResponse(robohydra, url, function(resp) {
            expect(resp.statusCode).toEqual(200);
            var info = JSON.parse(resp.body.toString());
            expect(info.name).toEqual(pluginName);
            expect(info.heads).toEqual([
                {plugin: pluginName,
                 name: headName,
                 attached: true},
                {plugin: pluginName,
                 name: headName2,
                 attached: true}
            ]);
            expect(info.scenarios).toEqual([
                {plugin: pluginName,
                 name: 'oneAndOnlyScenario',
                 active: false}
            ]);
            done();
        });
    });

    it("updates scenario state when a scenario starts", function(done) {
        var robohydra = new RoboHydra();
        var pluginName = 'plugin1', headName = 'some-head-name',
            headName2 = 'some-other-head-name', scenarioName = 'firstScenario',
            scenarioName2 = 'secondScenario';
        registerSimplePlugin(robohydra, {
            name: pluginName,
            heads: [headName, headName2],
            scenarios: [scenarioName, scenarioName2]
        });
        robohydra.startScenario(pluginName, 'firstScenario');

        var url = restUrl('/plugins/' + pluginName);
        withResponse(robohydra, url, function(resp) {
            var initialInfo = JSON.parse(resp.body.toString());
            expect(initialInfo.scenarios).toEqual([
                {plugin: pluginName,
                 name: 'firstScenario',
                 active: true},
                {plugin: pluginName,
                 name: 'secondScenario',
                 active: false}
            ]);

            robohydra.startScenario(pluginName, 'secondScenario');
            withResponse(robohydra, url, function(resp) {
                var updatedInfo = JSON.parse(resp.body.toString());
                expect(updatedInfo.scenarios).toEqual([
                    {plugin: pluginName,
                     name: 'firstScenario',
                     active: false},
                    {plugin: pluginName,
                     name: 'secondScenario',
                     active: true}
                ]);
                done();
            });
        });
    });

    it("shows information for the given head", function(done) {
        var robohydra = new RoboHydra();
        var pluginName = 'plugin1', headName = 'some-head-name';
        robohydra.registerPluginObject(pluginInfoObject({
            name: pluginName,
            heads: [new RoboHydraHeadStatic({name: headName, content: 'foo'})]
        }));

        var url = restUrl('/plugins/' + pluginName + '/heads/' + headName);
        withResponse(robohydra, url, function(resp) {
            expect(resp.statusCode).toEqual(200);
            var info = JSON.parse(resp.body.toString());
            expect(info.plugin).toEqual(pluginName);
            expect(info.name).toEqual(headName);
            done();
        });
    });

    it("can toggle the state of a head", function(done) {
        var robohydra = new RoboHydra();
        var pluginName = 'plugin1', headName = 'some-head-name';
        robohydra.registerPluginObject(pluginInfoObject({
            name: pluginName,
            heads: [new RoboHydraHeadStatic({name: headName, content: 'foo'})]
        }));

        var headUrl = restUrl('/plugins/' + pluginName + '/heads/' + headName);
        var detachRequest = {path: headUrl,
                             method: 'POST',
                             postData: 'attached=false'};
        withResponse(robohydra, detachRequest, function(detachResp) {
            expect(detachResp.statusCode).toEqual(200);
            var detachInfo = JSON.parse(detachResp.body.toString());
            expect(detachInfo.plugin).toEqual(pluginName);
            expect(detachInfo.name).toEqual(headName);
            expect(detachInfo.attached).toEqual(false);

            withResponse(robohydra, headUrl, function(afterResp) {
                var afterInfo = JSON.parse(afterResp.body.toString());
                expect(afterInfo.plugin).toEqual(pluginName);
                expect(afterInfo.name).toEqual(headName);
                expect(afterInfo.attached).toEqual(false);
                done();
            });
        });
    });

    it("returns correct error if the plugin/head don't exist", function(done) {
        var robohydra = new RoboHydra();
        var pluginName = 'plugin1', headName = 'some-head-name';
        robohydra.registerPluginObject(pluginInfoObject({
            name: pluginName,
            heads: [new RoboHydraHeadStatic({name: headName, content: 'foo'})]
        }));

        var wrongPluginUrl = restUrl('/plugins/non-existent-' + pluginName +
                                  '/heads/' + headName);
        var detachRequest = {path: wrongPluginUrl,
                             method: 'POST',
                             postData: 'attached=false'};
        withResponse(robohydra, detachRequest, function(detachResp) {
            expect(detachResp.statusCode).toEqual(404);

            var wrongHeadUrl = restUrl('/plugins/' + pluginName +
                                  '/heads/non-existent-' + headName);
            var detachRequest2 = {path: wrongHeadUrl,
                                  method: 'POST',
                                  postData: 'attached=false'};
            withResponse(robohydra, detachRequest2, function(afterResp) {
                expect(afterResp.statusCode).toEqual(404);
                done();
            });
        });
    });

    it("can toggle the state of a scenario", function(done) {
        var robohydra = new RoboHydra();
        var pluginName = 'plugin1', scenarioName = 'some-scenario';
        registerSimplePlugin(robohydra, {
            name: pluginName,
            scenarios: [scenarioName]
        });

        var headUrl = restUrl('/plugins/' + pluginName + '/scenarios/' +
                                  scenarioName);
        var startScenarioRequest = {path: headUrl,
                                    method: 'POST',
                                    postData: 'active=true'};
        withResponse(robohydra, startScenarioRequest, function(startResp) {
            expect(startResp.statusCode).toEqual(200);
            var startInfo = JSON.parse(startResp.body.toString());
            expect(startInfo.plugin).toEqual(pluginName);
            expect(startInfo.name).toEqual(scenarioName);
            expect(startInfo.active).toEqual(true);

            expect(robohydra.currentScenario.scenario).toEqual(scenarioName);
            done();
        });
    });

    it("returns correct error if the plugin/scenario don't exist", function(done) {
        var robohydra = new RoboHydra();
        var pluginName = 'plugin1', scenarioName = 'some-scenario';
        registerSimplePlugin(robohydra, {
            name: pluginName,
            scenarios: [scenarioName]
        });

        var wrongPluginUrl = restUrl('/plugins/non-existent-' + pluginName +
                                         '/scenarios/' + scenarioName);
        var startScenarioRequest = {path: wrongPluginUrl,
                                    method: 'POST',
                                    postData: 'active=true'};
        withResponse(robohydra, startScenarioRequest, function(resp1) {
            expect(resp1.statusCode).toEqual(404);

            var wrongScenarioNameUrl = restUrl('/plugins/' +
                                                   pluginName +
                                                   '/scenarios/non-existent-' +
                                                   scenarioName);
            var startScenarioRequest2 = {path: wrongScenarioNameUrl,
                                         method: 'POST',
                                         postData: 'active=true'};
            withResponse(robohydra, startScenarioRequest2, function(resp2) {
                expect(resp2.statusCode).toEqual(404);
                done();
            });
        });
    });

    it("doesn't stop any scenario if the given one wasn't the running scenario", function(done) {
        var robohydra = new RoboHydra();
        var pluginName = 'plugin1', scenarioName = 'some-scenario',
            scenarioName2 = 'another-scenario';
        registerSimplePlugin(robohydra, {
            name: pluginName,
            scenarios: [scenarioName, scenarioName2]
        });
        robohydra.startScenario(pluginName, scenarioName);

        var scenarioUrl = restUrl('/plugins/' + pluginName + '/scenarios/' +
                                      scenarioName2);
        var stopScenarioRequest = {path: scenarioUrl,
                                   method: 'POST',
                                   postData: 'active=false'};
        withResponse(robohydra, stopScenarioRequest, function(stopResp) {
            expect(stopResp.statusCode).toEqual(200);
            var stopInfo = JSON.parse(stopResp.body.toString());
            expect(stopInfo.plugin).toEqual(pluginName);
            expect(stopInfo.name).toEqual(scenarioName2);
            expect(stopInfo.active).toEqual(false);

            expect(robohydra.currentScenario.scenario).toEqual(scenarioName);
            done();
        });
    });

    it("doesn't toggle any scenario state if there's no change", function(done) {
        var robohydra = new RoboHydra();
        var pluginName = 'plugin1', scenarioName = 'some-scenario';
        registerSimplePlugin(robohydra, {
            name: pluginName,
            scenarios: [scenarioName]
        });
        robohydra.startScenario(pluginName, scenarioName);

        var scenarioUrl = restUrl('/plugins/' + pluginName + '/scenarios/' +
                                      scenarioName);
        var pointlessRequest = {path: scenarioUrl,
                                method: 'POST',
                                postData: 'active=true'};
        withResponse(robohydra, pointlessRequest, function(pointlessResp) {
            expect(pointlessResp.statusCode).toEqual(200);
            var stopInfo = JSON.parse(pointlessResp.body.toString());
            expect(stopInfo.plugin).toEqual(pluginName);
            expect(stopInfo.name).toEqual(scenarioName);
            expect(stopInfo.active).toEqual(true);

            expect(robohydra.currentScenario.scenario).toEqual(scenarioName);
            done();
        });
    });

    it("can show test results", function(done) {
        var robohydra = new RoboHydra();
        var assertionName = "Some test message";
        var pluginName = 'plugin1', scenarioName = 'scenarioWithFail',
            scenarioName2 = 'scenarioWithoutFails';
        var pluginDef = { name: pluginName, scenarios: {} };
        pluginDef.scenarios[scenarioName] = {heads: [
            headWithFail('/', robohydra.getModulesObject(), assertionName)
        ]};
        pluginDef.scenarios[scenarioName2] = {heads: [
            headWithFail('/', robohydra.getModulesObject(), assertionName)
        ]};

        robohydra.registerPluginObject(pluginInfoObject(pluginDef));
        // Start both scenarios to make sure we get the results, but
        // start scenarioName last so that stays as the active scenario
        robohydra.startScenario(pluginName, scenarioName2);
        robohydra.startScenario(pluginName, scenarioName);

        withResponse(robohydra, '/', function(/*requestForFail*/) {
            withResponse(robohydra, restUrl('/test-results'), function(resp) {
                expect(resp.statusCode).toEqual(200);
                var stopInfo = JSON.parse(resp.body.toString());
                var results1 = stopInfo[pluginName][scenarioName];
                expect(results1.passes.length).toEqual(0);
                expect(results1.failures).toEqual([assertionName]);
                var results2 = stopInfo[pluginName][scenarioName2];
                expect(results2.passes.length).toEqual(0);
                expect(results2.failures.length).toEqual(0);
                done();
            });
        });
    });
});
