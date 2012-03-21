#!/usr/bin/env node

/**
 * Module dependencies.
 */

var express              = require('express'),
    fs                   = require('fs'),
    Hydra                = require('../lib/hydra').Hydra,
    summonHydraBodyParts = require('../lib/hydra').summonHydraBodyParts;

function showHelpAndDie(message) {
    console.log("SYNTAX: app.js mysetup.conf");
    console.log("Each plugin is a Node package returning an object with the property 'heads'");

    if (message) {
        console.log(message);
    }
    process.exit(1);
}

function poorMansBasename(path) {
    return path.replace(new RegExp('/$'), '').
        replace(new RegExp('.*/'), '');
}


// Check parameters and load Hydra configuration
if (process.argv.length !== 3)
    showHelpAndDie();
var configPath = process.argv[2];
if (configPath === '-h' || configPath === '-?' || configPath === '--help')
    showHelpAndDie();
var hydraConfigString = fs.readFileSync(configPath, 'utf-8');
var hydraConfig = JSON.parse(hydraConfigString);
if (! hydraConfig.plugins)
    showHelpAndDie(configPath + " doesn't seem like a valid Hydra plugin (missing 'plugins' property in the top-level object)");


var hydra = new Hydra();
hydraConfig.plugins.forEach(function(pluginDef) {
    var plugin = hydra.loadPlugin(pluginDef.name);

    var pluginObject = summonHydraBodyParts(plugin.module.getBodyParts(plugin.config));
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
    hydra.handle(req, res, function() { res.end() });
});

app.listen(3000);
console.log("Express server listening on port %d in %s mode", app.address().port, app.settings.env);
