var robohydra     = require("robohydra"),
    Response      = robohydra.Response,
    heads         = robohydra.heads,
    RoboHydraHead = heads.RoboHydraHead;

exports.getBodyParts = function(conf) {
    var corsUrlPath = conf.corsUrlPath || '/.*';

    conf.robohydra.registerDynamicHead(new RoboHydraHead({
        name: 'cors-manager',
        path: corsUrlPath,
        handler: function(req, res, next) {
            if (req.method === 'OPTIONS') {
                var h = res.headers, reqH = req.headers;

                // Age must be 0 because we're only allowing the
                // method, headers, etc. of the current
                // request. Making the browser cache the result might
                // make the browser think that the server won't accept
                // other headers and/or methods.
                h["access-control-max-age"] = 0;
                h["access-control-allow-origin"] = reqH.origin;
                if (reqH.hasOwnProperty("access-control-request-method")) {
                    h["access-control-allow-methods"] =
                        reqH["access-control-request-method"];
                }
                if (reqH.hasOwnProperty("access-control-request-headers")) {
                    h["access-control-allow-headers"] =
                        req.headers["access-control-request-headers"];
                }
                res.send("");
            } else {
                var fakeRes = new Response().on('head', function(evt) {
                    if (req.headers.origin) {
                        evt.headers["access-control-allow-origin"] =
                            req.headers.origin;
                    }
                });
                fakeRes.chain(res);

                next(req, fakeRes);
            }
        }
    }), {priority: 'high'});

    return {};
};
