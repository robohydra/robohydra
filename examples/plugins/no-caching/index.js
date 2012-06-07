var robohydra           = require('robohydra'),
    RoboHydraHead       = robohydra.heads.RoboHydraHead;

function getBodyParts(config) {
    var noCachingPath = config.nocachingpath || '/.*';

    return {heads: [new RoboHydraHead({
        path: noCachingPath,
        handler: function(req, res, next) {
            // Tweak client cache-related headers so ensure no
            // caching, then let the request be dispatched normally
            delete req.headers['if-modified-since'];
            delete req.headers['if-match'];
            delete req.headers['if-none-match'];
            delete req.headers['if-range'];
            delete req.headers['if-unmodified-since'];
            req.headers['cache-control'] = 'no-cache';

            next(req, res);
        }
    })]};
}

exports.getBodyParts = getBodyParts;
