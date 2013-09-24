var util = require("util");
var robohydra                     = require("robohydra"),
    roboHydraHeadType             = robohydra.roboHydraHeadType,
    heads                         = robohydra.heads,
    InvalidRoboHydraHeadException = robohydra.InvalidRoboHydraHeadException;

var RoboHydraHeadLogin = roboHydraHeadType({
    name: 'login',
    parentClass: heads.RoboHydraHead,

    mandatoryProperties: ['users'],
    optionalProperties: [{name: 'path', defaultValue: '/api/login'}],
    defaultProps: {users: []},

    init: function() {
        if (! util.isArray(this.users)) {
            throw new InvalidRoboHydraHeadException("The 'users' property " +
                                                        "must be an array!");
        }
    },

    // The 'users' property contains the list of usernames for which
    // login will succeed. The rest of the usernames will be given
    // authentication error no matter what.
    parentPropBuilder: function() {
        return {
            path: this.path,
            handler: function(req, res) {
                var username = req.bodyParams.username;
                res.send(JSON.stringify({
                    success: this.users.indexOf(username) !== -1 ? 1 : 0,
                    username: username
                }));
            }
        };
    }
});


exports.getBodyParts = function() {
    return {
        heads: [
            new RoboHydraHeadLogin({
                users: ['a', 'b', 'c']
            })
        ]
    };
};
