'use strict';

/**
 * To extend the conversion behaviour for more headers, just add a new kvp.
 * * Key should be the name of a header, without / and -
 * * Value should be a function which returns the body.
 */
function initStrategies(buffer) {
    return {
        applicationjson: function(charset) {
            return JSON.parse(buffer.toString(charset));
        },
        textplain: function(charset) {
            return buffer.toString(charset);
        },
        texthtml: function(charset) {
            return buffer.toString(charset);
        },
        default: function() {
            return buffer;
        }
    };
}

/**
 * Parses the a buffer into the expected internal type, based
 * on standard request headers (content-type and charset).
 *
 * @param  {buffer} buff The initial buffer value to parse.
 * @param  {object} headers Used to select the conversion strategy.
 * @return {object} Parsed post-body according to content-type and charset.
 */
function parse(buff, headers) {
    var params = getConversionParams(headers);
    var strategies = initStrategies(buff);
    var strategy = strategies[params.type] || strategies['default'];

    try {
        return strategy(params.charset);
    } catch (err) {
        // Might be nice to do some logging here.
        return null;
    }
}

/**
 * Simplifies the interface for getting a clean content-type & charset header value.
 * @param  {string} headerValue A header value to clean.
 * @return {object|undefined} A clean representation of the input value, or undefined
 */
function getConversionParams(headers) {
    if (!headers['content-type']) return {};
    var charset = headers['charset'] ? normalize(headers['charset']) : "";
    var headerSplit = headers['content-type'].split(';');
    var contentType = normalize(headerSplit[0]);

    // Some ugly parsing to support charset as a part of the 'content-type' header.
    if (!charset && headerSplit[1]) {
        var charsetIndex = headerSplit[1].indexOf('=');
        if (charsetIndex !== -1) {
            charset = normalize(headerSplit[1].substr(charsetIndex+1));
        }
    }
    return {
        charset: charset || 'utf8',
        type: contentType
    };
}

/**
 * Removes any '/' or '-' present in the string and returns it.
 * @param  {string} value A string that should be cleaned of the chars '/' and '-'.
 * @return {string}       The input string minus some special characters.
 */
function normalize(value) {
    return value.toLowerCase().replace(/[/-]/g, '');
}

module.exports = {
    parse: parse
}


