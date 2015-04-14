---
layout: documentation
---
Defining scenarios
==================

Scenarios define interesting server behaviours that allow you to
reproduce certain situations or bugs in your clients. They are a
collection of heads that, together, define that behaviour. Each
scenario is an object with the following properties:

* `instructions` (optional): a *string* explaining what are the steps
  to use the scenario (eg. how to execute a client test). If present,
  it will be shown when activating the scenario in the web interface.
* `heads`: an *array* of heads that will be activated when the
  scenario is running.

There are two ways to define scenarios in your plugin: you can either
specify them as objects in the `scenarios` list returned by
`getBodyParts`, that is, inline in your plugin code; or you can
define each scenario in a separate file. Or a mix between the two.

If you want to define scenarios in separate files, each scenario will
be a file `<scenarioname>.js` inside the `scenarios/` subdirectory
inside your plugin directory. This file is similar to a RoboHydra
plugin: a Node module exporting the function `getBodyParts`. Again,
this function will be called with two parameters, `conf` and
`modules`, and must return a Javascript object with the key `heads`.

When you start a RoboHydra server, all scenarios are inactive. You can
activate any scenario at any time (using the admin web interface, the
[programmatic API](../api) or the [REST API](../rest)), but only one
scenario can be active at a given time: activating one will
automatically deactivate the current active scenario, if there was
one.

When you activate a scenario, the heads defined in the scenario's
`heads` property are added to the hydra. These heads have precedence
over normal plugins heads, but not over dynamic heads. Also note that
every time a scenario is activated, the `reset` method is called on
every head defined in that scenario. This allows for reliable
behaviour even when heads have an internal state
(eg. `RoboHydraHeadStatic` heads that use multiple responses).


Example plugin
--------------

This is a relatively small sample plugin with one head and two
scenarios. Note how the second scenario uses the assert module (see
[Writing plugins](../plugins/) for more information):

{% highlight javascript %}
var heads               = require('robohydra').heads,
    RoboHydraHeadStatic = heads.RoboHydraHeadStatic,
    RoboHydraHead       = heads.RoboHydraHead;

exports.getBodyParts = function(conf, modules) {
    "use strict";

    // This can be passed on the command-line as eg.:
    //     robohydra foo.conf defNumberResults=10
    var defNumberResults = parseInt(conf.defNumberResults, 10) || 5;
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
