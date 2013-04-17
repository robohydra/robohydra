var fs = require('fs');
var robohydra                        = require('../lib/robohydra'),
    RoboHydra                        = robohydra.RoboHydra,
    RoboHydraPluginNotFoundException =
        robohydra.RoboHydraPluginNotFoundException,
    InvalidRoboHydraConfigurationException  =
        robohydra.InvalidRoboHydraConfigurationException,
    InvalidRoboHydraPluginException  =
        robohydra.InvalidRoboHydraPluginException;

(function () {
    "use strict";

    function RoboHydraSummoner(pluginConfiguration, opts) {
        this.extraVars = opts.extraVars || {};
        this.rootDir = opts.rootDir ? fs.realpathSync(opts.rootDir) : '';
        this.hydras = {};
        this._pluginLoadPath = ['robohydra/plugins',
                                'node_modules/robohydra/plugins',
                                '/usr/local/share/robohydra/plugins',
                                '/usr/share/robohydra/plugins'];
        if (opts.extraPluginLoadPaths) {
            var self = this;
            opts.extraPluginLoadPaths.forEach(function(path) {
                self._pluginLoadPath.unshift(path);
            });
        }
        this.pluginInfoList =
            this._initPlugins(this._resolvePluginConfig(pluginConfiguration,
                                                        this.extraVars));
        this.robohydraPicker =
            this._getRoboHydraPicker(this.pluginInfoList) ||
            function() { return "*default*"; };
    }
    RoboHydraSummoner.prototype._resolvePluginConfig = function(pluginConfig, extraVars) {
        return pluginConfig.map(function(pluginDef) {
            var pluginName = typeof pluginDef === 'string' ? pluginDef : pluginDef.name;
            var pluginSpecificConfig = pluginDef.config || {};
            var p, pluginConfig = {};
            for (p in pluginSpecificConfig) {
                pluginConfig[p] = pluginSpecificConfig[p];
            }
            for (p in extraVars) {
                pluginConfig[p] = extraVars[p];
            }

            return {name: pluginName, config: pluginConfig};
        });
    };
    RoboHydraSummoner.prototype._getRoboHydraPicker = function(pluginInfoList) {
        var found = false, robohydraPicker;
        pluginInfoList.forEach(function(pluginInfo) {
            var mod = pluginInfo.module;
            if ("getSummonerTraits" in mod) {
                if (found) {
                    throw new InvalidRoboHydraConfigurationException(
                        "More than one authentication function available");
                } else {
                    found = true;
                    var traits = mod.getSummonerTraits(pluginInfo.config);
                    if (typeof(traits.robohydraPicker) === 'function') {
                        robohydraPicker = traits.robohydraPicker;
                    } else {
                        throw new InvalidRoboHydraPluginException(
                            "RoboHydra picker is not a function in plugin '" +
                                pluginInfo.name + "'"
                        );
                    }
                }
            }
        });
        return robohydraPicker;
    };
    // Returns an array of plugin information objects for the plugins
    // mentioned in the given configuration. Each plugin information
    // object contains the keys 'name', 'path', 'config' and 'module'.
    RoboHydraSummoner.prototype._initPlugins = function(pluginConfiguration) {
        var self = this;
        return pluginConfiguration.map(function(pluginNameAndConfig) {
            var pluginName   = pluginNameAndConfig.name,
                pluginConfig = pluginNameAndConfig.config,
                plugin;

            try {
                plugin = self._requirePlugin(pluginName);
            } catch(e) {
                if (e instanceof RoboHydraPluginNotFoundException) {
                    console.log("Could not find or load plugin '"+pluginName+"'");
                } else {
                    console.log("Unknown error loading plugin '"+pluginName+"'");
                }
                throw e;
            }

            plugin.name = pluginName;
            plugin.config = pluginConfig;
            return plugin;
        });
    };
    RoboHydraSummoner.prototype.summonRoboHydraForRequest = function(req) {
        var name = this.robohydraPicker(req);

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
    // Return an object with keys 'module' and 'path'. It throws an
    // exception RoboHydraPluginNotFoundException if the plugin could not
    // be found.
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
            plugin.path = fullPath;
            return plugin;
        } else {
            throw new RoboHydraPluginNotFoundException(name);
        }
    };


    exports.RoboHydraSummoner = RoboHydraSummoner;
}());
