var fs = require('fs');
var path = require("path");
var ejs      = require('ejs'),
    markdown = require('markdown').markdown;
var heads                   = require('../heads'),
    RoboHydraHead           = heads.RoboHydraHead,
    RoboHydraHeadFilesystem = heads.RoboHydraHeadFilesystem,
    RoboHydraHeadProxy      = heads.RoboHydraHeadProxy;
var extendObject = require("../utils").extendObject;

var robohydraAdminBaseUrlPath = '/robohydra-admin';
var mainLayoutTemplateString =
    fs.readFileSync(__dirname + "/templates/layout-main.ejs", "utf-8");
var startTimestamp = new Date();


function templateData(templateName) {
    return fs.readFileSync(path.join(__dirname,
                                     "templates",
                                     templateName + ".ejs"),
                           "utf-8");
}

function renderPartial(partialName, stash) {
    var templateString = templateData("_" + partialName);

    return ejs.render(templateString, extendObject({
        baseUrl: robohydraAdminBaseUrlPath,
        renderPartial: renderPartial
    }, stash));
}


/* There are two special stash variables used in the layout templates:
 * - title (title of the page, used eg. in the <title> element)
 * - currentSection (URL for the current section, eg. '/' or '/scenarios')
 */
function renderPage(res, templateName, config, userStash) {
    var pageStash = extendObject({
        baseUrl: robohydraAdminBaseUrlPath,
        renderPartial: renderPartial
    }, userStash);
    var templateString = templateData(templateName);
    var mainContent = ejs.render(templateString, pageStash);

    var layoutStash = extendObject({
        baseUrl: robohydraAdminBaseUrlPath,
        title: "RoboHydra Admin",
        currentSection: "/",
        hydraName: config.robohydra.name,
        startTime: startTimestamp,
        renderPartial: renderPartial,
        content: mainContent
    }, userStash);

    res.headers['content-type'] = 'text/html';
    res.send(ejs.render(mainLayoutTemplateString, layoutStash));
}

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
                console.warn("XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX");
                console.warn("XXX DEPRECATED: use /rest/test-results instead XXX");
                console.warn("XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX");
                req.url = robohydraAdminBaseUrlPath + '/rest/test-results';
                next(req, res);
            }
        }),
        new RoboHydraHead({
            name: 'testToScenarioCompat',
            path: robohydraAdminBaseUrlPath + '/tests/',
            handler: function(req, res, next) {
                console.warn("XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX");
                console.warn("XXX DEPRECATED URL: use /scenarios instead XXX");
                console.warn("XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX");
                req.url = req.url.replace(new RegExp('/tests'), '/scenarios');
                next(req, res);
            }
        }),
        new RoboHydraHead({
            name: 'testToScenarioToggleCompat',
            path: robohydraAdminBaseUrlPath + '/tests/:plugin/:testName',
            handler: function(req, res, next) {
                console.warn("XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX");
                console.warn("XXX DEPRECATED: use /scenarios/<PLUGIN>/<SCENARIONAME> instead XXX");
                console.warn("XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX");
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
                    renderPage(res, 'scenario-instructions', config, {
                        currentSection: '/scenarios',
                        instructions: currentScenarioInstructions,
                        currentScenario: config.robohydra.currentScenario,
                        markdown: markdown.toHTML
                    });
                } else {
                    res.headers.Location = robohydraAdminBaseUrlPath + '/scenarios';
                    res.statusCode = 302;
                    res.end();
                }
            }
        }),


        // Scenario index
        new RoboHydraHead({
            name: 'scenarioIndex',
            path: robohydraAdminBaseUrlPath + '/scenarios',
            handler: function(req, res) {
                renderPage(res, 'scenarios', config, {
                    currentSection: '/scenarios',
                    plugins: config.robohydra.getPlugins(),
                    currentTest: config.robohydra.currentTest,
                    testResults: config.robohydra.testResults
                });
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


        // Toggle RoboHydra head attachment.
        // This (DEPRECATED) URL and interface is pretty retarded, but
        // we'll keep it around for a while for compatibility purposes.
        // Once we don't want compatibility, the URL can be changed,
        // but the functionality has to stay for the web interface to
        // work
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

                res.headers['content-type'] = 'application/json; charset=utf-8';
                res.send(JSON.stringify({
                    plugin: pluginName,
                    name: headName,
                    attached: head.attached()
                }));
            }
        }),
        // Scenario information/activation
        new RoboHydraHead({
            name: 'restScenario',
            path: robohydraAdminBaseUrlPath + '/rest/plugins/:plugin/scenarios/:scenario',
            handler: function(req, res) {
                var rh = config.robohydra;
                var pluginName   = req.params.plugin;
                var scenarioName = req.params.scenario;
                var plugin = rh.getPlugin(pluginName);
                var scenario = plugin.scenarios[scenarioName];

                if (req.method === 'POST') {
                    var newActiveState = req.bodyParams.active;
                    var scenarioActive =
                            (rh.currentScenario.plugin === pluginName &&
                             rh.currentScenario.scenario === scenarioName);
                    if (scenarioActive && newActiveState === 'false') {
                        rh.stopScenario();
                    }
                    if (! scenarioActive && newActiveState === 'true') {
                        rh.startScenario(pluginName, scenarioName);
                    }
                }

                res.headers['content-type'] = 'application/json; charset=utf-8';
                res.send(JSON.stringify({
                    plugin: pluginName,
                    name: scenarioName,
                    active: (rh.currentScenario.plugin === pluginName &&
                             rh.currentScenario.scenario === scenarioName)
                }));
            }
        }),
        // Plugin information
        new RoboHydraHead({
            name: 'restPluginList',
            path: robohydraAdminBaseUrlPath + '/rest/plugins',
            handler: function(req, res) {
                var rh = config.robohydra;

                res.headers['content-type'] = 'application/json; charset=utf-8';
                res.send(JSON.stringify({
                    plugins: rh.getPluginNames().filter(function(pluginName) {
                        return pluginName[0] !== '*';
                    })
                }));
            }
        }),
        new RoboHydraHead({
            name: 'restPlugin',
            path: robohydraAdminBaseUrlPath + '/rest/plugins/:plugin',
            handler: function(req, res) {
                var pluginName = req.params.plugin;
                var plugin = config.robohydra.getPlugin(pluginName);
                var currentScenario = config.robohydra.currentScenario;

                res.headers['content-type'] = 'application/json; charset=utf-8';
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
        new RoboHydraHead({
            name: 'restTestResults',
            path: robohydraAdminBaseUrlPath + '/rest/test-results',
            handler: function(req, res) {
                res.headers['content-type'] = 'application/json; charset=utf-8';
                res.send(JSON.stringify(config.robohydra.testResults));
            }
        }),


        // Admin UI index
        new RoboHydraHead({
            name: 'index',
            path: robohydraAdminBaseUrlPath,
            handler: function(req, res) {
                var highlightPath = req.queryParams.highlightPath || '';
                var stash = {plugins: config.robohydra.getPlugins(),
                             matchingHeads: [],
                             highlightPath: highlightPath};
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

                renderPage(res, 'index', config, stash);
            }})
    ];
};
