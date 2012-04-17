var fs = require('fs');
var ejs = require('ejs');
var HydraHead           = require('../hydraHead.js').HydraHead,
    HydraHeadFilesystem = require('../hydraHead.js').HydraHeadFilesystem;

var indexTemplateString =
    fs.readFileSync(__dirname + "/templates/index.ejs", "utf-8");

var HydraHeadAdmin = function(props) {
    props.name = props.name || 'index';
    HydraHead.call(this, props);

    this.basePath = this.normalizePath(props.basePath || '/hydra-admin');
};
for (var p in HydraHead.prototype) {
    HydraHeadAdmin.prototype[p] = HydraHead.prototype[p];
}
HydraHeadAdmin.prototype._mandatoryProperties = ['hydra'];
HydraHeadAdmin.prototype._handle = function(req, res, cb) {
    res.statusCode = 200;

    var stash = {baseUrl: this.basePath,
                 plugins: this.hydra.getPlugins(),
                 matchingPluginName: undefined,
                 matchingHeadName: undefined,
                 highlightPath: req.param('highlightPath')};
    if (req.param('highlightPath')) {
        var matchingPluginAndHead = this.hydra.headForPath(stash.highlightPath);
        stash.matchingPluginName = matchingPluginAndHead.plugin.name;
        stash.matchingHeadName   = matchingPluginAndHead.head.name;
    }

    var output = ejs.render(indexTemplateString, stash);
    res.write(output);
    cb();
};



exports.HydraHeadAdmin = HydraHeadAdmin;
exports.name = '*admin*';
exports.getBodyParts = function(config) {
    return [
        new HydraHeadFilesystem({name: 'static',
                                 basePath: '/hydra-admin/static',
                                 documentRoot: __dirname + '/static'}),
        new HydraHeadAdmin(config)
    ];
};
