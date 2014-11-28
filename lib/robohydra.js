var RoboHydra = require("./RoboHydra");
var heads = require("./heads");
var utils              = require('./utils'),
    serveStaticFile    = utils.serveStaticFile,
    proxyRequest       = utils.proxyRequest,
    stringForLog       = utils.stringForLog,
    Request            = utils.Request,
    Response           = utils.Response;
var exceptions         = require('./exceptions.js');
var createRoboHydraServer = require('./robohydraserver').createRoboHydraServer;

(function () {
    "use strict";

    exports.RoboHydra             = RoboHydra;
    exports.Request               = Request;
    exports.Response              = Response;
    exports.serveStaticFile       = serveStaticFile;
    exports.proxyRequest          = proxyRequest;
    exports.stringForLog          = stringForLog;
    exports.heads                 = heads;
    exports.robohydraHeadType     = heads.robohydraHeadType;
    exports.createRoboHydraServer = createRoboHydraServer;
    for (var exception in exceptions) {
        exports[exception] = exceptions[exception];
    }

    // Deprecated
    exports.roboHydraHeadType     = heads.roboHydraHeadType;
}());
