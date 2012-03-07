var url = require('url');

var hydra = {heads: []};

exports.registerPlugin = function(pluginData) {
    pluginData.heads.forEach(function(head, index) {
        hydra.heads.push(head);
    });
};

exports.index = function(req, res){
    var handled = false;

    hydra.heads.forEach(function(head, index) {
        if (handled) return;

        // Convert path to a regular expression, and collect the
        // captured names so we can assign the appropriate values to
        // req.param.<name>
        var names = [];
        var pathReCoreText = head.path.replace(/:(\w+)/g,
                                               function(_, name) {
                                                   names.push(name);
                                                   return '([^/]+)';
                                               });
        var pathRe = new RegExp("^" + pathReCoreText + "$");
        var reqUrl = url.parse(req.url);
        var matches = reqUrl.pathname.match(pathRe);
        if (matches) {
            // Save captured names in req.param.<name>
            for (var i = 0, len = names.length; i < len; i++) {
                req.params[names[i]] = matches[i + 1];
            }
            head.handler(req, res);
            handled = true;
        }
    });

    if (! handled) {
        res.send('404 Not Found (path: ' + req.url + ')', 404);
    }
};
