var RoboHydraException = function(name, message) {
    Error.call(this, message);
    this.name = name;
};
RoboHydraException.prototype = new Error();
RoboHydraException.prototype.toString = function() {
    return this.name;
};

var InvalidRoboHydraResponseException = function() {
    RoboHydraException.call(this,
                            "InvalidRoboHydraResponseException",
                            'No "end" event handler for this response object');
};
InvalidRoboHydraResponseException.prototype = new RoboHydraException();

var InvalidRoboHydraResponseEventException = function(eventName) {
    RoboHydraException.call(this,
                            "InvalidRoboHydraResponseEventException",
                            'There\'s no "' + eventName + '" event');
};
InvalidRoboHydraResponseEventException.prototype = new RoboHydraException();

var InvalidRoboHydraRequestException = function(propName, propValue) {
    RoboHydraException.call(this,
                            "InvalidRoboHydraRequestException",
                            'Invalid request: property "' + propName +
                                '" had value "' + propValue + '"');
};
InvalidRoboHydraRequestException.prototype = new RoboHydraException();

var InvalidRoboHydraHeadException = function(message) {
    RoboHydraException.call(this,
                            "InvalidRoboHydraHeadException",
                            message || "Invalid or incomplete RoboHydra Head");
};
InvalidRoboHydraHeadException.prototype = new RoboHydraException();

var InvalidRoboHydraHeadStateException = function(attachedState) {
    RoboHydraException.call(this,
                            "InvalidRoboHydraHeadStateException",
                            "Can't execute that operation when the hydra " +
                                "head is " +
                                attachedState ? "attached" : "detached");
};
InvalidRoboHydraHeadStateException.prototype = new RoboHydraException();

var InvalidRoboHydraPluginException = function() {
    RoboHydraException.call(this,
                            "InvalidRoboHydraPluginException",
                            "Invalid or incomplete plugin");
};
InvalidRoboHydraPluginException.prototype = new RoboHydraException();

var DuplicateRoboHydraPluginException = function() {
    RoboHydraException.call(this,
                            "DuplicateRoboHydraPluginException",
                            "Duplicate or incomplete plugin");
};
DuplicateRoboHydraPluginException.prototype = new RoboHydraException();

var DuplicateRoboHydraHeadNameException = function(head) {
    RoboHydraException.call(this,
                            "DuplicateRoboHydraHeadNameException",
                            'Duplicate RoboHydra head name "' + head + '"');
};
DuplicateRoboHydraHeadNameException.prototype = new RoboHydraException();

var RoboHydraHeadNotFoundException = function(pluginName, headName) {
    RoboHydraException.call(this,
                            "RoboHydraHeadNotFoundException",
                            'Could not find the given head ("' +
                                pluginName + '" / "' + headName + '")');
};
RoboHydraHeadNotFoundException.prototype = new RoboHydraException();

var RoboHydraPluginNotFoundException = function(pluginName) {
    RoboHydraException.call(this,
                            "RoboHydraPluginNotFoundException",
                            'Could not find the given plugin ("' +
                                pluginName + '")');
};
RoboHydraPluginNotFoundException.prototype = new RoboHydraException();

var InvalidRoboHydraTestException = function(pluginName, testName) {
    RoboHydraException.call(this,
                            "InvalidRoboHydraTestException",
                            'Could not find the given test ("' +
                                pluginName + '" / "' + testName + '")');
};
InvalidRoboHydraTestException.prototype = new RoboHydraException();

var InvalidRoboHydraNextParametersException = function(plugin, test,  args) {
    RoboHydraException.call(this,
                            "InvalidRoboHydraNextParametersException",
                            'Invalid parameters passed to the next ' +
                                'function "' + plugin.name + '" / "' +
                                test.name + '". Expected (req, res), ' +
                                'received ' + args.length + ' parameters: (' +
                                Array.prototype.join.call(args, ", ") + ')');
};
InvalidRoboHydraNextParametersException.prototype = new RoboHydraException();


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
