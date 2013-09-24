---
layout: documentation
---
Writing your own plugins
========================

Most uses of RoboHydra need writing custom plugins for the behaviour
you want. Writing plugins is easy, as you can use ready-made RoboHydra
heads that do most common operations. See the
[tutorial](/tutorial) to get an idea of what's possible and get
started, and the [head documentation](../heads) for a detailed
description of the capabilities of each type of head.

A plugin is a _directory-based_ Node package (ie. you can't have
plugins like `robohydra/plugins/my-plugin.js`, it has to be
`robohydra/plugins/my-plugin/index.js` or similar) that defines the
function `getBodyParts`. When loading your plugin, RoboHydra will call
that function with two parameters:

* `conf`: this is a Javascript object with all configuration
  properties defined in the configuration file and/or the
  command-line, *plus* the special configuration keys `robohydra` (the
  `RoboHydra` object loading the plugin) and `path` (the full path to
  the plugin directory, although it's also available as `__dirname`
  under Node).
* `modules`: this is a Javascript object with special modules for the
  plugin to use. Currently there are two modules available, `assert`,
  used for assertions (see "The 'assert' module" below); and
  `fixtures`, used to load fixtures (see "The 'fixtures' module"
  below).

The `getBodyParts` function must return an object with the following
optional properties:

* `heads`: an *array* of `RoboHydraHead` objects.
* `scenarios`: an *object* with scenario names as properties, and
  objects as values.


### Defining scenarios

Scenarios define interesting server behaviours that allow you to
reproduce certain situations or bugs in your clients. They are a
collection of heads that, together, define that behaviour. Each
scenario is an object with the following properties:

* `instructions` (optional): a *string* explaining what are the steps
  to use the scenario (eg. how to execute a client test). If present,
  it will be shown when activating the scenario in the web interface.
* `heads`: an *array* of heads that will be activated when the
  scenario is running.

When you start a RoboHydra server, all scenarios are inactive. You can
activate any scenario at any time (using the admin web interface, the
[programmatic API](../api) or the [REST API](../rest)), but only one
scenario can be active at a given time: activating one will
automatically deactivate the current active scenario, if there was
one. When you activate a scenario, both the heads defined in the
**plugin** `heads` property and the heads defined in the **scenario**
`heads` property are active, but the scenario heads have preference.


### The "assert" module

The assert module defines all functions in Node's [`assert`
module](http://nodejs.org/docs/latest/api/assert.html). However, there
are two key differences between RoboHydra's assert module and Node's:

1. RoboHydra's assert functions are tied to the RoboHydra server,
allowing RoboHydra to fetch and store the results and present them on
the web interface.

2. RoboHydra's assert functions *won't die* when there's an assert
failure, but instead will return `false`. This is much more useful
because it allows you to easily return a normal response to the client
(the same or different than the response the client would get if the
assertion had passed).


### The "fixtures" module

The fixtures module defines a single function, `load`, to load
fixtures. Fixtures are files inside the `fixtures/` subdirectory
inside a plugin directory. From the plugin code you can call
`modules.fixtures.load("foo.bar")` to load the file
`<plugindir>/fixtures/foo.bar`.


### Example plugin

This is a relatively small sample plugin with one head and two
scenarios. Note how the second scenario uses the assert module:

{% highlight javascript %}
var heads               = require('robohydra').heads,
    RoboHydraHeadStatic = heads.RoboHydraHeadStatic,
    RoboHydraHead       = heads.RoboHydraHead;

exports.getBodyParts = function(config, modules) {
    "use strict";

    // This can be passed on the command-line as eg.:
    //     robohydra foo.conf defNumberResults=10
    var defNumberResults = parseInt(config.defNumberResults, 10) || 5;
    var counter = 0;
    var assert = modules.assert;

    return {
        heads: [
            new RoboHydraHead({
                path: '/api/search',
                handler: function(req, res) {
                    var searchTerm = req.queryParams.q || '';
                    var searchResults = [];
                    if (searchTerm !== '') {
                        for (var i = 0, len = defNumberResults; i < len; i++) {
                            searchResults.push({
                                id: 'widget' + i,
                                name: 'widget with "' + searchTerm + '" in ' +
                                    'its name'
                            });
                        }
                    }

                    res.send(JSON.stringify(searchResults, null, 2));
                }
            })
        ],

        scenarios: {
            "Internal Server Error": {
                heads: [
                    new RoboHydraHeadStatic({
                        path: '/api/search',
                        statusCode: 500,
                        content: "Couldn't connect to the database"
                    })
                ]
            },

            "The client correctly sends a search for 'foo'": {
                heads: [
                    new RoboHydraHead({
                        path: '/api/search',
                        handler: function(req, res) {
                            var searchTerm = req.queryParams.q;
                            assert.equal(searchTerm, 'foo',
                                         'The client should search for "foo"');
                            res.send(JSON.stringify([{
                                id: 123,
                                name: 'Bogus search for the search test, ' +
                                    'searched for "' + searchTerm + '"'
                            }]));
                        }
                    })
                ]
            }
        }
    };
};
{% endhighlight %}


See the [example
plugins](https://github.com/robohydra/robohydra/tree/master/examples/plugins)
and the [standard plugin
library](https://github.com/robohydra/robohydra/tree/master/plugins)
in the repository for more examples.
