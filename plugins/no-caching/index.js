var robohydra           = require('robohydra'),
    RoboHydraHead       = robohydra.heads.RoboHydraHead;

function getBodyParts(config) {
    "use strict";

    var noCachingPath = config.nocachingpath || '/.*';

    return {heads: [new RoboHydraHead({
        path: noCachingPath,
        handler: function(req, res, next) {
            // Tweak client cache-related headers so ensure no
            // caching, then let the request be dispatched normally
            delete req.headers['if-modified-since'];
            delete req.headers['if-none-match'];
            req.headers['cache-control'] = 'no-cache';

            next(req, res);
        }
    })]};
}

exports.getBodyParts = getBodyParts;
