var fs     = require('fs'),
    path   = require('path'),
    assert = require('assert');
var utils              = require('./utils.js'),
    extendObject       = utils.extendObject,
    deprecationWarning = utils.deprecationWarning;
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

    /**
     * All RoboHydra public API.
     *
     * @class robohydra
     */

    /**
     * Dispatches the incoming requests. Normally there is only one of
     * this per server, but there can be several if summoners are
     * used.
     *
     * @class RoboHydra
     * @for robohydra
     * @constructor
     * @param {Object} extraVars An optional object with the extra
     * configuration variables. These take precedence over any other
     * configuration variables elsewhere, and are the values passed as
     * command-line parameters in the "robohydra" executable.
     */

    /**
     * The currently active scenario, if any. It's an object with the
     * keys "plugin" and "scenario". If there’s no active scenario,
     * it’s "\*default\*" / "\*default\*".
     *
     * @property {Object} currentScenario
     * @for RoboHydra
     */

    /**
     * Current test (assertion) results. Its keys are plugin names and
     * its values are objects with scenario names as keys. The values
     * of the latter objects are test results: objects with the keys
     * "result" (value is _undefined_ if the test doesn’t have any
     * result yet, or the strings "pass" or "fail" if at least one
     * assertion has run for that test), "passes" (an array with the
     * description of the passing assertions) and "failures" (ditto
     * for failing assertions). Assertion results obtained outside of
     * a scenario are stored under the plugin name "\*default\*" and the
     * scenario name "\*default\*".
     *
     * @property {Object} testResults
     */
    /**
     * Deprecated alias for testResults, please use testResults instead.
     *
     * @property {Object} scenarioResults
     * @deprecated
    */
    var RoboHydra = function(extraVars) {
        this.extraVars       = extendObject({}, extraVars || {});
        this._plugins        = [];
        this._headMap        = {};
        this.currentScenario = {plugin:   '*default*',
                                scenario: '*default*'};
        this.testResults = {'*default*': {'*default*': {result: undefined,
                                                        passes: [],
                                                        failures: []}}};
        Object.defineProperty(this, 'scenarioResults', {
            get: function() {
                deprecationWarning("scenarioResults is deprecated, please use testResults instead");
                return this.testResults;
            }
        });

        // Register special plugins
        // Admin
        var adminPlugin = require('./plugins/admin.js');
        var adminPluginConfig = extendObject(this.extraVars,
                                             {robohydra: this});
        adminPlugin.heads = adminPlugin.getBodyParts(adminPluginConfig);
        this._registerPluginObject(adminPlugin);
        // High priority, dynamic heads
        this._registerPluginObject({name: '*priority-dynamic*'});
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
            name:           plugin.name,
            heads:          plugin.heads     || [],
            scenarios:      plugin.scenarios || {}
        };

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
    /**
     * Register the given plugin object at the end of the hydra.
     *
     * @method registerPluginObject
     * @param {Object} pluginObject
     * @param {String} pluginObject.name The name of the plugin. Must
     * be exclusively comprised of ASCII letters, numbers, underscores
     * and dashes. Mandatory.
     * @param {String} pluginObject.path The path to the plugin
     * directory. Mandatory.
     * @param {Object} pluginObject.config An object with the
     * plugin-specific configuration. Optional.
     * @param {Object} pluginObject.module The plugin module itself
     * (ie. an object with the "getBodyParts" function).
     */
    RoboHydra.prototype.registerPluginObject = function(pluginObject) {
        if (! pluginObject.name) {
            throw new TypeError("To register a plugin, you need an object with properties 'name', 'path', 'config' and 'module'");
        }
        if (! this._validatePluginName(pluginObject.name)) {
            throw new InvalidRoboHydraPluginException("Invalid plugin name '" +
                                                      pluginObject.name + "'");
        }

        this._registerPluginObject(this._inflatePlugin(pluginObject));
    };
    RoboHydra.prototype._getPluginInfo = function(pluginName) {
        var pluginList = this._plugins.filter(function(p) {
                             return p.plugin.name === pluginName;
                         });
        return pluginList.length ? pluginList[0] : undefined;
    };
    /**
     * Adds a new (dynamic) head into a hydra. The new head is added
     * at the beginning of the appropriate pseudo-plugin ("*dynamic*"
     * by default, "*priority-dynamic*" if the priority is set to
     * "high"). The order of the plugins is: special admin plugin
     * (which is normally not visible in the admin interface!),
     * "*priority-dynamic*", "*dynamic*", "*current-scenario*", and
     * regular plugins.
     *
     * @method registerDynamicHead
     * @param {RoboHydraHead} head The head to add
     * @param {Object} opts Options
     * @param {String} opts.priority The priority of the head. Can be
     * "normal" or "high"
     */
    RoboHydra.prototype.registerDynamicHead = function(head, opts) {
        opts = opts || {};
        var prio = opts.priority || 'normal';
        if (DYNAMIC_HEAD_PRIORITIES.indexOf(prio) === -1) {
            throw new RoboHydraException("Invalid head priority '" + prio + "'");
        }

        var pseudoPluginName = prio === 'high' ? '*priority-dynamic*' : '*dynamic*';
        this._registerHeadsInPseudoPlugin([head], pseudoPluginName);
    };
    RoboHydra.prototype._registerHeadsInPseudoPlugin = function(heads, pseudoPluginName) {
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
    /**
     * Returns the names of the current plugins, including pseudo-plugins.
     *
     * @method getPluginNames
     * @return {Array} An array with the names of the plugins in the hydra.
     */
    RoboHydra.prototype.getPluginNames = function() {
        return this.getPlugins().map(function(p) { return p.name; });
    };
    /**
     * Returns a list of all current plugins, including pseudo-plugins.
     *
     * @method getPlugins
     * @return {Array} An array containing all plugins in the hydra.
     */
    RoboHydra.prototype.getPlugins = function() {
        return this._plugins.map(function(v) { return v.plugin; });
    };
    /**
     * Returns a plugin given its name.
     *
     * @method getPlugin
     * @param {String} pluginName The name of the plugin
     * @return {Object} The plugin with the given name
     */
    RoboHydra.prototype.getPlugin = function(pluginName) {
        var pluginList = this._plugins.filter(function(p) {
            return p.plugin.name === pluginName;
        });
        if (pluginList.length) {
            return pluginList[0].plugin;
        }
        throw new RoboHydraPluginNotFoundException(pluginName);
    };
    /**
     * Returns the first head that matches a given URL.
     *
     * @method headForPath
     * @param {Request} req Request object the head must match
     * @param {RoboHydraHead} afterHead If given, only heads after the
     * given one will be considered for matching.
     * @return {RoboHydraHead} First head matching the given URL.
     */
    RoboHydra.prototype.headForPath = function(req, afterHead) {
        var canMatchYet = !afterHead;
        for (var i = 0, len = this._plugins.length; i < len; i++) {
            var plugin = this._plugins[i].plugin;
            for (var j = 0, len2 = plugin.heads.length; j < len2; j++) {
                if (canMatchYet && plugin.heads[j].canHandle(req)) {
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
        var r = this.headForPath(req, afterHead);
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
    RoboHydra.prototype.webSocketHandle = function(req, socket) {
        for (var i = 0, len = this._plugins.length; i < len; i++) {
            var plugin = this._plugins[i].plugin;
            for (var j = 0, len2 = plugin.heads.length; j < len2; j++) {
                if (plugin.heads[j].canHandle(req)) {
                    plugin.heads[j].handle(req, socket);
                    return;
                }
            }
        }

        socket.close();
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
    /**
     * Detach the given head.
     *
     * @method detachHead
     * @param {String} pluginName The name of the plugin containing the head to
     * detach.
     * @param {String} headName The name of the head to detach.
     */
    RoboHydra.prototype.detachHead = function(pluginName, headName) {
        this.findHead(pluginName, headName).detach();
    };
    /**
     * Attach the given head.
     *
     * @method attachHead
     * @param {String} pluginName The name of the plugin containing the head to
     * (re-)attach.
     * @param {String} headName The name of the head to (re-)attach.
     */
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
            robohydra: this,
            path: pluginInfo.path
        }, pluginInfo.config, this.extraVars);
        var modulesObject = this.getModulesObject(finalPluginConfig);
        var inflatedPlugin = pluginInfo.module.getBodyParts(
            finalPluginConfig,
            modulesObject
        );

        // Check for unknown properties
        for (var prop in inflatedPlugin) {
            if (['heads', 'scenarios'].indexOf(prop) === -1) {
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

        // Check for unknown properties in scenarios
        for (var scenarioName in inflatedPlugin.scenarios) {
            var scenario = inflatedPlugin.scenarios[scenarioName];
            if (!('heads' in scenario)) {
                throw new InvalidRoboHydraPluginException(
                    "Scenario '" + scenarioName + "' doesn't contain any heads"
                );
            }

            for (var prop in scenario) {
                if (['heads', 'instructions'].indexOf(prop) === -1) {
                    throw new InvalidRoboHydraPluginException(
                        "Invalid scenario property '" + prop + "' in " +
                            "scenario '" + scenarioName + "'"
                    );
                }
            }
        }

        inflatedPlugin.name = pluginInfo.name;
        return inflatedPlugin;
    };
    /**
     * Start the given scenario.
     *
     * @method startScenario
     * @param {String} pluginName The name of the plugin containing
     * the scenario to start.
     * @param {String} scenarioName The name of the scenario to start.
     */
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
            this._registerHeadsInPseudoPlugin(heads, '*current-scenario*');

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
    /**
     * Stop the given scenario.
     *
     * @method stopScenario
     * @param {String} pluginName The name of the plugin containing
     * the scenario to stop.
     * @param {String} scenarioName The name of the scenario to stop.
     */
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
    /**
     * Returns an object with the modules for a given plugin.
     *
     * @method getModulesObject
     * @param {Object} conf The full, resolved configuration for the
     * plugin the module object is for.
     * @return {Object} Object with the names of the available modules
     * as keys, and objects with functions as values.
     */
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


    module.exports = RoboHydra;
}());
