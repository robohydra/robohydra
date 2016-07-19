var http  = require('http'),
    https = require('https'),
    /*jshint -W079*/
    WebSocketServer = require('ws').Server,
    fs    = require('fs');
var utils        = require("../lib/utils"),
    Request      = utils.Request,
    Response     = utils.Response,
    stringForLog = utils.stringForLog;
var RoboHydraSummoner = require('../lib/robohydrasummoner').RoboHydraSummoner;

function buildHeadersFromRaw (rawHeaders) {
    var headers = {};
    for (var i = 0 ; i < rawHeaders.length; i++) {
        headers[rawHeaders[i]] = rawHeaders[++i];
    }
    
    return headers;
}
function makeRequestHandler(config, summoner) {
    // Routes are all dynamic, so we only need a catch-all here
    return function(nodeReq, nodeRes) {
        var reqBody = new Buffer("");
        var res = new Response().
            on("end", function(evt) {
                if (! config.quiet) {
                    console.log(stringForLog(nodeReq, evt.response));
                }
            });
        Response.prototype.follow.call(nodeRes, res);

        // Fetch POST data if available
        nodeReq.addListener("data", function (chunk) {
            var tmp = new Buffer(reqBody.length + chunk.length);
            reqBody.copy(tmp);
            chunk.copy(tmp, reqBody.length);
            reqBody = tmp;
        });
        nodeReq.addListener("end", function () {
            var req = new Request({
                url: nodeReq.url,
                method: nodeReq.method,
                headers: config.useRawHeaders ? buildHeadersFromRaw(nodeReq.rawHeaders) : nodeReq.headers,
                rawBody: reqBody
            });
            summoner.summonRoboHydraForRequest(req).handle(req, res);
        });
    };
}


/**
 * Creates a RoboHydra server, similar to `http.createServer` or
 * `https.createServer`. The returned object is in fact the same as
 * with the `createServer`, so the same methods (`listen`, `on`, etc.)
 * can be used.
 *
 * @method createRoboHydraServer
 * @for robohydra
 * @param {Object} config Server configuration
 * @param {Array} config.plugins List of plugins to load: each element
 * in the array must be either a string (name of the plugin to load)
 * or an object with the keys `name` (string with the plugin name) and
 * `config` (object with configuration variables for the plugin).
 * @param {Object} config.summoner Summoner configuration. Right now
 * the only valid key is `hydraPickerPlugin`, the name of the plugin
 * containing the hydra picker to use (useful in case there are
 * several).
 * @param {Array} config.pluginLoadPaths Array with extra directories
 * to search for RoboHydra plugins.
 * @param {Boolean} config.secure Whether the RoboHydra server should
 * use HTTPS or not.
 * @param {Object} config.sslOptions SSL options. Only used if
 * `config.secure` is truthy.
 * @param {String} config.sslOptions.key The path to the secret key
 * file for the SSL certificate.
 * @param {String} config.sslOptions.cert The path to the certificate
 * file for the SSL certificate.
 */
function createRoboHydraServer(config, extraVars) {
    var summoner;
    try {
        summoner = new RoboHydraSummoner(
            config.plugins,
            config.summoner,
            {extraVars: extraVars,
             extraPluginLoadPaths: config.pluginLoadPaths}
        );
    } catch (e) {
        console.error(e.message || e);
        process.exit(1);
    }
    // This merely forces a default Hydra to be created. It's nice because
    // it forces plugins to be loaded, and we get plugin loading errors
    // early
    summoner.summonRoboHydraForRequest(new Request({url: "/"}));

    var handler = makeRequestHandler(config, summoner),
        server;
    if (config.secure) {
        var keyPath  = config.sslOptions.key,
            certPath = config.sslOptions.cert;

        if (!keyPath) {
            throw new Error("Need sslOptions.key if secure is set to true");
        }
        if (!certPath) {
            throw new Error("Need sslOptions.cert if secure is set to true");
        }

        server = https.createServer({
            key: fs.readFileSync(keyPath),
            cert: fs.readFileSync(certPath)
        }, handler);
    } else {
        server = http.createServer(handler);
    }

    var wsServer = new WebSocketServer({server: server});
    wsServer.on("connection", function(client) {
        // Make sure there's at least one handler for the 'error'
        // event so that the server doesn't die when a client closes
        // the websocket connection
        client.on("error", function() {});
        summoner.summonRoboHydraForRequest(client.upgradeReq).webSocketHandle(client.upgradeReq, client);
    });

    return server;
}


module.exports.createRoboHydraServer = createRoboHydraServer;
