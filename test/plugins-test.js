/*global describe, it*/

var mocha = require("mocha");
var chai = require("chai"),
    expect = chai.expect;
var proxyCacheUtils = require("../plugins/proxy-cache/utils.js");

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
            var cachePath = proxyCacheUtils.cacheFileForUrl(url, "dir");
            expect(cachePath).to.equal(expectedUrls[url]);
        }
    });

    it("makes good cache paths for URLs with special characters", function() {
        var expectedUrls = {
            '/blah%blergh': 'dir/blah%25blergh',
            '/path?get=param': 'dir/path%3Fget%3Dparam'
        };
        for (var url in expectedUrls) {
            var cachePath = proxyCacheUtils.cacheFileForUrl(url, "dir");
            expect(cachePath).to.equal(expectedUrls[url]);
        }
    });
});
