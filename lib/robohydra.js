var fs     = require('fs'),
    path   = require('path'),
    assert = require('assert');
var heads = require('./heads');
var utils              = require('./utils.js'),
    serveStaticFile    = utils.serveStaticFile,
    proxyRequest       = utils.proxyRequest,
    stringForLog       = utils.stringForLog,
    extendObject       = utils.extendObject,
    deprecationWarning = utils.deprecationWarning,
    Request            = utils.Request,
    Response           = utils.Response;
var exceptions         = require('./exceptions.js'),
    RoboHydraException = exceptions.RoboHydraException,
    DuplicateRoboHydraHeadNameException =
        exceptions.DuplicateRoboHydraHeadNameException,
    InvalidRoboHydraConfigurationException =
        exceptions.InvalidRoboHydraConfigurationException,
    InvalidRoboHydraPluginException =
        exceptions.InvalidRoboHydraPluginException,
    RoboHydraPluginNotFoundException =
        exceptions.RoboHydraPluginNotFoundException,
    InvalidRoboHydraNextParametersException =
        exceptions.InvalidRoboHydraNextParametersException,
    RoboHydraHeadNotFoundException =
        exceptions.RoboHydraHeadNotFoundException,
    InvalidRoboHydraScenarioException =
        exceptions.InvalidRoboHydraScenarioException;


(function () {
    "use strict";

    var DYNAMIC_HEAD_PRIORITIES = ['normal', 'high'];

    var RoboHydra = function(extraVars) {
        this.extraVars       = extendObject({}, extraVars || {});
        this._plugins        = [];
        this._headMap        = {};
        this.currentScenario = {plugin:   '*default*',
                                scenario: '*default*'};
        // Deprecated, only kept for compatibility for a while
        Object.defineProperty(this, 'currentTest', {
            get: function() {
                return {plugin: this.currentScenario.plugin,
                        test: this.currentScenario.scenario};
            }
        });
        this.scenarioResults = {'*default*': {'*default*': {result: undefined,
                                                            passes: [],
                                                            failures: []}}};
        // Deprecated, only kept for compatibility for a while
        this.testResults = this.scenarioResults;

        // Register special plugins
        // Top priority heads
        this._registerPluginObject({name: '*priority-dynamic*'});
        // Admin
        var adminPlugin = require('./plugins/admin.js');
        var adminPluginConfig = extendObject(this.extraVars,
                                             {robohydra: this});
        adminPlugin.heads = adminPlugin.getBodyParts(adminPluginConfig);
        this._registerPluginObject(adminPlugin);
        // Dynamic heads
        this._registerPluginObject({name: '*dynamic*'});
        // Current scenario heads
        this._registerPluginObject({name: '*current-scenario*'});
    };
    RoboHydra.prototype._validatePluginName = function(pluginName) {
        return (typeof(pluginName) === 'string' &&
                pluginName.match(new RegExp('^[a-z0-9_-]+$', 'i')));
    };
    RoboHydra.prototype._addHeadsToPluginStructure = function(heads, pluginStructure) {
        var anonymousHeadCount = 0;
        (heads || []).forEach(function(head) {
            // Calculate head name if not specified
            if (head.name === undefined) {
                head.name = 'anonymousHead' + anonymousHeadCount;
                anonymousHeadCount++;
                while (pluginStructure.headMap.hasOwnProperty(head.name)) {
                    head.name = 'anonymousHead' + anonymousHeadCount;
                    anonymousHeadCount++;
                }
            }

            if (pluginStructure.headMap.hasOwnProperty(head.name)) {
                throw new DuplicateRoboHydraHeadNameException(head.name);
            }
            pluginStructure.headMap[head.name] = head;
        });
    };
    RoboHydra.prototype._emptyPluginStructure = function(plugin) {
        var pluginToRegister = {
            name:      plugin.name,
            heads:     plugin.heads     || [],
            scenarios: plugin.scenarios || {}
        };
        // Deprecated, only kept for compatibility for a while
        if (plugin.tests) {
            deprecationWarning("Using 'tests' in a plugin is deprecated, please use 'scenarios' instead");
            pluginToRegister.scenarios = plugin.tests;
        }
        pluginToRegister.tests = pluginToRegister.scenarios;

        return {headMap: {}, plugin: pluginToRegister};
    };
    RoboHydra.prototype._registerPluginObject = function(plugin) {
        var name = plugin.name;
        if (this._getPluginInfo(plugin.name)) {
            throw new InvalidRoboHydraConfigurationException(
                "Duplicate plugin '" + name + "'");
        }

        var pluginInternalStructure = this._emptyPluginStructure(plugin);
        this._addHeadsToPluginStructure(plugin.heads, pluginInternalStructure);
        this._plugins.push(pluginInternalStructure);
    };
    RoboHydra.prototype.registerPluginObject = function(pluginObject) {
        this._registerPluginObject(this._inflatePlugin(pluginObject));
    };
    RoboHydra.prototype._getPluginInfo = function(pluginName) {
        var pluginList = this._plugins.filter(function(p) {
                             return p.plugin.name === pluginName;
                         });
        return pluginList.length ? pluginList[0] : undefined;
    };
    RoboHydra.prototype.registerDynamicHead = function(head, opts) {
        opts = opts || {};
        var prio = opts.priority || 'normal';
        if (DYNAMIC_HEAD_PRIORITIES.indexOf(prio) === -1) {
            throw new RoboHydraException("Invalid head priority '" + prio + "'");
        }

        var pseudoPluginName = prio === 'high' ? '*priority-dynamic*' : '*dynamic*';
        this._registerHeads([head], pseudoPluginName);
    };
    RoboHydra.prototype._registerHeads = function(heads, pseudoPluginName) {
        var done = false;
        for (var i = 0, len = this._plugins.length; i < len; i++) {
            if (this._plugins[i].plugin.name === pseudoPluginName) {
                this._addHeadsToPluginStructure(heads, this._plugins[i]);
                Array.prototype.unshift.apply(this._plugins[i].plugin.heads,
                                              heads);
                done = true;
            }
        }
        if (! done) {
            throw new RoboHydraException("Internal error: couldn't find the plugin '" + pseudoPluginName + "'");
        }
    };
    RoboHydra.prototype.getPluginNames = function() {
        return this.getPlugins().map(function(p) { return p.name; });
    };
    RoboHydra.prototype.getPlugins = function() {
        return this._plugins.map(function(v) { return v.plugin; });
    };
    RoboHydra.prototype.getPlugin = function(pluginName) {
        var pluginList = this._plugins.filter(function(p) {
            return p.plugin.name === pluginName;
        });
        if (pluginList.length) {
            return pluginList[0].plugin;
        }
        throw new RoboHydraPluginNotFoundException(pluginName);
    };
    RoboHydra.prototype.headForPath = function(url, afterHead) {
        var canMatchYet = !afterHead;
        for (var i = 0, len = this._plugins.length; i < len; i++) {
            var plugin = this._plugins[i].plugin;
            for (var j = 0, len2 = plugin.heads.length; j < len2; j++) {
                if (canMatchYet && plugin.heads[j].canHandle(url)) {
                    return {plugin: plugin, head: plugin.heads[j]};
                }

                if (typeof afterHead === 'object' &&
                    this._plugins[i].plugin.name === afterHead.plugin.name &&
                    plugin.heads[j].name  === afterHead.head.name) {
                    canMatchYet = true;
                }
            }
        }
        return undefined;
    };
    RoboHydra.prototype.handle = function(req, res, afterHead) {
        var r = this.headForPath(req.url, afterHead);
        if (r !== undefined) {
            res.statusCode = 200;
            var self = this;
            r.head.handle(req, res, function(req2, res2) {
                if (arguments.length !== 2) {
                    throw new InvalidRoboHydraNextParametersException(
                        r.plugin,
                        r.head,
                        arguments
                    );
                }
                self.handle(req2, res2, r);
            });
        } else {
            res.statusCode = 404;
            res.send("Not Found");
        }
    };
    RoboHydra.prototype.findHead = function(pluginName, headName) {
        for (var i = 0, len = this._plugins.length; i < len; i++) {
            if (this._plugins[i].plugin.name === pluginName) {
                var head = this._plugins[i].headMap[headName];
                if (head === undefined) {
                    throw new RoboHydraHeadNotFoundException(pluginName, headName);
                } else {
                    return head;
                }
            }
        }
        throw new RoboHydraHeadNotFoundException(pluginName, headName);
    };
    RoboHydra.prototype.isHeadAttached = function(pluginName, headName) {
        // This will throw an exception if the head is not found
        var head = this.findHead(pluginName, headName);
        return head.attached();
    };
    RoboHydra.prototype.detachHead = function(pluginName, headName) {
        this.findHead(pluginName, headName).detach();
    };
    RoboHydra.prototype.attachHead = function(pluginName, headName) {
        this.findHead(pluginName, headName).attach();
    };
    RoboHydra.prototype._jsFilesIn = function(testDir) {
        var testFiles = [];
        try {
            testFiles = fs.readdirSync(testDir).filter(function(fname) {
                return (/\.js/).test(fname);
            });
        } catch(e) {
            if (e.code !== 'ENOENT') {
                throw e;
            }
        }
        return testFiles;
    };
    RoboHydra.prototype._inflatePlugin = function(pluginInfo) {
        var finalPluginConfig = extendObject({
            robohydra: this, path: pluginInfo.path
        }, pluginInfo.config, this.extraVars);
        var modulesObject = this.getModulesObject(finalPluginConfig);
        var inflatedPlugin = pluginInfo.module.getBodyParts(
            finalPluginConfig,
            modulesObject
        );

        // Check for unknown properties
        for (var prop in inflatedPlugin) {
            if (['heads', 'tests', 'scenarios'].indexOf(prop) === -1) {
                throw new InvalidRoboHydraPluginException(
                    "Invalid plugin property '" + prop + "'"
                );
            }
        }

        // Loads any external scenario files
        var scenarioDir = path.join(pluginInfo.path, 'scenarios');
        this._jsFilesIn(scenarioDir).forEach(function(scenarioFile) {
            var scenarioModule = require(path.join(scenarioDir, scenarioFile));
            var scenarioDefinition =
                    scenarioModule.getBodyParts(finalPluginConfig,
                                                modulesObject);
            var scenarioName = scenarioFile.replace(/\.js$/, '');
            inflatedPlugin.scenarios = inflatedPlugin.scenarios || {};
            if (scenarioName in inflatedPlugin.scenarios) {
                throw new InvalidRoboHydraPluginException("Scenario '" +
                                                          scenarioName +
                                                          "' is duplicated");
            }
            inflatedPlugin.scenarios[scenarioName] = scenarioDefinition;
        });

        // Check and set the name
        if (! this._validatePluginName(pluginInfo.name)) {
            throw new InvalidRoboHydraPluginException("Invalid plugin name '" +
                                                      pluginInfo.name + "'");
        }
        inflatedPlugin.name = pluginInfo.name;

        return inflatedPlugin;
    };
    RoboHydra.prototype.startTest = function(pluginName, testName) {
        deprecationWarning("startTest is deprecated, please use startScenario");
        this.startScenario(pluginName, testName);
    };
    RoboHydra.prototype.startScenario = function(pluginName, scenarioName) {
        this.stopScenario();

        var found = false;
        var scenarioPlugin, i, len;
        for (i = 0, len = this._plugins.length; i < len; i++) {
            if (this._plugins[i].plugin.name === pluginName) {
                if (this._plugins[i].plugin.scenarios.hasOwnProperty(scenarioName)) {
                    scenarioPlugin = this._plugins[i].plugin;
                    this.currentScenario = {plugin:   pluginName,
                                            scenario: scenarioName};
                    found = true;
                }
            }
        }

        if (found) {
            var heads = scenarioPlugin.scenarios[scenarioName].heads;
            heads.forEach(function(head) {
                head.reset();
            });
            this._registerHeads(heads, '*current-scenario*');

            this.testResults[pluginName] = this.testResults[pluginName] || {};
            this.testResults[pluginName][scenarioName] = {
                result: undefined,
                passes: [],
                failures: []
            };
        } else {
            throw new InvalidRoboHydraScenarioException(pluginName, scenarioName);
        }
    };
    RoboHydra.prototype.stopTest = function() {
        deprecationWarning("stopTest is deprecated, please use stopScenario");
        this.stopScenario();
    };
    RoboHydra.prototype.stopScenario = function() {
        this.currentScenario = {plugin: '*default*', scenario: '*default*'};

        for (var i = 0, len = this._plugins.length; i < len; i++) {
            if (this._plugins[i].plugin.name === '*current-scenario*') {
                this._plugins[i] =
                    this._emptyPluginStructure({name: '*current-scenario*'});
            }
        }
    };
    RoboHydra.prototype.getAssertionFunction = function(assertion) {
        var thisRoboHydra = this;
        return function() {
            var currentScenarioPlugin = thisRoboHydra.currentScenario.plugin,
                currentScenarioName   = thisRoboHydra.currentScenario.scenario;
            var result =
                    thisRoboHydra.testResults[currentScenarioPlugin][currentScenarioName];

            var assertionFunction = assert[assertion];
            var message = arguments[assertionFunction.length-1] ||
                    "*unnamed-assertion*";

            try {
                assertionFunction.apply(assert, arguments);

                result.passes.push(message);
                result.result = result.result || 'pass';
            }
            catch (e) {
                if (e instanceof assert.AssertionError) {
                    result.failures.push(message);
                    result.result = 'fail';
                    return false;
                } else {
                    throw e;
                }
            }
            return true;
        };
    };
    RoboHydra.prototype.getModulesObject = function(conf) {
        var utilsObject = {assert: {}, fixtures: {}};

        // Assertions
        for (var assertion in assert) {
            if (assert.hasOwnProperty(assertion) && typeof assert[assertion] === 'function') {
                utilsObject.assert[assertion] =
                    this.getAssertionFunction(assertion);
            }
        }

        // Fixture loading (TODO: add caching?)
        utilsObject.fixtures.load = function(fixturePath) {
            var normalizedFixturePath = path.normalize(fixturePath);
            var sanitizedFixturePath =
                    normalizedFixturePath.replace(new RegExp("\\.\\.", "g"), "");
            var stringPath = path.join(conf.path, "fixtures", sanitizedFixturePath);
            return fs.readFileSync(stringPath);
        };

        return utilsObject;
    };


    exports.RoboHydra          = RoboHydra;
    exports.Request            = Request;
    exports.Response           = Response;
    exports.serveStaticFile    = serveStaticFile;
    exports.proxyRequest       = proxyRequest;
    exports.stringForLog       = stringForLog;
    exports.heads              = heads;
    exports.roboHydraHeadType  = heads.roboHydraHeadType;
    exports.RoboHydraException = RoboHydraException;
    for (var exception in exceptions) {
        exports[exception] = exceptions[exception];
    }
}());
