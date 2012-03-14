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

var HydraPathNotFoundException = function(message) {
    this.name    = "HydraPathNotFoundException";
    this.message = message || 'Could not find handler for given path';
};
HydraPathNotFoundException.prototype.toString = function() {
    return "HydraPathNotFoundException";
};

var Hydra = function() {
    this._plugins = [];
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
    if (this._plugins.some(function(v) { return v.name === name; })) {
        throw new DuplicateHydraPluginException();
    }

    this._plugins.push(plugin);
};
Hydra.prototype.plugins = function() {
    return this._plugins.map(function(v) { return v.name; });
};
Hydra.prototype.handle = function(req, res, cb) {
    var handled = false;
    outerloop:
    for (var i = 0, len = this._plugins.length; i < len; i++) {
        for (var j = 0, len2 = this._plugins[i].heads.length; j < len2; j++) {
            if (this._plugins[i].heads[j].canDispatch(req.url)) {
                res.statusCode = 200;
                this._plugins[i].heads[j].handle(req, res, cb);
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
