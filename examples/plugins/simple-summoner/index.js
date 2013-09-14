exports.getBodyParts = function() {
    return {};
};

exports.getSummonerTraits = function() {
    return {
        hydraPicker: function(req) {
            return req.queryParams.user || "anonymous";
        }
    };
};
