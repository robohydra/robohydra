#!/usr/bin/env node

/**
 * Module dependencies.
 */

var express = require('express'),
    fs      = require('fs'),
    qs      = require('qs'),
    Hydra   = require('../lib/hydra').Hydra;

function showHelpAndDie(message) {
    console.log("SYNTAX: app.js mysetup.conf [confvar=value confvar2=value2 ...]");

    if (message) {
        console.log(message);
    }
    process.exit(1);
}


// Check parameters and load Hydra configuration
if (process.argv.length < 3)
    showHelpAndDie();
var configPath = process.argv[2];
if (configPath === '-h' || configPath === '-?' || configPath === '--help')
    showHelpAndDie();
var hydraConfigString = fs.readFileSync(configPath, 'utf-8');
var hydraConfig = JSON.parse(hydraConfigString);
if (! hydraConfig.plugins)
    showHelpAndDie(configPath + " doesn't seem like a valid Hydra plugin (missing 'plugins' property in the top-level object)");
// After the second parameter, the rest is extra configuration variables
var extraVars = {};
for (var i = 3, len = process.argv.length; i < len; i++) {
    var varAndValue  = process.argv[i].split('=', 2);
    if (varAndValue.length < 2) {
        showHelpAndDie();
    } else {
        extraVars[varAndValue[0]] = varAndValue[1];
    }
}


var hydra = new Hydra();
hydraConfig.plugins.forEach(function(pluginDef) {
    var config = {}, p;
    for (p in pluginDef.config) config[p] = pluginDef.config[p];
    for (p in extraVars) config[p] = extraVars[p];
    var plugin = hydra.requirePlugin(pluginDef.name, config);

    var pluginObject = plugin.module.getBodyParts(plugin.config);
    pluginObject.name = pluginDef.name;
    hydra.registerPluginObject(pluginObject);

    console.log("Registering hydra plugin " +
                pluginObject.name + " (" + pluginObject.heads.length +
                " heads)");
});

var app = module.exports = express.createServer(express.logger());

// Configuration
app.configure(function(){
    app.set('views', __dirname + '/views');
    app.set('view engine', 'jade');
    app.use(app.router);
    app.use(express.static(__dirname + '/public'));
});
app.configure('development', function(){
    app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});
app.configure('production', function(){
    app.use(express.errorHandler());
});


// Routes are all dynamic, so we only need a catch-all here
app.all('/*', function(req, res) {
    // Fetch POST data if available
    req.rawBody = new Buffer("");
    req.addListener("data", function (chunk) {
        var tmp = new Buffer(req.rawBody.length + chunk.length);
        req.rawBody.copy(tmp);
        chunk.copy(tmp, req.rawBody.length);
        req.rawBody = tmp;
    });
    req.addListener("end", function () {
        // Try to parse the body...
        try {
            req.body = qs.parse(req.rawBody.toString());
        } catch(e) {
            // but it's ok if qs can't handle it
        }
        // When we have a complete request, dispatch it through Hydra
        hydra.handle(req, res, function() { res.end() });
    });
});

app.listen(3000);
console.log("Express server listening on port %d in %s mode", app.address().port, app.settings.env);
