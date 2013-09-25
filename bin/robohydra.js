#!/usr/bin/env node
/*global require, process, console, JSON, Buffer*/

/**
 * Module dependencies.
 */

var http      = require('http'),
    https     = require('https'),
    fs        = require('fs'),
    commander = require('commander');
var robohydra    = require('../lib/robohydra'),
    Request      = robohydra.Request,
    Response     = robohydra.Response,
    stringForLog = robohydra.stringForLog;
var RoboHydraSummoner = require('../lib/robohydrasummoner').RoboHydraSummoner;


(function () {
    "use strict";

    commander.version('0.3.0+').
        usage("mysetup.conf [confvar=value confvar2=value2 ...]").
        option('-I <path>', 'Adds a new path in the plugin search path list').
        option('-P, --plugins <plugin-list>', 'Load plugins at startup').
        option('-n, --no-config', "Don't read a configuration file").
        option('-p, --port <port>', 'Listen on this port (default 3000)', 3000).
        parse(process.argv);


    // This is a bit crappy as it uses the global commander
    // variable. But whaeva.
    function showHelpAndDie(message) {
        if (message) {
            console.error(message);
        }
        console.error(commander.helpInformation());
        process.exit(1);
    }


    // Process the options
    var extraPluginLoadPath = [], plugins = [];
    if (commander.I) {
        extraPluginLoadPath.push(commander.I);
    }
    if (commander.plugins) {
        plugins = plugins.concat(commander.plugins.split(/,/));
    }
    var args = commander.args;

    // Check parameters and load RoboHydra configuration (unless -n)
    var robohydraConfig = {};
    if (commander.config) {
        if (commander.args.length < 1) {
            showHelpAndDie();
        }
        var configPath = args.shift();
        var robohydraConfigString = fs.readFileSync(configPath, 'utf-8');
        robohydraConfig = JSON.parse(robohydraConfigString);
        if (! robohydraConfig.plugins) {
            showHelpAndDie(configPath + " doesn't seem like a valid RoboHydra plugin (missing 'plugins' property in the top-level object)");
        } else {
            plugins = plugins.concat(robohydraConfig.plugins);
        }
    }

    // After the second parameter, the rest is extra configuration variables
    var extraVars = {};
    for (var i = 0, len = args.length; i < len; i++) {
        var varAndValue = args[i].split('=', 2);
        if (varAndValue.length !== 2) {
            showHelpAndDie();
        } else {
            extraVars[varAndValue[0]] = varAndValue[1];
        }
    }

    var summoner = new RoboHydraSummoner(
        plugins,
        robohydraConfig.summoner,
        {extraVars: extraVars, extraPluginLoadPaths: extraPluginLoadPath}
    );
    // This merely forces a default Hydra to be created. It's nice because
    // it forces plugins to be loaded, and we get plugin loading errors
    // early
    summoner.summonRoboHydraForRequest(new Request({url: '/'}));

    // Routes are all dynamic, so we only need a catch-all here
    var requestHandler = function(nodeReq, nodeRes) {
        var reqBody = new Buffer("");
        var res = new Response().chain(nodeRes).
            on('end', function(evt) {
                console.log(stringForLog(nodeReq, evt.response));
            });

        // Fetch POST data if available
        nodeReq.addListener("data", function (chunk) {
            var tmp = new Buffer(reqBody.length + chunk.length);
            reqBody.copy(tmp);
            chunk.copy(tmp, reqBody.length);
            reqBody = tmp;
        });
        nodeReq.addListener("end", function () {
            var req = new Request({
                url: nodeReq.url,
                method: nodeReq.method,
                headers: nodeReq.headers,
                rawBody: reqBody
            });
            summoner.summonRoboHydraForRequest(req).handle(req, res);
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
            console.error("Could not read the HTTPS key or certificate file.");
            console.error("Paths were '" + keyPath + "' and '" + certPath + "'.");
            console.error("You must set properties 'key' and 'cert' inside 'sslOptions'.");
            process.exit(1);
        }
        server = https.createServer(sslOptionsObject, requestHandler);
    } else {
        server = http.createServer(requestHandler);
    }


    server.on('error', function (e) {
        if (e.code === 'EADDRINUSE') {
            console.error("Couldn't listen in port " + commander.port +
                          ", aborting.");
        }
    });
    server.listen(commander.port, function() {
        var adminUrl = "http://localhost:" + commander.port + "/robohydra-admin";
        console.log("RoboHydra ready on port %d - Admin URL: %s",
                    commander.port, adminUrl);
    });
}());
