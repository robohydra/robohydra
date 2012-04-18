var buster = require("buster");
var sinon = require("sinon");
var Hydra = require("../lib/hydra").Hydra;
var HydraHeadStatic = require("../lib/hydraHead").HydraHeadStatic;
var helpers              = require("./helpers"),
    checkRouting         = helpers.checkRouting,
    withResponse         = helpers.withResponse,
    fakeFs               = helpers.fakeFs,
    fakeHttpCreateClient = helpers.fakeHttpCreateClient;

buster.spec.expose();

describe("Admin Hydra UI", function() {
    it("shows up by default on /hydra-admin", function(done) {
        var hydra = new Hydra();

        var req = {url: '/hydra-admin', param: function() {}};
        var res = {send: function() {}};
        hydra.handle(req, res, function() {
            expect(res.statusCode).toEqual(200);
            var res2 = {send: function() {}};
            hydra.handle({url: '/blah'}, res2, function() {
                expect(res2.statusCode).toEqual(404);
                done();
            });
        });
    });

    it("shows the plugin & head names on the front page", function(done) {
        var hydra = new Hydra();
        var pluginName = 'plugin1', headName = 'some-head-name';
        hydra.registerPluginObject({
            name: pluginName,
            heads: [new HydraHeadStatic({name: headName, content: 'foo'})]
        });

        var req = {url: '/hydra-admin', param: function() {}};
        var res = {send: sinon.spy()};
        hydra.handle(req, res, function() {
            var responseText = res.send.getCall(0).args[0];
            expect(responseText).toMatch(pluginName);
            expect(responseText).toMatch(headName);
            expect(responseText).toMatch(/Hydra Admin UI/);
            done();
        });
    });
});
