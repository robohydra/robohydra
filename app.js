
/**
 * Module dependencies.
 */

var express = require('express')
  , routes = require('./routes');

function showHelpAndDie() {
    console.log("SYNTAX: app.js <plugin1> <plugin2> ...");
    console.log("Each plugin is a Node package returning an object with the property 'heads'");
    process.exit(1);
}


// Receive a list of plugins to load
if (process.argv.length <= 2) {
    showHelpAndDie();
}
process.argv.slice(2).forEach(function(val, index) {
    if (val === '-h' || val === '-?' || val === '--help')
        showHelpAndDie();
    var plugin = require("./" + val);
    console.log("Registering hydra heads: " +
                plugin.heads.map(function(i) { return i.name; }).join(", "));
    routes.registerPlugin(plugin);
});

var app = module.exports = express.createServer(express.logger());

// Configuration
app.configure(function(){
    app.set('views', __dirname + '/views');
    app.set('view engine', 'jade');
    app.use(express.bodyParser());
    app.use(express.methodOverride());
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
app.all('/*', routes.index);

app.listen(3000);
console.log("Express server listening on port %d in %s mode", app.address().port, app.settings.env);
