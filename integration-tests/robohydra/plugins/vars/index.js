var varHeadForConf = require("../../../heads").varHeadForConf;

module.exports.getBodyParts = function(conf) {
    return {
        heads: [
            varHeadForConf(conf)
        ]
    };
};
