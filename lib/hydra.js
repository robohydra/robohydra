var fs = require('fs');
var HydraHead           = require('./hydraHead.js').HydraHead,
    HydraHeadStatic     = require('./hydraHead.js').HydraHeadStatic,
    HydraHeadFilesystem = require('./hydraHead.js').HydraHeadFilesystem,
    HydraHeadProxy      = require('./hydraHead.js').HydraHeadProxy;
var serveStaticFile = require('./hydraUtils.js').serveStaticFile,
    proxyRequest    = require('./hydraUtils.js').proxyRequest;

var InvalidHydraPluginException = function(message) {
    this.name    = "InvalidHydraPluginException";
    this.message = message || 'Invalid or incomplete plugin';
};
InvalidHydraPluginException.prototype.toString = function() {
    return "InvalidHydraPluginException";
};

var DuplicateHydraPluginException = function(message) {
    this.name    = "DuplicateHydraPluginException";
    this.message = message || 'Duplicate or incomplete plugin';
};
DuplicateHydraPluginException.prototype.toString = function() {
    return "DuplicateHydraPluginException";
};

var DuplicateHydraHeadNameException = function(head) {
    this.name    = "DuplicateHydraHeadNameException";
    this.message = 'Duplicate Hydra head name "' + head + '"';
};
DuplicateHydraHeadNameException.prototype.toString = function() {
    return "DuplicateHydraHeadNameException";
};

var HydraHeadNotFoundException = function(pluginName, headName) {
    this.name    = "HydraHeadNotFoundException";
    this.message = 'Could not find the given head ("' + pluginName +
            '" / "' + headName + '")';
};
HydraHeadNotFoundException.prototype.toString = function() {
    return "HydraHeadNotFoundException";
};

var HydraPluginNotFoundException = function(pluginName) {
    this.name    = "HydraPluginNotFoundException";
    this.message = 'Could not find the given plugin ("' + pluginName + '")';
};
HydraPluginNotFoundException.prototype.toString = function() {
    return "HydraPluginNotFoundException";
};

var Hydra = function() {
    this._plugins = [];
    this._headMap = {};
    this._count = 0;
    // The first slash in "/./hydra..." is needed because this list
    // will always be appended to an absolute path (the current
    // directory or something else)
    this._pluginLoadPath = ['/./hydra-plugins',
                            '/usr/local/share/hydra/plugins',
                            '/usr/share/hydra/plugins'];
};
Hydra.prototype._validatePluginName = function(pluginName) {
    return (typeof(pluginName) === 'string' &&
                pluginName.match(new RegExp('^[a-z0-9_-]+$', 'i')));
};
Hydra.prototype.registerPluginObject = function(plugin) {
    if (! this._validatePluginName(plugin.name))
        throw new InvalidHydraPluginException("Invalid plugin name '" +
                                              plugin.name + "'");
    if (typeof(plugin.heads) === 'undefined' || !plugin.heads.length)
        throw new InvalidHydraPluginException("Plugin doesn't have any heads");

    var name = plugin.name;
    if (this._plugins.some(function(v) { return v.plugin.name === name; })) {
        throw new DuplicateHydraPluginException();
    }

    var self = this;
    var anonymousHeadCount = 0;
    var headMap = {};
    plugin.heads.forEach(function(head) {
        // Calculate head name if not specified
        if (typeof(head.name) === 'undefined') {
            head.name = 'anonymousHydraHead' + anonymousHeadCount;
            anonymousHeadCount++;
        }

        if (headMap.hasOwnProperty(head.name)) {
            throw new DuplicateHydraHeadNameException(head.name);
        }
        headMap[head.name] = head;
    });
    this._plugins.push({headMap: headMap, plugin: plugin});
};
Hydra.prototype.getPluginNames = function() {
    return this.getPlugins().map(function(p) { return p.name; });
};
Hydra.prototype.getPlugins = function() {
    return this._plugins.map(function(v) { return v.plugin; });
};
Hydra.prototype.getPlugin = function(pluginName) {
    var pluginList = this._plugins.filter(function(p) {
                         return p.plugin.name === pluginName;
                     });
    if (pluginList.length) {
        return pluginList[0].plugin;
    }
    throw new HydraPluginNotFoundException(pluginName);
};
Hydra.prototype.handle = function(req, res, cb) {
    var handled = false;
    outerloop:
    for (var i = 0, len = this._plugins.length; i < len; i++) {
        var plugin = this._plugins[i].plugin;
        for (var j = 0, len2 = plugin.heads.length; j < len2; j++) {
            if (plugin.heads[j].canHandle(req.url)) {
                res.statusCode = 200;
                plugin.heads[j].handle(req, res, cb);
                handled = true;
                break outerloop;
            }
        }
    }
    if (! handled) {
        res.statusCode = 404;
        res.send("Not Found");
    }
};
Hydra.prototype.findHead = function(pluginName, headName) {
    for (var i = 0, len = this._plugins.length; i < len; i++) {
        if (this._plugins[i].plugin.name === pluginName) {
            var head = this._plugins[i].headMap[headName];
            if (typeof(head) === 'undefined') {
                throw new HydraHeadNotFoundException(pluginName, headName);
            } else {
                return head;
            }
        }
    }
    throw new HydraHeadNotFoundException(pluginName, headName);
};
Hydra.prototype.detachHead = function(pluginName, headName) {
    this.findHead(pluginName, headName).detach();
};
Hydra.prototype.attachHead = function(pluginName, headName) {
    this.findHead(pluginName, headName).attach();
};
Hydra.prototype.addPluginLoadPath = function(path) {
    this._pluginLoadPath.unshift(path);
};
// Return an object with keys 'module', 'config' and 'name'. The
// 'config' value is another object with keys 'path', 'hydra' and any
// other values from the configuration. It throws an exception
// HydraPluginNotFoundException if the plugin could not be found
Hydra.prototype.loadPlugin = function(name, config, opts) {
    opts = opts || {};
    var rootDir = fs.realpathSync(opts.rootDir || '');
    var plugin = {};
    var stat = undefined, fullPath;
    for (var i = 0, len = this._pluginLoadPath.length; i < len; i++) {
        try {
            fullPath = rootDir + this._pluginLoadPath[i] + '/' + name;
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
        plugin.config = {hydra: this, path: fullPath};
        for (var p in config) plugin.config[p] = config[p];
        return plugin;
    } else {
        throw new HydraPluginNotFoundException(name);
    }
};


function headTypeToConstructor(headType) {
    var headTypeMap = {
        'generic': HydraHead,
        'static': HydraHeadStatic,
        'filesystem': HydraHeadFilesystem,
        'proxy': HydraHeadProxy
    };
    return headTypeMap[headType];
}

function summonHydraBodyParts(bodyPartDefinition) {
    if (typeof(bodyPartDefinition.heads) === 'undefined') {
        throw new InvalidHydraPluginException();
    } else {
        var bodyParts = {};
        bodyParts.heads =
            bodyPartDefinition.heads.map(function(part) {
                var params = {};
                for (var i in part) {
                    if (part.hasOwnProperty(i)) params[i] = part[i];
                }

                var constructorFunction = headTypeToConstructor(part.type);
                if (typeof(constructorFunction) === 'function') {
                    return new constructorFunction(params);
                } else {
                    throw new InvalidHydraPluginException("Unknown head type '" + part.type + "'");
                }
            });
        return bodyParts;
    }
}

exports.Hydra                = Hydra;
exports.summonHydraBodyParts = summonHydraBodyParts;
exports.serveStaticFile = serveStaticFile;
exports.proxyRequest = proxyRequest;
