exports.getBodyParts = function() {
    return {};
};

exports.getSummonerTraits = function() {
    return {
        robohydraPicker: function(req) {
            return req.queryParams.user || "anonymous";
        }
    };
};
