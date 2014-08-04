var heads               = require("robohydra").heads,
    RoboHydraHead       = heads.RoboHydraHead,
    RoboHydraHeadStatic = heads.RoboHydraHeadStatic;

exports.getBodyParts = function() {
    return {
        heads: [
            new RoboHydraHeadStatic({
                path: "/get",
                contentType: "text/plain",
                content: "If you're reading this, it seems GET requests work!"
            }),

            new RoboHydraHead({
                path: "/post",
                handler: function(req, res) {
                    res.headers["content-type"] = "text/plain";
                    res.send("If you're reading this, it seems POST requests work! Received this from the client: '" + req.rawBody + "'");
                }
            })
        ]
    };
};
