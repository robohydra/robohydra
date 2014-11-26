var fs          = require('fs'),
    path        = require('path'),
    querystring = require('querystring');
var ejs      = require('ejs'),
    markdown = require('markdown').markdown;
var heads                   = require('../heads'),
    RoboHydraHead           = heads.RoboHydraHead,
    RoboHydraHeadFilesystem = heads.RoboHydraHeadFilesystem,
    RoboHydraHeadProxy      = heads.RoboHydraHeadProxy;
var utils              = require("../utils"),
    extendObject       = utils.extendObject,
    deprecationWarning = utils.deprecationWarning,
    Request            = utils.Request;
var excepts = require('../exceptions'),
    RoboHydraPluginNotFoundException = excepts.RoboHydraPluginNotFoundException,
    RoboHydraHeadNotFoundException   = excepts.RoboHydraHeadNotFoundException;

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

function parseHeaders(headerString) {
    var headerLines = headerString.split(/\r?\n/).filter(function(line) {
        return line !== '';
    });
    var headerObject = {};
    for (var i = 0, len = headerLines.length; i < len; i++) {
        var headerLine = headerLines[i],
            colonMatch = /: ?/.exec(headerLine);
        if (colonMatch) {
            headerObject[headerLine.substr(0, colonMatch.index)] =
                headerLine.substr(colonMatch.index + colonMatch[0].length);
        }
    }
    return headerObject;
}

exports.name = '*admin*';
exports.getBodyParts = function(conf) {
    "use strict";

    var showAdminPlugin = !!conf.adminui_show_admin_plugin;

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
                deprecationWarning("deprecated URL /tests/results.json: use /rest/test-results instead");
                req.url = robohydraAdminBaseUrlPath + '/rest/test-results';
                next(req, res);
            }
        }),
        new RoboHydraHead({
            name: 'testToScenarioCompat',
            path: robohydraAdminBaseUrlPath + '/tests/',
            handler: function(req, res, next) {
                deprecationWarning("deprecated URL /tests: use /scenarios instead");
                req.url = req.url.replace(new RegExp('/tests'), '/scenarios');
                next(req, res);
            }
        }),
        new RoboHydraHead({
            name: 'testToScenarioToggleCompat',
            path: robohydraAdminBaseUrlPath + '/tests/:plugin/:testName',
            handler: function(req, res, next) {
                deprecationWarning("use /scenarios/<PLUGIN>/<SCENARIONAME> instead");
                req.url = robohydraAdminBaseUrlPath +
                    '/scenarios/' + req.params.plugin + '/' +
                    req.params.testName;

                var cScenario = conf.robohydra.currentScenario;
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
                var cScenario = conf.robohydra.currentScenario;
                var plugin = req.params.plugin,
                    scenarioName = req.params.scenarioName;
                var startScenario = false;
                if (cScenario.plugin === plugin &&
                        cScenario.scenario === scenarioName) {
                    conf.robohydra.stopScenario();
                } else {
                    conf.robohydra.startScenario(plugin, scenarioName);
                    startScenario = true;
                }

                var p = conf.robohydra.currentScenario.plugin,
                    t = conf.robohydra.currentScenario.scenario;
                var currentScenarioInstructions;
                if (startScenario &&
                    (currentScenarioInstructions =
                     conf.robohydra.getPlugin(p).scenarios[t].instructions)) {
                    renderPage(res, 'scenario-instructions', conf, {
                        currentSection: '/scenarios',
                        instructions: currentScenarioInstructions,
                        currentScenario: conf.robohydra.currentScenario,
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
                renderPage(res, 'scenarios', conf, {
                    currentSection: '/scenarios',
                    plugins: conf.robohydra.getPlugins(),
                    currentTest: conf.robohydra.currentTest,
                    testResults: conf.robohydra.testResults
                });
            }
        }),


        // Create dynamic RoboHydra heads
        new RoboHydraHead({
            name: 'createHead',
            path: robohydraAdminBaseUrlPath + '/head/create',
            handler: function(req, res) {
                function createStaticHead(params) {
                    var content = params.newStaticHeadContent;
                    var statusCode =
                            params.newStaticHeadStatus !== '' ?
                                params.newStaticHeadStatus : 200;
                    var headers = parseHeaders(params.newStaticHeadHeaders);

                    var defaultContentType = 'application/octet-stream';
                    try {
                        JSON.parse(content);
                        defaultContentType = 'application/json';
                    } catch (e) {
                        // It's ok if it's not JSON
                    }
                    var contentType = params.newStaticHeadContentType ||
                            defaultContentType;

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
                    var queryParams = querystring.parse(queryParamString);

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
                                for (var header in headers) {
                                    res.headers[header] = headers[header];
                                }
                                res.headers['content-type'] = contentType;
                                res.statusCode = statusCode;
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
                conf.robohydra.registerDynamicHead(head);
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
                var head = conf.robohydra.findHead(pluginName, headName);
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
                var head;
                try {
                    head = conf.robohydra.findHead(pluginName, headName);
                } catch (e) {
                    if (e instanceof RoboHydraHeadNotFoundException) {
                        res.statusCode = 404;
                        res.send("Head '" + headName +
                                     "' not found in plugin '" +
                                     pluginName + "'");
                        return;
                    }
                }

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
                var rh = conf.robohydra;
                var pluginName   = req.params.plugin;
                var scenarioName = req.params.scenario;

                try {
                    var plugin = rh.getPlugin(pluginName);

                    if (! plugin.scenarios.hasOwnProperty(scenarioName)) {
                        res.statusCode = 404;
                        res.send("Scenario '" + pluginName +
                                     "' not found in plugin '" +
                                     pluginName + "'");
                        return;
                    }
                } catch (e) {
                    if (e instanceof RoboHydraPluginNotFoundException) {
                        res.statusCode = 404;
                        res.send("Plugin '" + pluginName + "' not found");
                        return;
                    }
                }

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
                var rh = conf.robohydra;

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
                var plugin = conf.robohydra.getPlugin(pluginName);
                var currentScenario = conf.robohydra.currentScenario;

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
                res.send(JSON.stringify(conf.robohydra.testResults));
            }
        }),


        // Admin UI index
        new RoboHydraHead({
            name: 'index',
            path: robohydraAdminBaseUrlPath,
            handler: function(req, res) {
                var highlightPath = req.queryParams.highlightPath || '';
                var highlightMethod = req.queryParams.highlightMethod || 'GET';
                var stash = {plugins: conf.robohydra.getPlugins(),
                             matchingHeads: [],
                             highlightPath: highlightPath,
                             highlightMethod: highlightMethod};
                if (! showAdminPlugin) {
                    stash.plugins = stash.plugins.filter(function(plugin) {
                        return plugin.name !== '*admin*';
                    });
                }
                if (highlightPath) {
                    var matchingPair;
                    while (1) {
                        matchingPair = conf.robohydra.headForPath(
                            new Request({url: highlightPath,
                                         method: highlightMethod}),
                            matchingPair
                        );
                        if (! matchingPair) {
                            break;
                        }

                        stash.matchingHeads.push({
                            plugin: matchingPair.plugin.name,
                            head:   matchingPair.head.name
                        });
                    }
                }

                renderPage(res, 'index', conf, stash);
            }})
    ];
};
