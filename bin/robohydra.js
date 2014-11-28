#!/usr/bin/env node
/*global require, process, console, JSON*/

/*
 * Module dependencies.
 */

var fs        = require('fs'),
    commander = require('commander');
var createRoboHydraServer = require('robohydra').createRoboHydraServer;


(function () {
    "use strict";

    // This is a bit crappy as it uses the global commander
    // variable. But whaeva.
    function showHelpAndDie(message) {
        if (message) {
            console.error(message);
        }
        console.error(commander.helpInformation());
        process.exit(1);
    }

    commander.version('0.5.0000000000000000000001').
        usage("mysetup.conf [confvar=value confvar2=value2 ...]").
        option('-I <path>', 'Adds a new path in the plugin search path list').
        option('-P, --plugins <plugin-list>', 'Load plugins at startup').
        option('-n, --no-config', "Don't read a configuration file").
        option('-p, --port <port>', 'Listen on this port (default 3000)', 3000).
        parse(process.argv);


    // Process the options
    var extraPluginLoadPath = [], extraPlugins = [];
    if (commander.I) {
        extraPluginLoadPath.push(commander.I);
    }
    if (commander.plugins) {
        extraPlugins = extraPlugins.concat(commander.plugins.split(/,/));
    }
    var args = commander.args;

    // Check parameters and load RoboHydra configuration (unless -n)
    var robohydraConfig;
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
            robohydraConfig.plugins =
                extraPlugins.concat(robohydraConfig.plugins);
        }
    } else {
        robohydraConfig = {plugins: extraPlugins};
    }

    robohydraConfig.port = robohydraConfig.port || commander.port;
    robohydraConfig.pluginLoadPaths =
        (robohydraConfig.pluginLoadPaths || []).concat(extraPluginLoadPath);

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


    var server = createRoboHydraServer(robohydraConfig, extraVars);

    server.on('error', function (e) {
        if (e.code === 'EADDRINUSE') {
            console.error("Couldn't listen in port " + robohydraConfig.port + ", aborting.");
        }
    });
    server.listen(robohydraConfig.port, function() {
        var protocol = robohydraConfig.secure ? "https" : "http";
        var adminUrl = protocol + "://localhost:" + robohydraConfig.port + "/robohydra-admin";
        console.log("RoboHydra ready on port %d - Admin URL: %s",
                    robohydraConfig.port, adminUrl);
    });
}());
