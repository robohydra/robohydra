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
var testInstructionsTemplateString =
    fs.readFileSync(__dirname + "/templates/test-instructions.ejs", "utf-8");
var testResultPartialTemplateString =
    fs.readFileSync(__dirname + "/templates/_test-result.ejs", "utf-8");
var testResultPartialTemplate = ejs.compile(testResultPartialTemplateString);

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
            handler: function(req, res) {
                var cTest = config.hydra.currentTest;
                var plugin = req.params.plugin, testName = req.params.testName;
                var startTest = false;
                if (cTest.plugin === plugin && cTest.test === testName) {
                    config.hydra.stopTest();
                } else {
                    config.hydra.startTest(plugin, testName);
                    startTest = true;
                }

                var p = config.hydra.currentTest.plugin,
                    t = config.hydra.currentTest.test;
                var currentTestInstructions;
                if (startTest &&
                        (currentTestInstructions =
                           config.hydra.getPlugin(p).tests[t].instructions)) {
                    var stash = {baseUrl: hydraAdminBaseUrlPath,
                                 instructions: currentTestInstructions,
                                 currentTest: config.hydra.currentTest};
                    res.send(ejs.render(testInstructionsTemplateString,
                                        stash));
                } else {
                    res.headers.Location = hydraAdminBaseUrlPath + '/tests';
                    res.statusCode = 302;
                    res.end();
                }
            }
        }),


        // Test index
        new HydraHead({
            hydra: config.hydra,
            name: 'testIndex',
            path: hydraAdminBaseUrlPath + '/tests',
            handler: function(req, res) {
                var stash = {baseUrl: hydraAdminBaseUrlPath,
                             plugins: config.hydra.getPlugins(),
                             currentTest: config.hydra.currentTest,
                             testResults: config.hydra.testResults,
                             renderTestResults: function(p, t, results) {
                                 return testResultPartialTemplate({
                                     plugin: p,
                                     test: t,
                                     testResults: results
                                 });
                             }};
                var output = ejs.render(testTemplateString, stash);
                res.send(output);
            }
        }),


        // Create dynamic hydra heads
        new HydraHead({
            hydra: config.hydra,
            name: 'createHead',
            path: hydraAdminBaseUrlPath + '/head/create',
            handler: function(req, res) {
                var content = req.bodyParams.newHeadContent;
                var defaultContentType = 'application/octet-stream';
                try {
                    JSON.parse(content);
                    defaultContentType = 'application/json';
                } catch (e) {
                    // It's ok if it's not JSON
                }
                var head = new HydraHeadStatic({
                    path:        req.bodyParams.newHeadPath,
                    content:     content,
                    contentType: req.bodyParams.newHeadContentType ||
                                     defaultContentType
                });
                config.hydra.registerDynamicHead(head);
                res.headers.Location = hydraAdminBaseUrlPath;
                res.statusCode = 302;
                res.end();
            }}),


        // Toggle hydra head attachment
        new HydraHead({
            hydra: config.hydra,
            name: 'toggleHeadAttachment',
            path: hydraAdminBaseUrlPath + '/head/toggle-attachment',
            handler: function(req, res) {
                var pluginName = req.bodyParams.pluginName;
                var headName   = req.bodyParams.headName;
                var head = config.hydra.findHead(pluginName, headName);
                head.attached() ? head.detach() : head.attach();
                res.headers.Location = hydraAdminBaseUrlPath;
                res.statusCode = 302;
                res.end();
            }}),


        // Admin UI index
        new HydraHead({
            hydra: config.hydra,
            name: 'index',
            path: hydraAdminBaseUrlPath,
            handler: function(req, res) {
                var stash = {baseUrl: hydraAdminBaseUrlPath,
                             plugins: config.hydra.getPlugins(),
                             matchingPluginName: undefined,
                             matchingHeadName: undefined,
                             highlightPath: req.getParams.highlightPath || ''};
                if (req.getParamshighlightPath) {
                    var matchingPair = config.hydra.headForPath(stash.highlightPath);
                    if (matchingPair) {
                        stash.matchingPluginName = matchingPair.plugin.name;
                        stash.matchingHeadName   = matchingPair.head.name;
                    }
                }

                var output = ejs.render(indexTemplateString, stash);
                res.send(output);
            }})
    ];
};
