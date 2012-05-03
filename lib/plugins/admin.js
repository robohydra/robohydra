var fs = require('fs');
var ejs = require('ejs');
var HydraHead           = require('../hydraHead.js').HydraHead,
    HydraHeadFilesystem = require('../hydraHead.js').HydraHeadFilesystem,
    HydraHeadStatic     = require('../hydraHead.js').HydraHeadStatic;

var hydraAdminBaseUrlPath = '/hydra-admin';
var indexTemplateString =
    fs.readFileSync(__dirname + "/templates/index.ejs", "utf-8");
var testTemplateString =
    fs.readFileSync(__dirname + "/templates/tests.ejs", "utf-8");

exports.name = '*admin*';
exports.getBodyParts = function(config) {
    return [
        // Static files
        new HydraHeadFilesystem({name: 'static',
                                 basePath: hydraAdminBaseUrlPath + '/static',
                                 documentRoot: __dirname + '/static'}),

        // Test start/stop
        new HydraHead({
            hydra: config.hydra,
            name: 'testActivation',
            path: hydraAdminBaseUrlPath + '/tests/:plugin/:testName',
            handler: function(req, res, cb) {
                var cTest = config.hydra.currentTest;
                var plugin = req.params.plugin, testName = req.params.testName;
                if (cTest.plugin === plugin && cTest.test === testName) {
                    config.hydra.stopTest(plugin, testName);
                } else {
                    config.hydra.startTest(plugin, testName);
                }
                res.header('Location', hydraAdminBaseUrlPath + '/tests');
                res.statusCode = 302;
                cb();
            }
        }),


        // Test index
        new HydraHead({
            hydra: config.hydra,
            name: 'testIndex',
            path: hydraAdminBaseUrlPath + '/tests',
            handler: function(req, res, cb) {
                res.statusCode = 200;

                var stash = {baseUrl: hydraAdminBaseUrlPath,
                             plugins: config.hydra.getPlugins(),
                             currentTest: config.hydra.currentTest};
                var output = ejs.render(testTemplateString, stash);
                res.send(output);
                cb();
            }
        }),


        // Create dynamic hydra heads
        new HydraHead({
            hydra: config.hydra,
            name: 'createHead',
            path: hydraAdminBaseUrlPath + '/head/create',
            handler: function(req, res, cb) {
                var content = req.body.newHeadContent;
                var defaultContentType = 'application/octet-stream';
                try {
                    JSON.parse(content);
                    defaultContentType = 'application/json';
                } catch (e) {
                    // It's ok if it's not JSON
                }
                var head = new HydraHeadStatic({
                    path:        req.body.newHeadPath,
                    content:     content,
                    contentType: req.body.newHeadContentType ||
                                     defaultContentType
                });
                config.hydra.registerDynamicHead(head);
                res.header('Location', hydraAdminBaseUrlPath);
                res.statusCode = 302;
                cb();
            }}),


        // Toggle hydra head attachment
        new HydraHead({
            hydra: config.hydra,
            name: 'toggleHeadAttachment',
            path: hydraAdminBaseUrlPath + '/head/toggle-attachment',
            handler: function(req, res, cb) {
                var pluginName = req.param('pluginName');
                var headName   = req.param('headName');
                var head = config.hydra.findHead(pluginName, headName);
                head.attached() ? head.detach() : head.attach();
                res.header('Location', hydraAdminBaseUrlPath);
                res.statusCode = 302;
                cb();
            }}),


        // Admin UI index
        new HydraHead({
            hydra: config.hydra,
            name: 'index',
            path: hydraAdminBaseUrlPath,
            handler: function(req, res, cb) {
                res.statusCode = 200;

                var stash = {baseUrl: hydraAdminBaseUrlPath,
                             plugins: config.hydra.getPlugins(),
                             matchingPluginName: undefined,
                             matchingHeadName: undefined,
                             highlightPath: req.param('highlightPath') || ''};
                if (req.param('highlightPath')) {
                    var matchingPair = config.hydra.headForPath(stash.highlightPath);
                    if (matchingPair) {
                        stash.matchingPluginName = matchingPair.plugin.name;
                        stash.matchingHeadName   = matchingPair.head.name;
                    }
                }

                var output = ejs.render(indexTemplateString, stash);
                res.send(output);
                cb();
            }})
    ];
};