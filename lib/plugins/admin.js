var fs = require('fs');
var ejs = require('ejs');
var HydraHead           = require('../hydraHead.js').HydraHead,
    HydraHeadFilesystem = require('../hydraHead.js').HydraHeadFilesystem;

var indexTemplateString =
    fs.readFileSync(__dirname + "/templates/index.ejs", "utf-8");

var HydraHeadAdmin = function(props) {
    HydraHead.call(this, props);

    this.basePath = this.normalizePath(props.basePath || '/hydra-admin');
};
for (var p in HydraHead.prototype) {
    HydraHeadAdmin.prototype[p] = HydraHead.prototype[p];
}
HydraHeadAdmin.prototype._mandatoryProperties = ['hydra'];
HydraHeadAdmin.prototype._handle = function(req, res, cb) {
    res.statusCode = 200;
    var output = ejs.render(indexTemplateString, {baseUrl: this.basePath,
                                                  plugins: this.hydra.getPlugins()});
    // var output = this.hydra.getPlugins().map(function(p) { return p.name + " - with heads: " + p.heads.map(function(h) { return h.name; }).join(", ") }).join("\n");
    res.write(output);
    cb();
};



exports.HydraHeadAdmin = HydraHeadAdmin;
exports.name = '*admin*';
exports.getBodyParts = function(config) {
    return [
        new HydraHeadFilesystem({basePath: '/hydra-admin/index',
                                 documentRoot: __dirname}),
        new HydraHeadFilesystem({basePath: '/hydra-admin/static',
                                 documentRoot: __dirname + '/static'}),
        new HydraHeadAdmin(config)
    ];
};
