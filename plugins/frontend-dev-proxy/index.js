var heads                   = require("robohydra").heads,
    RoboHydraHeadProxy      = heads.RoboHydraHeadProxy,
    RoboHydraHeadFilesystem = heads.RoboHydraHeadFilesystem;

// Configuration variables:
// * urlpath: comma-separated list of url paths to serve locally.
// * localdir: comma-separated list of local directories the above URL
//   paths will map to.
// * proxyurl: the url to proxy to (eg. the url of the development
//   server).
// * sethostheader: if the "Host" header should be set to the URL the
//   requests are proxied to. Defaults to yes, set to "no" to avoid it.
exports.getBodyParts = function(conf) {
    "use strict";

    if (conf.urlpath === undefined) {
        console.error("ERROR: Don't have any URL path to serve locally\n" +
                      "(hint: pass the 'urlpath' variable like " +
                      "'robohydra ... urlpath=/css')");
        process.exit(1);
    }
    if (conf.localdir === undefined) {
        console.error("ERROR: Don't have any local directories to serve " +
                      "files from\n(hint: pass the 'localdir' variable like " +
                      "'robohydra ... localdir=static/css')");
        process.exit(1);
    }

    var urlpaths = conf.urlpath !== '' ? conf.urlpath.split(/,/) : [];
    var localdirs = conf.localdir !== '' ? conf.localdir.split(/,/) : [];
    var proxyurl = conf.proxyurl || "";
    if (urlpaths.length !== localdirs.length) {
        console.error("ERROR: I have " + urlpaths.length + " URL paths to " +
                      "serve from local files, but " + localdirs.length +
                      " directories\nto serve files from. These two " +
                      "numbers should be equal!");
        process.exit(1);
    }
    if (! proxyurl) {
        console.error("ERROR: I need a URL to proxy to!\n(hint: pass the " +
                      "'proxyurl' like 'robohydra ... proxyurl=http://...')");
        process.exit(1);
    }

    var heads = [];

    // Create a head for each URL path to be served locally
    for (var i = 0, len = urlpaths.length; i < len; i++) {
        heads.push(new RoboHydraHeadFilesystem({
            mountPath: urlpaths[i],
            documentRoot: localdirs[i]
        }));
    }

    // We always need the proxy at the end
    heads.push(new RoboHydraHeadProxy({
        name: 'realServerProxy',
        mountPath: '/',
        proxyTo: conf.proxyurl,
        setHostHeader: (conf.sethostheader !== 'no')
    }));

    return {
        heads: heads
    };
};
