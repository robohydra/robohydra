var fs = require('fs');
var ejs      = require('ejs'),
    markdown = require('markdown').markdown;
var heads                   = require('../heads'),
    RoboHydraHead           = heads.RoboHydraHead,
    RoboHydraHeadFilesystem = heads.RoboHydraHeadFilesystem,
    RoboHydraHeadProxy      = heads.RoboHydraHeadProxy;

var robohydraAdminBaseUrlPath = '/robohydra-admin';
var indexTemplateString =
    fs.readFileSync(__dirname + "/templates/index.ejs", "utf-8");
var scenarioTemplateString =
    fs.readFileSync(__dirname + "/templates/scenarios.ejs", "utf-8");
var scenarioInstructionsTemplateString =
    fs.readFileSync(__dirname + "/templates/scenario-instructions.ejs",
                    "utf-8");
var headerPartialTemplateString =
    fs.readFileSync(__dirname + "/templates/_header.ejs", "utf-8");
var headerPartialTemplate =
        ejs.compile(headerPartialTemplateString);
var scenarioResultPartialTemplateString =
    fs.readFileSync(__dirname + "/templates/_scenario-result.ejs", "utf-8");
var scenarioResultPartialTemplate =
        ejs.compile(scenarioResultPartialTemplateString);

exports.name = '*admin*';
exports.getBodyParts = function(config) {
    "use strict";

    var showAdminPlugin = !!config.adminui_show_admin_plugin;

    return [
        // Static files
        new RoboHydraHeadFilesystem({
            name: 'static',
            mountPath: robohydraAdminBaseUrlPath + '/static',
            documentRoot: __dirname + '/static'
        }),


        // "Test" to "Scenario" compatibility heads (deprecated)
        new RoboHydraHead({
            name: 'testResultsCompat',
            path: robohydraAdminBaseUrlPath + '/tests/results.json',
            handler: function(req, res, next) {
                req.url = req.url =
                    robohydraAdminBaseUrlPath + '/scenarios/testResults.json';
                next(req, res);
            }
        }),
        new RoboHydraHead({
            name: 'testToScenarioCompat',
            path: robohydraAdminBaseUrlPath + '/tests/',
            handler: function(req, res, next) {
                req.url = req.url.replace(new RegExp('/tests'), '/scenarios');
                next(req, res);
            }
        }),
        new RoboHydraHead({
            name: 'testToScenarioToggleCompat',
            path: robohydraAdminBaseUrlPath + '/tests/:plugin/:testName',
            handler: function(req, res, next) {
                req.url = robohydraAdminBaseUrlPath +
                    '/scenarios/' + req.params.plugin + '/' +
                    req.params.testName;

                var cScenario = config.robohydra.currentScenario;
                var plugin = req.params.plugin,
                    scenarioName = req.params.scenarioName;
                var stop = (cScenario.plugin === plugin &&
                            cScenario.scenario === scenarioName);
                req.bodyParams.active = stop ? 'false' : 'true';

                next(req, res);
            }
        }),

        // Scenario start/stop
        new RoboHydraHead({
            name: 'scenarioActivation',
            path: robohydraAdminBaseUrlPath + '/scenarios/:plugin/:scenarioName',
            handler: function(req, res) {
                var cScenario = config.robohydra.currentScenario;
                var plugin = req.params.plugin, scenarioName = req.params.scenarioName;
                var startScenario = false;
                if (cScenario.plugin === plugin && cScenario.scenario === scenarioName) {
                    config.robohydra.stopScenario();
                } else {
                    config.robohydra.startScenario(plugin, scenarioName);
                    startScenario = true;
                }

                var p = config.robohydra.currentScenario.plugin,
                    t = config.robohydra.currentScenario.scenario;
                var currentScenarioInstructions;
                if (startScenario &&
                    (currentScenarioInstructions =
                     config.robohydra.getPlugin(p).scenarios[t].instructions)) {
                    var stash = {baseUrl: robohydraAdminBaseUrlPath,
                                 instructions: currentScenarioInstructions,
                                 currentScenario: config.robohydra.currentScenario,
                                 markdown: markdown.toHTML,
                                 renderHeader: function() {
                                     return headerPartialTemplate({
                                         baseUrl: robohydraAdminBaseUrlPath,
                                         currentSection: '/'
                                     });
                                 }};
                    res.headers['content-type'] = 'text/html';
                    res.send(ejs.render(scenarioInstructionsTemplateString,
                                        stash));
                } else {
                    res.headers.Location = robohydraAdminBaseUrlPath + '/scenarios';
                    res.statusCode = 302;
                    res.end();
                }
            }
        }),


        // Test results in JSON
        new RoboHydraHead({
            name: 'testResultsJSON',
            path: robohydraAdminBaseUrlPath + '/scenarios/testResults.json',
            handler: function(req, res) {
                res.headers['content-type'] =
                    'application/json; charset=utf-8';
                res.send(JSON.stringify(config.robohydra.testResults));
            }
        }),


        // Scenario index
        new RoboHydraHead({
            name: 'scenarioIndex',
            path: robohydraAdminBaseUrlPath + '/scenarios',
            handler: function(req, res) {
                var stash = {baseUrl: robohydraAdminBaseUrlPath,
                             plugins: config.robohydra.getPlugins(),
                             currentTest: config.robohydra.currentTest,
                             testResults: config.robohydra.testResults,
                             renderHeader: function() {
                                 return headerPartialTemplate({
                                     currentSection: '/scenarios'
                                 });
                             },
                             renderTestResults: function(p, s, results) {
                                 return scenarioResultPartialTemplate({
                                     plugin: p,
                                     scenario: s,
                                     testResults: results
                                 });
                             }};
                var output = ejs.render(scenarioTemplateString, stash);
                res.headers['content-type'] = 'text/html';
                res.send(output);
            }
        }),


        // Create dynamic RoboHydra heads
        new RoboHydraHead({
            name: 'createHead',
            path: robohydraAdminBaseUrlPath + '/head/create',
            handler: function(req, res) {
                function createStaticHead(params) {
                    var content = req.bodyParams.newStaticHeadContent;
                    var defaultContentType = 'application/octet-stream';
                    try {
                        JSON.parse(content);
                        defaultContentType = 'application/json';
                    } catch (e) {
                        // It's ok if it's not JSON
                    }

                    var fullUrlPath = params.newStaticHeadPath;
                    // Javascript's split method is retarded, have to
                    // do this shit
                    var baseUrlPath = fullUrlPath, queryParamString = '';
                    var questionMarkIndex = fullUrlPath.indexOf('?');
                    if (questionMarkIndex !== -1) {
                        baseUrlPath = fullUrlPath.slice(0, questionMarkIndex);
                        queryParamString =
                            fullUrlPath.slice(questionMarkIndex + 1);
                    }
                    var queryParams = {};
                    queryParamString.split("&").forEach(function(keyValue) {
                        var pair = keyValue.split("=");
                        queryParams[pair[0]] = pair[1];
                    });

                    return new RoboHydraHead({
                        path:    baseUrlPath,
                        handler: function(req, res, next) {
                            // Check if we match all given query parameters
                            var matches = true;
                            for (var p in queryParams) {
                                if (req.queryParams[p] !== queryParams[p]) {
                                    matches = false;
                                }
                            }

                            if (matches) {
                                res.headers['content-type'] =
                                    params.newStaticHeadContentType ||
                                    defaultContentType;
                                res.send(content);
                            } else {
                                next(req, res);
                            }
                        }
                    });
                }

                function createFilesystemHead(params) {
                    return new RoboHydraHeadFilesystem({
                        mountPath:    params.newFilesystemHeadMountPath,
                        documentRoot: params.newFilesystemHeadDocumentRoot
                    });
                }

                function createProxyHead(params) {
                    return new RoboHydraHeadProxy({
                        mountPath:     params.newProxyHeadMountPath,
                        proxyTo:       params.newProxyHeadProxyTo,
                        setHostHeader: !!params.newProxyHeadSetHostHeader
                    });
                }


                var headCreationFunctionMap = {
                    'static': createStaticHead,
                    'filesystem': createFilesystemHead,
                    'proxy': createProxyHead
                };
                var headCreationFunction =
                        headCreationFunctionMap[req.bodyParams.newHeadType];
                if (typeof headCreationFunction !== 'function') {
                    res.statusCode = 400;
                    res.headers['content-type'] = 'text/html';
                    res.send("Unknown head type '" +
                             req.bodyParams.newHeadType + "'");
                    return;
                }

                var head = headCreationFunction(req.bodyParams);
                config.robohydra.registerDynamicHead(head);
                res.headers.Location = robohydraAdminBaseUrlPath;
                res.statusCode = 302;
                res.end();
            }
        }),


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
            }
        }),


        // REST API =======================================================
        // Head information/attaching
        new RoboHydraHead({
            name: 'restHead',
            path: robohydraAdminBaseUrlPath + '/rest/plugins/:plugin/heads/:head',
            handler: function(req, res) {
                var pluginName = req.params.plugin;
                var headName   = req.params.head;
                var head = config.robohydra.findHead(pluginName, headName);

                if (req.method === 'POST') {
                    var newAttachedState = req.bodyParams.attached;
                    if (head.attached() && newAttachedState === 'false') {
                        head.detach();
                    }
                    if (! head.attached() && newAttachedState === 'true') {
                        head.attach();
                    }
                }
                res.send(JSON.stringify({
                    plugin: pluginName,
                    name: headName,
                    attached: head.attached()
                }));
            }
        }),
        // Plugin information
        new RoboHydraHead({
            name: 'restPlugin',
            path: robohydraAdminBaseUrlPath + '/rest/plugins/:plugin',
            handler: function(req, res) {
                var pluginName = req.params.plugin;
                var plugin = config.robohydra.getPlugin(pluginName);
                var currentScenario = config.robohydra.currentScenario;

                res.send(JSON.stringify({
                    name: pluginName,
                    heads: plugin.heads.map(function(h) {
                        return {
                            plugin: pluginName,
                            name: h.name,
                            attached: h.attached()
                        };
                    }),
                    scenarios: Object.keys(plugin.scenarios).map(function(s) {
                        return {
                            plugin: pluginName,
                            name: s,
                            active: (pluginName === currentScenario.plugin &&
                                     s === currentScenario.scenario)
                        };
                    })
                }));
            }
        }),


        // Admin UI index
        new RoboHydraHead({
            name: 'index',
            path: robohydraAdminBaseUrlPath,
            handler: function(req, res) {
                var highlightPath = req.queryParams.highlightPath || '';
                var stash = {baseUrl: robohydraAdminBaseUrlPath,
                             plugins: config.robohydra.getPlugins(),
                             matchingHeads: [],
                             highlightPath: highlightPath,
                             renderHeader: function() {
                                 return headerPartialTemplate({
                                     baseUrl: robohydraAdminBaseUrlPath,
                                     currentSection: '/'
                                 });
                             }};
                if (! showAdminPlugin) {
                    stash.plugins = stash.plugins.filter(function(plugin) {
                        return plugin.name !== '*admin*';
                    });
                }
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
                res.headers['content-type'] = 'text/html';
                res.send(output);
            }})
    ];
};
