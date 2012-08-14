#!/usr/bin/env node
/*global require, process, console, JSON, module, Buffer, __dirname*/

/**
 * Module dependencies.
 */

var http      = require("http"),
    fs        = require('fs'),
    qs        = require('qs'),
    commander = require('commander');
var robohydra = require('../lib/robohydra'),
    RoboHydra = robohydra.RoboHydra,
    Request   = robohydra.Request,
    Response  = robohydra.Response;

commander.version('0.0.1').
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


// Check parameters and load RoboHydra configuration
if (commander.args.length < 1) {
    showHelpAndDie();
}
var configPath = commander.args[0];
var extraPluginLoadpath;
var robohydraConfigString = fs.readFileSync(configPath, 'utf-8');
var robohydraConfig = JSON.parse(robohydraConfigString);
if (! robohydraConfig.plugins) {
    showHelpAndDie(configPath + " doesn't seem like a valid RoboHydra plugin (missing 'plugins' property in the top-level object)");
}
// Process the options
if (commander.I) {
    extraPluginLoadpath = commander.I;
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


var hydra = new RoboHydra(extraVars);
if (extraPluginLoadpath) { hydra.addPluginLoadPath(extraPluginLoadpath); }

robohydraConfig.plugins.forEach(function(pluginDef) {
    var config = {}, p;
    var pluginName = typeof pluginDef === 'string' ? pluginDef : pluginDef.name;
    var pluginConfig = pluginDef.config || {};
    for (p in pluginConfig) { config[p] = pluginConfig[p]; }
    for (p in extraVars) { config[p] = extraVars[p]; }
    var plugin = hydra.requirePlugin(pluginName, config);

    var pluginObject = plugin.module.getBodyParts(plugin.config,
                                                  hydra.getModulesObject());
    pluginObject.name = pluginName;
    hydra.registerPluginObject(pluginObject);

    var featureMessages = [];
    if (typeof pluginObject.heads === 'object') {
        featureMessages.push(pluginObject.heads.length + " head(s)");
    }
    if (typeof pluginObject.tests === 'object') {
        var testCount = 0;
        for (var test in pluginObject.tests) {
            if (pluginObject.tests.hasOwnProperty(test)) {
                testCount++;
            }
        }
        featureMessages.push(testCount + " test(s)");
    }
    console.log("Registering RoboHydra plugin " + pluginObject.name + " (" +
                featureMessages.join(", ") + ")");
});

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
var server = http.createServer(function(nodeReq, nodeRes) {
    var req = new Request({
        url: nodeReq.url,
        method: nodeReq.method,
        headers: nodeReq.headers
    });
    var res = new Response().chain(nodeRes).
        on('end', function(response) {
            console.log(stringForLog(nodeReq, response));
        });

    // Fetch POST data if available
    nodeReq.addListener("data", function (chunk) {
        var tmp = new Buffer(req.rawBody.length + chunk.length);
        req.rawBody.copy(tmp);
        chunk.copy(tmp, req.rawBody.length);
        req.rawBody = tmp;
    });
    nodeReq.addListener("end", function () {
        // Try to parse the body...
        try {
            req.bodyParams = qs.parse(req.rawBody.toString());
        } catch(e) {
            // but it's ok if qs can't handle it
        }
        // When we have a complete request, dispatch it through RoboHydra
        hydra.handle(req, res);
    });
});

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
