var fs = require('fs');

var InvalidHydraHeadException = function(message) {
    this.name = "InvalidHydraHeadException";
};
InvalidHydraHeadException.prototype.toString = function() {
    return "InvalidHydraHeadException";
};

var HydraHead = function(props) {
    props = props || {};
    this.handle = this._resolveHandleFunction(props);
    if (typeof(this.handle) !== 'function') {
        throw new InvalidHydraHeadException();
    }
    var self = this;
    ['path', 'content', 'documentRoot', 'fs'].forEach(function(p) {
        self[p] = props[p];
    });
    self.path = self.path || '/.*';
    self.fs   = self.fs   || fs;
    if (self.path[0] !== '/') self.path = '/' + self.path;
};
HydraHead.prototype._resolveHandleFunction = function(props) {
    if (typeof(props.content) !== 'undefined') {
        return this.handleFixed;
    } else if (typeof(props.documentRoot) !== 'undefined' &&
               typeof(props.path) !== 'undefined') {
        return this.handleFile;
    } else if (typeof(props.handler) !== 'undefined' &&
               typeof(props.path) !== 'undefined') {
        return props.handler;
    }
    return undefined;
};
/* Dispatch functions ------------------------------------------------- */
HydraHead.prototype.handleFixed = function(req, res, cb) {
    if (req.url.match(new RegExp("^" + this.path + "$"))) {
        res.send(this.content);
    } else {
        res.send("Not Found");
        res.statusCode = 404;
    }
    cb();
};
HydraHead.prototype.handleFile = function(req, res, cb) {
    var pathRe = new RegExp("^" + this.path);
    if (req.url.match(pathRe)) {
        var filePath = (this.documentRoot + '/' + req.url.replace(pathRe, '')).
            replace(new RegExp('//+'), '/');
        this.fs.readFile(filePath, function(err, data) {
            if (err) {
                res.statusCode = 404;
                res.send("Not Found");
            } else {
                res.send(data);
            }
            cb();
        });
    } else {
        res.statusCode = 404;
        res.send("Not Found");
        cb();
    }
};

exports.InvalidHydraHeadException = InvalidHydraHeadException;
exports.HydraHead = HydraHead;
