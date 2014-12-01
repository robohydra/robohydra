var http      = require('http'),
    https     = require('https'),
    fs        = require('fs');
var utils        = require("../lib/utils"),
    Request      = utils.Request,
    Response     = utils.Response,
    stringForLog = utils.stringForLog;
var RoboHydraSummoner = require('../lib/robohydrasummoner').RoboHydraSummoner;

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

    // Routes are all dynamic, so we only need a catch-all here
    var requestHandler = function(nodeReq, nodeRes) {
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
                headers: nodeReq.headers,
                rawBody: reqBody
            });
            summoner.summonRoboHydraForRequest(req).handle(req, res);
        });
    };

    var server;
    if (config.secure) {
        var sslOptionsObject = {};
        var keyPath  = config.sslOptions.key,
            certPath = config.sslOptions.cert;
        try {
            sslOptionsObject.key  = fs.readFileSync(keyPath);
            sslOptionsObject.cert = fs.readFileSync(certPath);
        } catch(e) {
            console.error("Could not read the HTTPS key or certificate file.");
            console.error("Paths were '" + keyPath + "' and '" + certPath + "'.");
            console.error("You must set properties 'key' and 'cert' inside 'sslOptions'.");
            process.exit(1);
        }
        server = https.createServer(sslOptionsObject, requestHandler);
    } else {
        server = http.createServer(requestHandler);
    }

    return server;
}


module.exports.createRoboHydraServer = createRoboHydraServer;
