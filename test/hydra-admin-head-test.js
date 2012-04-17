var buster = require("buster");
var sinon = require("sinon");
var adminPlugin    = require("../lib/plugins/admin"),
    HydraHeadAdmin = adminPlugin.HydraHeadAdmin;
var helpers              = require("./helpers"),
    checkRouting         = helpers.checkRouting,
    withResponse         = helpers.withResponse,
    fakeFs               = helpers.fakeFs,
    fakeHttpCreateClient = helpers.fakeHttpCreateClient;

buster.spec.expose();

describe("Admin Hydra heads", function() {
    it("can't be created without necessary properties", function() {
        expect(function() {
            var head = new HydraHeadAdmin({basePath: '/hydra/admin'});
        }).toThrow("InvalidHydraHeadException");
    });

    it("show the admin interface by default on /hydra-admin{,/}", function(done) {
        var hydra = {getPlugins: function() { return []; },
                     getPluginNames: function() { return ['test-plugin'] }};
        var head = new HydraHeadAdmin({hydra: hydra});

        checkRouting(head, [
            ['/hydra-admin',  {status: 200}],
            ['/hydra-admin/', {status: 200}],
            ['/blah/',        {status: 404}]
        ], done);
    });

    it("show the names of the plugins on the admin index page", function(done) {
        var head;
        function getPlugins() {
            return [{name: 'admin-plugin',
                     heads: [head]}];
        }
        var hydra = { getPlugins: getPlugins,
                      getPluginNames: function() { return ['admin-plugin']; }
                    };
        head = new HydraHeadAdmin({name: 'Hydra Admin UI', hydra: hydra});

        withResponse(head, '/hydra-admin', function(res) {
            var responseText = res.send.getCall(0).args[0];
            expect(responseText).toMatch(/admin-plugin/);
            expect(responseText).toMatch(/Hydra Admin UI/);
            done();
        });
    });
});
