var varHeadForConf = require("../../../heads").varHeadForConf;

module.exports.getBodyParts = function(conf) {
    if (conf.result === undefined) {
        conf.result = 'pass';
    }

    return {
        heads: [
            varHeadForConf(conf)
        ]
    };
};
