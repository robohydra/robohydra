#!/usr/bin/env node
/*global require, process, console, JSON, module, Buffer, __dirname*/

/**
 * Module dependencies.
 */

var express   = require('express'),
    fs        = require('fs'),
    qs        = require('qs'),
    commander = require('commander'),
    Hydra     = require('../lib/hydra').Hydra;

commander.version('0.0.1').
    usage("mysetup.conf [confvar=value confvar2=value2 ...]").
    option('-I <path>', 'Adds a new path in the plugin search path list').
    option('-p, --port <port>', 'Listen on this port (default 3000)', 3000).
    parse(process.argv);


// This is a bit crappy, as it uses the global commander variable. But whaeva.
function showHelpAndDie(message) {
    if (message) {
        console.log(message);
    }
    console.log(commander.helpInformation());
    process.exit(1);
}


var hydra = new Hydra();

// Check parameters and load Hydra configuration
if (commander.args.length < 1)
    showHelpAndDie();
var configPath = commander.args[0];
var hydraConfigString = fs.readFileSync(configPath, 'utf-8');
var hydraConfig = JSON.parse(hydraConfigString);
if (! hydraConfig.plugins) {
    showHelpAndDie(configPath + " doesn't seem like a valid Hydra plugin (missing 'plugins' property in the top-level object)");
}
// Process the options
if (commander.I) {
    hydra.addPluginLoadPath(commander.I);
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


hydraConfig.plugins.forEach(function(pluginDef) {
    var config = {}, p;
    for (p in pluginDef.config) config[p] = pluginDef.config[p];
    for (p in extraVars) config[p] = extraVars[p];
    var plugin = hydra.requirePlugin(pluginDef.name, config);

    var pluginObject = plugin.module.getBodyParts(plugin.config);
    pluginObject.name = pluginDef.name;
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
    console.log("Registering hydra plugin " + pluginObject.name + " (" +
                featureMessages.join(", ") + ")");
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
app.all('/*', function(expressReq, expressRes) {
    var req = {
        url: expressReq.url,
        getParams: expressReq.query,
        method: expressReq.method,
        headers: expressReq.headers,
        rawBody: new Buffer("")
    };
    var res = {
        write: function(data) { this.body = data; },
        send: function(data) { this.write(data); this.end(); },
        end: function() {
            expressRes.writeHead(res.statusCode, res.headers);
            if (res.body !== undefined) expressRes.write(res.body);
            expressRes.end()
        },
        statusCode: 200,
        headers: {}
    };

    // Fetch POST data if available
    expressReq.addListener("data", function (chunk) {
        var tmp = new Buffer(req.rawBody.length + chunk.length);
        req.rawBody.copy(tmp);
        chunk.copy(tmp, req.rawBody.length);
        req.rawBody = tmp;
    });
    expressReq.addListener("end", function () {
        // Try to parse the body...
        try {
            req.bodyParams = qs.parse(req.rawBody.toString());
        } catch(e) {
            // but it's ok if qs can't handle it
        }
        // When we have a complete request, dispatch it through Hydra
        hydra.handle(req, res);
    });
});

app.listen(commander.port);
if (app.address()) {
    console.log("Express server listening on port %d in %s mode",
                app.address().port,
                app.settings.env);
} else {
    console.log("Couldn't listen in port %s", commander.port);
}
