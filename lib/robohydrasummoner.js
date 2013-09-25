var fs = require('fs');
var robohydra                        = require('../lib/robohydra'),
    RoboHydra                        = robohydra.RoboHydra,
    RoboHydraPluginNotFoundException =
        robohydra.RoboHydraPluginNotFoundException,
    InvalidRoboHydraConfigurationException  =
        robohydra.InvalidRoboHydraConfigurationException,
    InvalidRoboHydraPluginException  =
        robohydra.InvalidRoboHydraPluginException;
var extendObject = require("../lib/utils").extendObject;

(function () {
    "use strict";

    function RoboHydraSummoner(pluginConfiguration, summonerConfig, opts) {
        this.extraVars = opts.extraVars || {};
        this.config = summonerConfig || {};
        this.rootDir = opts.rootDir ? fs.realpathSync(opts.rootDir) : '';
        this.hydras = {};
        this._pluginLoadPath = ['robohydra/plugins',
                                '/usr/local/share/robohydra/plugins',
                                '/usr/share/robohydra/plugins',
                                __dirname + '/../plugins'];
        if (opts.extraPluginLoadPaths) {
            var self = this;
            opts.extraPluginLoadPaths.forEach(function(path) {
                self._pluginLoadPath.unshift(path);
            });
        }
        this.pluginInfoList = this._requirePlugins(
            this._normalisePluginConfig(pluginConfiguration)
        );
        this.hydraPicker = this._getHydraPicker(this.pluginInfoList) ||
            function() { return "*default*"; };
    }
    RoboHydraSummoner.prototype._normalisePluginConfig = function(pluginConf) {
        return pluginConf.map(function(pluginDefinition) {
            return typeof pluginDefinition === 'string' ?
                {name: pluginDefinition, config: {}} :
                pluginDefinition;
        });
    };
    RoboHydraSummoner.prototype._resolvePluginConfig = function(config) {
        return extendObject(config, this.extraVars);
    };
    RoboHydraSummoner.prototype._getHydraPicker = function(pluginInfoList) {
        var found = false, hydraPicker, self = this;
        var pickerPlugin = self.config.hydraPickerPlugin;
        pluginInfoList.forEach(function(pluginInfo) {
            var mod = pluginInfo.module;
            if ("getSummonerTraits" in mod) {
                if (found && ! pickerPlugin) {
                    throw new InvalidRoboHydraConfigurationException(
                        "More than one authentication function available");
                } else {
                    if (! pickerPlugin || pickerPlugin === pluginInfo.name) {
                        found = true;
                        var traits = mod.getSummonerTraits(self._resolvePluginConfig(pluginInfo.config));
                        if (typeof(traits.hydraPicker) === 'function') {
                            hydraPicker = traits.hydraPicker;
                        } else {
                            throw new InvalidRoboHydraPluginException(
                                "RoboHydra picker is not a function in " +
                                    "plugin '" + pluginInfo.name + "'"
                            );
                        }
                    }
                }
            }
        });

        if (pickerPlugin && !hydraPicker) {
            throw new InvalidRoboHydraConfigurationException(
                "Invalid RoboHydra picker plugin '" + pickerPlugin + "'"
            );
        }
        return hydraPicker;
    };
    // Returns an array of plugin information objects for the plugins
    // mentioned in the given configuration. Each plugin information
    // object contains the keys 'name', 'path', 'config' and 'module'.
    RoboHydraSummoner.prototype._requirePlugins = function(pluginConfiguration) {
        var self = this;
        return pluginConfiguration.map(function(pluginNameAndConfig) {
            var pluginName   = pluginNameAndConfig.name,
                pluginConfig = pluginNameAndConfig.config,
                plugin;

            try {
                plugin = self._requirePlugin(pluginName);
                plugin.config = pluginConfig;
            } catch(e) {
                if (e instanceof RoboHydraPluginNotFoundException) {
                    console.error("Could not find or load plugin '"+pluginName+"'");
                } else {
                    console.error("Unknown error loading plugin '"+pluginName+"'");
                }
                throw e;
            }

            return plugin;
        });
    };
    RoboHydraSummoner.prototype.summonRoboHydraForRequest = function(req) {
        var name = this.hydraPicker(req);

        if (! (name in this.hydras)) {
            this.hydras[name] = this._createHydra(name);
        }

        return this.hydras[name];
    };
    RoboHydraSummoner.prototype._createHydra = function(name) {
        var hydra = new RoboHydra(this.extraVars);
        hydra.name = name;

        this.pluginInfoList.forEach(function(pluginInfo) {
            hydra.registerPluginObject(pluginInfo);
        });

        return hydra;
    };
    // Return an object with keys 'name', 'module' and 'path'. It
    // throws an exception RoboHydraPluginNotFoundException if the
    // plugin could not be found.
    RoboHydraSummoner.prototype._requirePlugin = function(name) {
        var plugin = {};
        var stat, fullPath;
        for (var i = 0, len = this._pluginLoadPath.length; i < len; i++) {
            try {
                fullPath = this.rootDir +
                    (this._pluginLoadPath[i].indexOf('/') !== 0 ?
                     fs.realpathSync('.') + '/' : '') +
                    this._pluginLoadPath[i] + '/' + name;
                stat = fs.statSync(fullPath);
            } catch (e) {
                // It's ok if the plugin is not in this directory
                if (e.code !== 'ENOENT') {
                    throw e;
                }
            }
            if (stat && stat.isDirectory()) {
                plugin.module = require(fullPath);
                break;
            }
        }
        if (plugin.module) {
            plugin.name = name;
            plugin.path = fullPath;
            return plugin;
        } else {
            throw new RoboHydraPluginNotFoundException(name);
        }
    };


    exports.RoboHydraSummoner = RoboHydraSummoner;
}());
