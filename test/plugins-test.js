/*global describe, it*/

var buster = require("buster");
var proxyCache = require("../plugins/proxy-cache");

buster.spec.expose();
var expect = buster.expect;

describe("Proxy-cache plugin", function() {
    "use strict";

    it("makes good cache paths for simple URLs", function() {
        var expectedUrls = {
            '/': 'dir/',  // Special case
            '/foobar.html': 'dir/foobar.html',
            '/blah': 'dir/blah',
            '/blah/blergh': 'dir/blah/blergh'
        };
        for (var url in expectedUrls) {
            var cachePath = proxyCache.cacheFileForUrl(url, "dir");
            expect(cachePath).toEqual(expectedUrls[url]);
        }
    });

    it("makes good cache paths for URLs with special characters", function() {
        var expectedUrls = {
            '/blah%blergh': 'dir/blah%25blergh',
            '/path?get=param': 'dir/path%3Fget%3Dparam'
        };
        for (var url in expectedUrls) {
            var cachePath = proxyCache.cacheFileForUrl(url, "dir");
            expect(cachePath).toEqual(expectedUrls[url]);
        }
    });
});
