var robohydra               = require('robohydra'),
    heads                   = robohydra.heads,
    RoboHydraHead           = heads.RoboHydraHead,
    RoboHydraHeadFilesystem = heads.RoboHydraHeadFilesystem,
    Response                = robohydra.Response;

function languageBasedUrlDispatcher(langs, req, res, next) {
    "use strict";

    // If there are no languages left, call the next head without
    // tweaking the URL
    if (! langs.length) {
        return next(req, res);
    }

    // Try with the first language. If it doesn't work, call recursively
    var currentLang = langs[0];
    var origUrl = req.url;
    req.url = origUrl.replace(/\.[a-z0-9]+$/,
                              function(totalMatch) {
                                  return '.' + currentLang + totalMatch;
                              });
    next(req, new Response(function() {
        if (this.statusCode === 404) {
            req.url = origUrl;
            languageBasedUrlDispatcher(langs.slice(1), req, res, next);
        } else {
            res.forward(this);
        }
    }));
}

exports.getBodyParts = function(config) {
    "use strict";

    var documentRoot = config.simplei18ndir || 'examples/simple-i18n';

    return {
        heads: [
            new RoboHydraHead({
                name: 'language-detection',
                path: '/.*',
                handler: function(req, res, next) {
                    var languageDefs =
                            (req.headers['accept-language'] || "").split(/, */);
                    var languageCodes = languageDefs.map(function(langDef) {
                        return langDef.replace(/;.*/, '');
                    });
                    languageBasedUrlDispatcher(languageCodes, req, res, next);
                }
            }),

            new RoboHydraHeadFilesystem({
                name: 'plain-fileserver',
                mountPath: '/',
                documentRoot: documentRoot
            })
        ]
    };
};
