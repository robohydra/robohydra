var buster = require("buster");
var sinon = require("sinon");
var Hydra = require("../lib/hydra").Hydra;
var HydraHeadStatic = require("../lib/hydraHead").HydraHeadStatic;
var helpers              = require("./helpers"),
    checkRouting         = helpers.checkRouting,
    withResponse         = helpers.withResponse,
    fakeFs               = helpers.fakeFs,
    fakeHttpCreateClient = helpers.fakeHttpCreateClient,
    fakeReq              = helpers.fakeReq,
    fakeRes              = helpers.fakeRes;

buster.spec.expose();

describe("Admin Hydra UI", function() {
    it("shows up by default on /hydra-admin", function(done) {
        var hydra = new Hydra();

        var req = {url: '/hydra-admin', getParams: {}};
        var res = fakeRes(function() {
                       expect(res.statusCode).toEqual(200);
                       var res2 = fakeRes(function() {
                                      expect(res2.statusCode).toEqual(404);
                                      done();
                                  })
                       hydra.handle({url: '/blah'}, res2);
                   });
        hydra.handle(req, res);
    });

    it("shows the plugin & head names on the front page", function(done) {
        var hydra = new Hydra();
        var pluginName = 'plugin1', headName = 'some-head-name';
        hydra.registerPluginObject({
            name: pluginName,
            heads: [new HydraHeadStatic({name: headName, content: 'foo'})]
        });

        var req = {url: '/hydra-admin', getParams: {}};
        var res = fakeRes(function() {
                      expect(this.body).toMatch(pluginName);
                      expect(this.body).toMatch(headName);
                      expect(this.body).toMatch(/Hydra Admin/);
                      done();
                  });
        hydra.handle(req, res);
    });
});
