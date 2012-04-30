var fs = require('fs');
var ejs = require('ejs');
var HydraHead           = require('../hydraHead.js').HydraHead,
    HydraHeadFilesystem = require('../hydraHead.js').HydraHeadFilesystem,
    HydraHeadStatic     = require('../hydraHead.js').HydraHeadStatic;

var indexTemplateString =
    fs.readFileSync(__dirname + "/templates/index.ejs", "utf-8");

exports.name = '*admin*';
exports.getBodyParts = function(config) {
    return [
        // Static files
        new HydraHeadFilesystem({name: 'static',
                                 basePath: '/hydra-admin/static',
                                 documentRoot: __dirname + '/static'}),


        // Create dynamic hydra heads
        new HydraHead({
            hydra: config.hydra,
            name: 'createHead',
            path: '/hydra-admin/head/create',
            handler: function(req, res, cb) {
                var content = req.body.newHeadContent;
                var defaultContentType = 'application/octet-stream';
                try {
                    JSON.parse(content);
                    defaultContentType = 'application/json';
                } catch (e) {
                    // It's ok if it's not JSON
                }
                console.log("Trying to create a new head with path = " + req.body.newHeadPath + ", content = " + req.body.newHeadContent);
                var head = new HydraHeadStatic({
                    path:        req.body.newHeadPath,
                    content:     content,
                    contentType: req.body.newHeadContentType ||
                                     defaultContentType
                });
                config.hydra.registerDynamicHead(head);
                res.header('Location', '/hydra-admin');
                res.statusCode = 302;
                cb();
            }}),


        // Toggle hydra head attachment
        new HydraHead({
            hydra: config.hydra,
            name: 'toggleHeadAttachment',
            path: '/hydra-admin/head/toggle-attachment',
            handler: function(req, res, cb) {
                var pluginName = req.param('pluginName');
                var headName   = req.param('headName');
                var head = config.hydra.findHead(pluginName, headName);
                head.attached() ? head.detach() : head.attach();
                res.header('Location', '/hydra-admin');
                res.statusCode = 302;
                cb();
            }}),


        // Admin UI index
        new HydraHead({
            hydra: config.hydra,
            name: 'index',
            path: '/hydra-admin',
            handler: function(req, res, cb) {
                res.statusCode = 200;

                var stash = {baseUrl: this.path,
                             plugins: config.hydra.getPlugins(),
                             matchingPluginName: undefined,
                             matchingHeadName: undefined,
                             highlightPath: req.param('highlightPath') || ''};
                if (req.param('highlightPath')) {
                    var matchingPair = config.hydra.headForPath(stash.highlightPath);
                    if (matchingPair) {
                        stash.matchingPluginName = matchingPair.plugin.name;
                        stash.matchingHeadName   = matchingPair.head.name;
                    }
                }

                var output = ejs.render(indexTemplateString, stash);
                res.send(output);
                cb();
            }})
    ];
};
