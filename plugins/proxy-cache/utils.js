var path = require("path");

function cacheFileForUrl(urlPath, cacheDir) {
    var basename = urlPath.replace(new RegExp("^/"), "").split('/').
        map(function(dir) { return encodeURIComponent(dir); }).
        join('/');
    // Add trailing slash so that the / of the site is inside the
    // cache directory
    return path.join(cacheDir, basename) + (basename === '' ? '/' : '');
}

module.exports.cacheFileForUrl = cacheFileForUrl;
