function RoboHydraException(name, message) {
    // I have no fucking clue why, but this seems to be the only way
    // to get a sane exception thrown, with stack track and all
    var e = new Error(message);
    e.name = name;
    this.stack = e.stack;
    this.name = name;
    this.message = message;
}

function InvalidRoboHydraResponseException() {
    RoboHydraException.call(this,
                            "InvalidRoboHydraResponseException",
                            'No "end" event handler for this response object');
}

var InvalidRoboHydraResponseEventException = function(eventName) {
    RoboHydraException.call(this,
                            "InvalidRoboHydraResponseEventException",
                            'There\'s no "' + eventName + '" event');
};

var InvalidRoboHydraRequestException = function(propName, propValue) {
    RoboHydraException.call(this,
                            "InvalidRoboHydraRequestException",
                            'Invalid request: property "' + propName +
                                '" had value "' + propValue + '"');
};

var InvalidRoboHydraHeadException = function(message) {
    RoboHydraException.call(this,
                            "InvalidRoboHydraHeadException",
                            message || "Invalid or incomplete RoboHydra Head");
};

var InvalidRoboHydraHeadStateException = function(attachedState) {
    RoboHydraException.call(this,
                            "InvalidRoboHydraHeadStateException",
                            "Can't execute that operation when the hydra " +
                                "head is " +
                                attachedState ? "attached" : "detached");
};

var InvalidRoboHydraPluginException = function() {
    RoboHydraException.call(this,
                            "InvalidRoboHydraPluginException",
                            "Invalid or incomplete plugin");
};

var DuplicateRoboHydraPluginException = function() {
    RoboHydraException.call(this,
                            "DuplicateRoboHydraPluginException",
                            "Duplicate or incomplete plugin");
};

var DuplicateRoboHydraHeadNameException = function(head) {
    RoboHydraException.call(this,
                            "DuplicateRoboHydraHeadNameException",
                            'Duplicate RoboHydra head name "' + head + '"');
};

var RoboHydraHeadNotFoundException = function(pluginName, headName) {
    RoboHydraException.call(this,
                            "RoboHydraHeadNotFoundException",
                            'Could not find the given head ("' +
                                pluginName + '" / "' + headName + '")');
};

var RoboHydraPluginNotFoundException = function(pluginName) {
    RoboHydraException.call(this,
                            "RoboHydraPluginNotFoundException",
                            'Could not find the given plugin ("' +
                                pluginName + '")');
};

var InvalidRoboHydraTestException = function(pluginName, testName) {
    RoboHydraException.call(this,
                            "InvalidRoboHydraTestException",
                            'Could not find the given test ("' +
                                pluginName + '" / "' + testName + '")');
};

var InvalidRoboHydraNextParametersException = function(plugin, test,  args) {
    RoboHydraException.call(this,
                            "InvalidRoboHydraNextParametersException",
                            'Invalid parameters passed to the next ' +
                                'function "' + plugin.name + '" / "' +
                                test.name + '". Expected (req, res), ' +
                                'received ' + args.length + ' parameters: (' +
                                Array.prototype.join.call(args, ", ") + ')');
};


exports.RoboHydraException = RoboHydraException;
exports.InvalidRoboHydraResponseEventException =
    InvalidRoboHydraResponseEventException;
exports.InvalidRoboHydraResponseException = InvalidRoboHydraResponseException;
exports.InvalidRoboHydraHeadException  = InvalidRoboHydraHeadException;
exports.InvalidRoboHydraHeadStateException  = InvalidRoboHydraHeadStateException;
exports.InvalidRoboHydraPluginException = InvalidRoboHydraPluginException;
exports.DuplicateRoboHydraPluginException = DuplicateRoboHydraPluginException;
exports.DuplicateRoboHydraHeadNameException = DuplicateRoboHydraHeadNameException;
exports.RoboHydraHeadNotFoundException = RoboHydraHeadNotFoundException;
exports.RoboHydraPluginNotFoundException = RoboHydraPluginNotFoundException;
exports.InvalidRoboHydraTestException = InvalidRoboHydraTestException;
exports.InvalidRoboHydraNextParametersException = InvalidRoboHydraNextParametersException;
