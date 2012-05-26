var buster = require("buster");
var robohydra = require("../lib/robohydra"),
    RoboHydra = robohydra.RoboHydra,
    Response  = robohydra.Response;
var RoboHydraHeadStatic = require("../lib/heads").RoboHydraHeadStatic;
var helpers              = require("./helpers"),
    checkRouting         = helpers.checkRouting,
    withResponse         = helpers.withResponse,
    fakeFs               = helpers.fakeFs,
    fakeHttpCreateClient = helpers.fakeHttpCreateClient,
    fakeReq              = helpers.fakeReq;

buster.spec.expose();

describe("Admin RoboHydra UI", function() {
    it("shows up by default on /robohydra-admin", function(done) {
        var robohydra = new RoboHydra();

        var req = {url: '/robohydra-admin', getParams: {}};
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
        robohydra.registerPluginObject({
            name: pluginName,
            heads: [new RoboHydraHeadStatic({name: headName, content: 'foo'})]
        });

        var req = {url: '/robohydra-admin', getParams: {}};
        var res = new Response(function() {
                      expect(this.body).toMatch(pluginName);
                      expect(this.body).toMatch(headName);
                      expect(this.body).toMatch(/RoboHydra Admin/);
                      done();
                  });
        robohydra.handle(req, res);
    });
});
