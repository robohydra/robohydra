var InvalidHydraPluginException = function(message) {
    this.name    = "InvalidHydraPluginException";
    this.message = message || 'Invalid or incomplete plugin';
};
InvalidHydraPluginException.prototype.toString = function() {
    return "InvalidHydraPluginException";
};

var DuplicateHydraPluginException = function(message) {
    this.name    = "DuplicateHydraPluginException";
    this.message = message || 'Duplicate or incomplete plugin';
};
DuplicateHydraPluginException.prototype.toString = function() {
    return "DuplicateHydraPluginException";
};

var DuplicateHydraHeadNameException = function(head) {
    this.name    = "DuplicateHydraHeadNameException";
    this.message = 'Duplicate Hydra head name "' + head + '"';
};
DuplicateHydraHeadNameException.prototype.toString = function() {
    return "DuplicateHydraHeadNameException";
};

var Hydra = function() {
    this._plugins = [];
    this._headMap = {};
    this._count = 0;
};
Hydra.prototype._validatePluginName = function(pluginName) {
    return (typeof(pluginName) === 'string' &&
                pluginName.match(new RegExp('^[a-z0-9_]+$', 'i')));
};
Hydra.prototype.registerPlugin = function(plugin) {
    if (! this._validatePluginName(plugin.name) ||
            typeof(plugin.heads) === 'undefined' || !plugin.heads.length)
        throw new InvalidHydraPluginException();

    var name = plugin.name;
    if (this._plugins.some(function(v) { return v.plugin.name === name; })) {
        throw new DuplicateHydraPluginException();
    }

    var self = this;
    var anonymousHeadCount = 0;
    var headMap = {};
    plugin.heads.forEach(function(head) {
        // Calculate head name if not specified
        var headName = head.name();
        if (typeof(headName) === 'undefined') {
            headName = 'anonymousHydraHead' + anonymousHeadCount;
            anonymousHeadCount++;
        }

        if (headMap.hasOwnProperty(headName)) {
            throw new DuplicateHydraHeadNameException(headName);
        }
        headMap[headName] = head;
    });
    this._plugins.push({headMap: headMap, plugin: plugin});
};
Hydra.prototype.pluginNames = function() {
    return this._plugins.map(function(v) { return v.plugin.name; });
};
Hydra.prototype.handle = function(req, res, cb) {
    var handled = false;
    outerloop:
    for (var i = 0, len = this._plugins.length; i < len; i++) {
        var plugin = this._plugins[i].plugin;
        for (var j = 0, len2 = plugin.heads.length; j < len2; j++) {
            if (plugin.heads[j].canDispatch(req.url)) {
                res.statusCode = 200;
                plugin.heads[j].handle(req, res, cb);
                handled = true;
                break outerloop;
            }
        }
    }
    if (! handled) {
        res.statusCode = 404;
        res.send("Not Found");
    }
};

exports.InvalidHydraPluginException = InvalidHydraPluginException;
exports.Hydra = Hydra;
