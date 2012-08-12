var fs = require('fs');
var ejs      = require('ejs'),
    markdown = require('markdown').markdown;
var heads                   = require('../heads'),
    RoboHydraHead           = heads.RoboHydraHead,
    RoboHydraHeadFilesystem = heads.RoboHydraHeadFilesystem,
    RoboHydraHeadStatic     = heads.RoboHydraHeadStatic;

var robohydraAdminBaseUrlPath = '/robohydra-admin';
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
        new RoboHydraHeadFilesystem({
            name: 'static',
            mountPath: robohydraAdminBaseUrlPath + '/static',
            documentRoot: __dirname + '/static'
        }),

        // Test start/stop
        new RoboHydraHead({
            name: 'testActivation',
            path: robohydraAdminBaseUrlPath + '/tests/:plugin/:testName',
            handler: function(req, res) {
                var cTest = config.robohydra.currentTest;
                var plugin = req.params.plugin, testName = req.params.testName;
                var startTest = false;
                if (cTest.plugin === plugin && cTest.test === testName) {
                    config.robohydra.stopTest();
                } else {
                    config.robohydra.startTest(plugin, testName);
                    startTest = true;
                }

                var p = config.robohydra.currentTest.plugin,
                    t = config.robohydra.currentTest.test;
                var currentTestInstructions;
                if (startTest &&
                    (currentTestInstructions =
                     config.robohydra.getPlugin(p).tests[t].instructions)) {
                    var stash = {baseUrl: robohydraAdminBaseUrlPath,
                                 instructions: currentTestInstructions,
                                 currentTest: config.robohydra.currentTest,
                                 markdown: markdown.toHTML};
                    res.send(ejs.render(testInstructionsTemplateString,
                                        stash));
                } else {
                    res.headers.Location = robohydraAdminBaseUrlPath + '/tests';
                    res.statusCode = 302;
                    res.end();
                }
            }
        }),


        // Test results in JSON
        new RoboHydraHead({
            name: 'testResultsJSON',
            path: robohydraAdminBaseUrlPath + '/tests/results.json',
            handler: function(req, res) {
                res.headers['content-type'] =
                    'application/json; charset=utf-8';
                res.send(JSON.stringify(config.robohydra.testResults));
            }
        }),


        // Test index
        new RoboHydraHead({
            name: 'testIndex',
            path: robohydraAdminBaseUrlPath + '/tests',
            handler: function(req, res) {
                var stash = {baseUrl: robohydraAdminBaseUrlPath,
                             plugins: config.robohydra.getPlugins(),
                             currentTest: config.robohydra.currentTest,
                             testResults: config.robohydra.testResults,
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


        // Create dynamic RoboHydra heads
        new RoboHydraHead({
            name: 'createHead',
            path: robohydraAdminBaseUrlPath + '/head/create',
            handler: function(req, res) {
                var content = req.bodyParams.newHeadContent;
                var defaultContentType = 'application/octet-stream';
                try {
                    JSON.parse(content);
                    defaultContentType = 'application/json';
                } catch (e) {
                    // It's ok if it's not JSON
                }
                var head = new RoboHydraHeadStatic({
                    path:        req.bodyParams.newHeadPath,
                    content:     content,
                    contentType: req.bodyParams.newHeadContentType ||
                                     defaultContentType
                });
                config.robohydra.registerDynamicHead(head);
                res.headers.Location = robohydraAdminBaseUrlPath;
                res.statusCode = 302;
                res.end();
            }}),


        // Toggle RoboHydra head attachment
        new RoboHydraHead({
            name: 'toggleHeadAttachment',
            path: robohydraAdminBaseUrlPath + '/head/toggle-attachment',
            handler: function(req, res) {
                var pluginName = req.bodyParams.pluginName;
                var headName   = req.bodyParams.headName;
                var head = config.robohydra.findHead(pluginName, headName);
                if (head.attached()) {
                    head.detach();
                } else {
                    head.attach();
                }
                res.headers.Location = robohydraAdminBaseUrlPath;
                res.statusCode = 302;
                res.end();
            }}),


        // Admin UI index
        new RoboHydraHead({
            name: 'index',
            path: robohydraAdminBaseUrlPath,
            handler: function(req, res) {
                var highlightPath = req.queryParams.highlightPath || '';
                var stash = {baseUrl: robohydraAdminBaseUrlPath,
                             plugins: config.robohydra.getPlugins(),
                             matchingHeads: [],
                             highlightPath: highlightPath};
                if (highlightPath) {
                    var matchingPair ;
                    while (1) {
                        matchingPair =
                                config.robohydra.headForPath(highlightPath,
                                                             matchingPair);
                        if (! matchingPair) {
                            break;
                        }

                        stash.matchingHeads.push({
                            plugin: matchingPair.plugin.name,
                            head:   matchingPair.head.name
                        });
                    }
                }

                var output = ejs.render(indexTemplateString, stash);
                res.send(output);
            }})
    ];
};
