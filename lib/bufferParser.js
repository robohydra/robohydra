'use strict';

var qs = require('qs');

var PARSING_STRATEGIES = {
    "application/x-www-form-urlencoded": function(buffer, charset) {
        return qs.parse(buffer.toString(charset));
    },
    "application/json": function(buffer, charset) {
        return JSON.parse(buffer.toString(charset));
    },
    "text/plain": function(buffer, charset) {
        return buffer.toString(charset);
    },
    "text/html": function(buffer, charset) {
        return buffer.toString(charset);
    }
};

/**
 * @method getParsingParams
 * Simplifies the interface for getting a clean content-type & charset header value.
 * @param  {string} headerValue A header value to clean.
 * @return {object|undefined} A clean representation of the input value, or undefined
 */
function getParsingParams(headers) {
    if (!headers['content-type']) {
        return {};
    }
    var charset = headers.charset || "";
    var headerSplit = headers['content-type'].split(';');
    var contentType = headerSplit[0];

    // Some ugly parsing to support charset as a part of the 'content-type' header.
    if (!charset && headerSplit[1]) {
        var charsetIndex = headerSplit[1].indexOf('=');
        if (charsetIndex !== -1) {
            charset = headerSplit[1].substr(charsetIndex+1);
        }
    }
    return {
        charset: charset || 'utf-8',
        contentType: contentType
    };
}

/**
 * @method parse
 * Parses the a buffer into the expected internal type, based
 * on standard request headers (content-type and charset).
 *
 * @param  {buffer} buff The initial buffer value to parse.
 * @param  {object} headers Used to select the conversion strategy.
 * @return {object} Parsed post-body according to content-type and charset.
 */
function parse(buffer, headers) {
    var params = getParsingParams(headers);
    var strategy = PARSING_STRATEGIES[params.contentType] ||
            function (/*buffer, headers*/) { return null; };

    try {
        return strategy(buffer, params.charset);
    } catch (err) {
        // Might be nice to do some logging here.
        return null;
    }
}

module.exports = {
    parse: parse
};
