#!/usr/bin/env node
/*global require, process, console, JSON, module, Buffer, __dirname*/

/**
 * Module dependencies.
 */

var http      = require('http'),
    https     = require('https'),
    fs        = require('fs'),
    qs        = require('qs'),
    commander = require('commander');
var robohydra = require('../lib/robohydra'),
    RoboHydra = robohydra.RoboHydra,
    Request   = robohydra.Request,
    Response  = robohydra.Response;
var RoboHydraPluginNotFoundException =
        robohydra.RoboHydraPluginNotFoundException;

commander.version('0.3.0+').
    usage("mysetup.conf [confvar=value confvar2=value2 ...]").
    option('-I <path>', 'Adds a new path in the plugin search path list').
    option('-p, --port <port>', 'Listen on this port (default 3000)', 3000).
    parse(process.argv);


// This is a bit crappy as it uses the global commander variable. But whaeva.
function showHelpAndDie(message) {
    if (message) {
        console.log(message);
    }
    console.log(commander.helpInformation());
    process.exit(1);
}


function MultiHydra(pluginList, opts) {
    this.extraVars = opts.extraVars || {};
    this.hydras = {};
    this._pluginLoadPath = ['robohydra/plugins',
                            '/usr/local/share/robohydra/plugins',
                            '/usr/share/robohydra/plugins',
                            __dirname + '/../plugins'];
    if (opts.extraPluginLoadPath) {
        this._pluginLoadPath.unshift(opts.extraPluginLoadPath);
    }
    this.pluginList = this._initPlugins(pluginList);
}
MultiHydra.prototype._initPlugins = function(pluginList) {
    var self = this;
    return pluginList.map(function(pluginNameAndConfig) {
        var pluginName   = pluginNameAndConfig[0],
            pluginConfig = pluginNameAndConfig[1],
            plugin;

        try {
            plugin = self.requirePlugin(pluginName);
        } catch(e) {
            if (e instanceof RoboHydraPluginNotFoundException) {
                console.log("Could not find or load plugin '"+pluginName+"'");
            } else {
                console.log("Unknown error loading plugin '"+pluginName+"'");
            }
            throw e;
        }

        return {name: pluginName, module: plugin, config: pluginConfig};
    });
};
MultiHydra.prototype.getHydra = function(username) {
    if (! (username in this.hydras)) {
        this.hydras[username] = this._createHydra(username);
    }

    return this.hydras[username];
};
MultiHydra.prototype._createHydra = function(username) {
    var hydra = new RoboHydra(this.extraVars);

    var self = this;
    this.pluginList.forEach(function(pluginInfo) {
        hydra.registerPluginObject(pluginInfo.name,
                                   pluginInfo.module,
                                   pluginInfo.config);
    });

    return hydra;
};
// Return an object with keys 'name', 'module' and 'path'. It throws
// an exception RoboHydraPluginNotFoundException if the plugin could
// not be found.
MultiHydra.prototype.requirePlugin = function(name, opts) {
    opts = opts || {};
    var rootDir = opts.rootDir ? fs.realpathSync(opts.rootDir) : '';
    var plugin = {};
    var stat, fullPath;
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
        plugin.path = fullPath;
        return plugin;
    } else {
        throw new RoboHydraPluginNotFoundException(name);
    }
};

function getCurrentUser(req) {
    if ('cookie' in req.headers) {
        // TODO: what about cookies that contain a ";"?
        var cookies = req.headers.cookie.split(/;\s*/);
        for (var i = 0, len = cookies.length; i < len; i++) {
            var nameAndValue = cookies[i].split('=');
            if (nameAndValue[0] === 'user') {
                return nameAndValue[1];
            }
        }
    }
    return "*default*";
}


// Process the options
var extraPluginLoadPath;
if (commander.I) {
    extraPluginLoadPath = commander.I;
}
// Check parameters and load RoboHydra configuration
if (commander.args.length < 1) {
    showHelpAndDie();
}
var configPath = commander.args[0];
var robohydraConfigString = fs.readFileSync(configPath, 'utf-8');
var robohydraConfig = JSON.parse(robohydraConfigString);
if (! robohydraConfig.plugins) {
    showHelpAndDie(configPath + " doesn't seem like a valid RoboHydra plugin (missing 'plugins' property in the top-level object)");
}
// After the second parameter, the rest is extra configuration variables
var extraVars = {};
for (var i = 1, len = commander.args.length; i < len; i++) {
    var varAndValue  = commander.args[i].split('=', 2);
    if (varAndValue.length !== 2) {
        showHelpAndDie();
    } else {
        extraVars[varAndValue[0]] = varAndValue[1];
    }
}


var pluginList = robohydraConfig.plugins.map(function(pluginDef) {
    var pluginName = typeof pluginDef === 'string' ? pluginDef : pluginDef.name;
    var pluginSpecificConfig = pluginDef.config || {};
    var p, pluginConfig = {};
    for (p in pluginSpecificConfig) {
        pluginConfig[p] = pluginSpecificConfig[p];
    }
    for (p in extraVars) {
        pluginConfig[p] = extraVars[p];
    }

    return [pluginName, pluginConfig];
});

var multihydra = new MultiHydra(pluginList,
                                {extraVars: extraVars,
                                 extraPluginLoadPath: extraPluginLoadPath});
// This merely forces a default Hydra to be created. It's nice because
// it forces plugins to be loaded, and we get plugin loading errors
// early
var hydra = multihydra.getHydra("*default*");

function stringForLog(req, res) {
    var remoteAddr = req.socket && req.socket.remoteAddress || "-";
    var date = new Date().toUTCString();
    var method = req.method;
    var url = req.url;
    var httpVersion = req.httpVersionMajor + '.' + req.httpVersionMinor;
    var status = res.statusCode;
    var resContentLength = res.headers['content-length'] || "-";
    var referrer = req.headers.referer || req.headers.referrer || "-";
    var userAgent = req.headers['user-agent'] || "-";

    return remoteAddr + " - - [" + date + "] \"" + method + " " +
        url + " HTTP/" + httpVersion + "\" " + status + " " +
        resContentLength + " \"" + referrer + "\" \"" + userAgent + "\"";
}

// Routes are all dynamic, so we only need a catch-all here
var requestHandler = function(nodeReq, nodeRes) {
    var req = new Request({
        url: nodeReq.url,
        method: nodeReq.method,
        headers: nodeReq.headers
    });
    var res = new Response().chain(nodeRes).
        on('end', function(evt) {
            console.log(stringForLog(nodeReq, evt.response));
        });

    // Fetch POST data if available
    nodeReq.addListener("data", function (chunk) {
        var tmp = new Buffer(req.rawBody.length + chunk.length);
        req.rawBody.copy(tmp);
        chunk.copy(tmp, req.rawBody.length);
        req.rawBody = tmp;
    });
    nodeReq.addListener("end", function () {
        try {
            req.bodyParams = qs.parse(req.rawBody.toString());
        } catch(e) {
            // It's ok if qs can't parse the body
        }

        var currentUser = getCurrentUser(req);
        requestHydra = multihydra.getHydra(currentUser);
        requestHydra.handle(req, res);
    });
};

var server;
if (robohydraConfig.secure) {
    var sslOptionsObject = {};
    var keyPath  = robohydraConfig.sslOptions.key,
        certPath = robohydraConfig.sslOptions.cert;
    try {
        sslOptionsObject.key  = fs.readFileSync(keyPath);
        sslOptionsObject.cert = fs.readFileSync(certPath);
    } catch(e) {
        console.log("Could not read the HTTPS key or certificate file.");
        console.log("Paths were '" + keyPath + "' and '" + certPath + "'.");
        console.log("You must set properties 'key' and 'cert' inside 'sslOptions'.");
        process.exit(1);
    }
    server = https.createServer(sslOptionsObject, requestHandler);
} else {
    server = http.createServer(requestHandler);
}


server.on('error', function (e) {
    if (e.code === 'EADDRINUSE') {
        console.log("Couldn't listen in port " + commander.port +
                        ", aborting.");
    }
});
server.listen(commander.port, function() {
    var adminUrl = "http://localhost:" + commander.port + "/robohydra-admin";
    console.log("RoboHydra ready on port %d - Admin URL: %s",
                commander.port, adminUrl);
});
