var fs   = require("fs"),
    path = require("path");
var robohydra     = require("robohydra"),
    Response      = robohydra.Response,
    proxyRequest  = robohydra.proxyRequest,
    heads         = robohydra.heads,
    RoboHydraHead = heads.RoboHydraHead;
var cacheFileForUrl = require("./utils").cacheFileForUrl;

function mktree(dir, pos) {
    dir = path.normalize(dir);
    pos = pos || 0;
    var dirParts = dir.split(path.sep);

    if (pos >= dirParts.length) {
        return;
    }

    var nextDir = dirParts.splice(0, pos + 1).join(path.sep);
    try {
        fs.mkdirSync(nextDir);
    } catch (e) {
        if (e.code !== 'EEXIST') {
            throw e;
        }
    }
    mktree(dir, pos + 1);
}

function proxyAndCacheRequest(req, res, cacheFileBasename, proxyUrl) {
    var fakeRes = new Response(function(evt) {
        var bodyFilename = cacheFileBasename + ".body",
            infoFilename = cacheFileBasename + ".info";
        var dir = path.dirname(bodyFilename);
        mktree(dir);

        fs.writeFileSync(bodyFilename, evt.response.body);
        fs.writeFileSync(infoFilename, JSON.stringify({
            statusCode: evt.response.statusCode,
            headers: evt.response.headers
        }));

        res.copyFrom(evt.response);
        res.end();
    });

    proxyUrl = proxyUrl.replace(new RegExp('/$'), '') + req.url;
    proxyRequest(req, fakeRes, proxyUrl, {setHostHeader: true});
}

function serveFromCache(res, cacheFileBasename) {
    var info = JSON.parse(fs.readFileSync(cacheFileBasename + ".info"));
    res.statusCode = info.statusCode;
    res.headers = info.headers;
    res.send(fs.readFileSync(cacheFileBasename + ".body"));
}

exports.cacheFileForUrl = cacheFileForUrl;
exports.getBodyParts = function(conf) {
    var proxyUrl = conf.proxyurl;
    var cacheDir = conf.cachedir || 'proxy-cache';
    var cacheTtl = parseFloat(conf.cachettl) || 5;

    if (proxyUrl === undefined) {
        console.error("ERROR: I need a URL to proxy to!\n(hint: pass the " +
                      "'proxyurl' like 'robohydra ... proxyurl=http://...')");
        process.exit(1);
    }

    return {
        heads: [
            new RoboHydraHead({
                path: '/.*',
                handler: function(req, res) {
                    if (req.method !== 'GET') {
                    	// made proxyUrl unique,
                    	// it was concatenating itself over and over, per request
                    	// which creates incorrect urls
                        var proxy = proxyUrl.replace(new RegExp('/$'), '') + req.url;
                        proxyRequest(req, res, proxy, {setHostHeader: true});
                        return;
                    }

                    var cachePathBase = cacheFileForUrl(req.url, cacheDir);

                    try {
                        // statSync (not existsSync) for Node 0.6
                        // compatibility
                        var statInfo  = fs.statSync(cachePathBase + ".info"),
                            cacheTime = statInfo.mtime.getTime();
                        // If cached and fresh enough, serve it
                        if (cacheTime + cacheTtl * 1000 > Date.now()) {
                            serveFromCache(res, cachePathBase);
                        } else {
                            proxyAndCacheRequest(req, res, cachePathBase,
                                                 proxyUrl);
                        }
                    } catch (e) {
                        if (e.code === 'ENOENT') {
                            proxyAndCacheRequest(req, res, cachePathBase,
                                                 proxyUrl);
                        } else {
                            // What the hell did I just see
                            throw e;
                        }
                    }
                }
            })
        ]
    };
};
