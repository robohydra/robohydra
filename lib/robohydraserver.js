var http      = require('http'),
    https     = require('https'),
    fs        = require('fs');
var utils        = require("../lib/utils"),
    Request      = utils.Request,
    Response     = utils.Response,
    stringForLog = utils.stringForLog;
var RoboHydraSummoner = require('../lib/robohydrasummoner').RoboHydraSummoner;

function createRoboHydraServer(robohydraConfig, extraVars) {
    var summoner;
    try {
        summoner = new RoboHydraSummoner(
            robohydraConfig.plugins,
            robohydraConfig.summoner,
            {extraVars: extraVars,
             extraPluginLoadPaths: robohydraConfig.pluginLoadPaths}
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
        var res = new Response().chain(nodeRes).
            on("end", function(evt) {
                console.log(stringForLog(nodeReq, evt.response));
            });

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
    if (robohydraConfig.secure) {
        var sslOptionsObject = {};
        var keyPath  = robohydraConfig.sslOptions.key,
            certPath = robohydraConfig.sslOptions.cert;
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
