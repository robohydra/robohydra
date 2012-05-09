/*global require, exports*/

var fs = require('fs');
var hydraHeads          = require('./hydraHead'),
    HydraHead           = hydraHeads.HydraHead,
    HydraHeadStatic     = hydraHeads.HydraHeadStatic,
    HydraHeadFilesystem = hydraHeads.HydraHeadFilesystem,
    HydraHeadProxy      = hydraHeads.HydraHeadProxy;
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

var InvalidHydraTestException = function(pluginName, testName) {
    this.name    = "InvalidHydraTestException";
    this.message = 'Could not find the given test ("' + pluginName + '" / "' +
            testName + '")';
};
InvalidHydraTestException.prototype.toString = function() {
    return "InvalidHydraTestException";
};

var InvalidHydraNextParameters = function(plugin, test,  args) {
    this.name    = "InvalidHydraNextParameters";
    this.message = 'Invalid parameters passed to the next function "' +
            plugin.name + '" / "' + test.name + '". Expected (req, res), ' +
            'received ' + args.length + ' parameters: (' +
            Array.prototype.join.call(args, ", ") + ')';
};
InvalidHydraNextParameters.prototype.toString = function() {
    return "InvalidHydraNextParameters";
};

var Hydra = function() {
    this._plugins    = [];
    this._headMap    = {};
    this.currentTest = {plugin: '*default*',
                        test:   '*default*'};
    this._pluginLoadPath = ['hydra/plugins',
                            '/usr/local/share/hydra/plugins',
                            '/usr/share/hydra/plugins'];
    // Register all special plugins
    var adminPlugin = require('./plugins/admin.js');
    adminPlugin.heads = adminPlugin.getBodyParts({hydra: this});
    this._registerPluginObject(adminPlugin);
    this._registerPluginObject({name: '*dynamic*', heads: []});
    this._registerPluginObject({name: '*current-test*', heads: []});
};
Hydra.prototype._validatePluginName = function(pluginName) {
    return (typeof(pluginName) === 'string' &&
                pluginName.match(new RegExp('^[a-z0-9_-]+$', 'i')));
};
Hydra.prototype._addHeadsToPluginStructure = function(heads, pluginStructure) {
    var anonymousHeadCount = 0;
    heads.forEach(function(head) {
        // Calculate head name if not specified
        if (typeof(head.name) === 'undefined') {
            head.name = 'anonymousHydraHead' + anonymousHeadCount;
            anonymousHeadCount++;
            while (pluginStructure.headMap.hasOwnProperty(head.name)) {
                head.name = 'anonymousHydraHead' + anonymousHeadCount;
                anonymousHeadCount++;
            }
        }

        if (pluginStructure.headMap.hasOwnProperty(head.name)) {
            throw new DuplicateHydraHeadNameException(head.name);
        }
        pluginStructure.headMap[head.name] = head;
    });
};
Hydra.prototype._registerPluginObject = function(plugin) {
    var name = plugin.name;
    if (this._plugins.some(function(v) { return v.plugin.name === name; })) {
        throw new DuplicateHydraPluginException();
    }

    var pluginToRegister = {
        name:  plugin.name,
        heads: plugin.heads || [],
        tests: plugin.tests || {}
    };

    var pluginInternalStructure = {headMap: {}, plugin: pluginToRegister};
    this._addHeadsToPluginStructure(pluginToRegister.heads,
                                    pluginInternalStructure);
    this._plugins.push(pluginInternalStructure);
};
Hydra.prototype.registerPluginObject = function(plugin) {
    if (! this._validatePluginName(plugin.name))
        throw new InvalidHydraPluginException("Invalid plugin name '" +
                                              plugin.name + "'");
    var hasHeads = (typeof plugin.heads === 'object') && plugin.heads.length;
    var hasTests = false;
    if (typeof(plugin.tests) === 'object') {
        for (var t in plugin.tests) {
            if (plugin.tests.hasOwnProperty(t)) hasTests = true;
        }
    }
    if (!hasHeads && !hasTests)
        throw new InvalidHydraPluginException("Plugin doesn't have any heads or tests");

    this._registerPluginObject(plugin);
};
Hydra.prototype.registerDynamicHead = function(head) {
    var done = false;
    for (var i = 0, len = this._plugins.length; i < len; i++) {
        if (this._plugins[i].plugin.name === '*dynamic*') {
            this._addHeadsToPluginStructure([head], this._plugins[i]);
            this._plugins[i].plugin.heads.push(head);
            done = true;
        }
    }
    if (! done) {
        throw "Internal error: couldn't find the dynamic head plugin";
    }
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
Hydra.prototype.headForPath = function(url, afterHead) {
    var canMatch = !afterHead;
    for (var i = 0, len = this._plugins.length; i < len; i++) {
        var plugin = this._plugins[i].plugin;
        for (var j = 0, len2 = plugin.heads.length; j < len2; j++) {
            if (canMatch && plugin.heads[j].canHandle(url)) {
                return {plugin: plugin, head: plugin.heads[j]};
            }

            if (typeof afterHead === 'object' &&
                    this._plugins[i].plugin.name === afterHead.plugin.name &&
                    plugin.heads[j].name  === afterHead.head.name) {
                canMatch = true;
            }
        }
    }
    return undefined;
};
Hydra.prototype.handle = function(req, res, afterHead) {
    var r = this.headForPath(req.url, afterHead);
    if (typeof(r) !== 'undefined') {
        res.statusCode = 200;
        var self = this;
        r.head.handle(req, res, function(req2, res2) {
            if (arguments.length !== 2) {
                throw new InvalidHydraNextParameters(r.plugin,
                                                     r.head,
                                                     arguments);
            }
            self.handle(req2, res2, r);
        });
    } else {
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
Hydra.prototype.requirePlugin = function(name, config, opts) {
    opts = opts || {};
    var rootDir = opts.rootDir ? fs.realpathSync(opts.rootDir) : '';
    var plugin = {};
    var stat = undefined, fullPath;
    for (var i = 0, len = this._pluginLoadPath.length; i < len; i++) {
        try {
            fullPath = rootDir +
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
        plugin.config = {hydra: this, path: fullPath};
        for (var p in config) plugin.config[p] = config[p];
        return plugin;
    } else {
        throw new HydraPluginNotFoundException(name);
    }
};
Hydra.prototype.startTest = function(pluginName, testName) {
    this.stopTest();

    var found = false;
    var testPlugin, i, len;
    for (i = 0, len = this._plugins.length; i < len; i++) {
        if (this._plugins[i].plugin.name === pluginName) {
            if (this._plugins[i].plugin.tests.hasOwnProperty(testName)) {
                testPlugin = this._plugins[i].plugin;
                this.currentTest = {plugin: pluginName, test: testName};
                found = true;
            }
        }
    }

    if (found) {
        var done = false;
        for (i = 0, len = this._plugins.length; i < len; i++) {
            if (this._plugins[i].plugin.name === '*current-test*') {
                var heads = testPlugin.tests[testName].heads;
                this._addHeadsToPluginStructure(heads, this._plugins[i]);
                Array.prototype.push.apply(this._plugins[i].plugin.heads,
                                           heads);
                done = true;
            }
        }
        if (! done) {
            throw "Internal error: couldn't find the current test plugin";
        }
    } else {
        throw new InvalidHydraTestException(pluginName, testName);
    }
};
Hydra.prototype.stopTest = function() {
    this.currentTest = {plugin: '*default*', test: '*default*'};

    for (var i = 0, len = this._plugins.length; i < len; i++) {
        if (this._plugins[i].plugin.name === '*current-test*') {
            this._plugins[i] = {headMap: {},
                                plugin: {name: '*current-test*', heads: []}};
        }
    }
};


var Response = function(cb) {
        this.body       = new Buffer(0);
        this.statusCode = 200;
        this.headers    = {};
        this.end        = cb;
};
Response.prototype.write = function(chunk) {
    if (typeof chunk === 'string') {
        chunk = new Buffer(chunk);
    }
    var tmp = new Buffer(this.body.length + chunk.length);
    this.body.copy(tmp);
    chunk.copy(tmp, this.body.length);
    this.body = tmp;
};
Response.prototype.send = function(data) {
    this.write(data);
    this.end();
};
Response.prototype.copyFrom = function(res) {
    ['statusCode', 'headers'].forEach(function(prop) {
        this[prop] = res[prop];
    });
    this.write(res.body);
};



exports.Hydra           = Hydra;
exports.Response        = Response;
exports.serveStaticFile = serveStaticFile;
exports.proxyRequest    = proxyRequest;
exports.heads           = hydraHeads;
