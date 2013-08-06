---
layout: documentation
---
Writing your own plugins
========================

Most uses of RoboHydra need writing custom plugins for the behaviour
you want. Writing plugins is easy, as you can use ready-made RoboHydra
heads that do most common operations. See the
[tutorial](../../tutorial) to get an idea of what's possible and get
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
  plugin to use. Currently there is only one module available,
  `assert`, used for assertions (see "The 'assert' module" below for
  more information).

The `getBodyParts` function must return an object with the following
optional properties:

* `heads`: an *array* of `RoboHydraHead` objects.
* `scenarios`: an *object* with scenario names as properties, and
  objects as values.


### Defining scenarios

Scenarios define interesting server behaviours that allow you to
reproduce certain situations or bugs in your clients. They are a
collection of heads that, together, define that scenario. Each
scenario is an object with the following properties:

* `instructions` (optional): a *string* explaining what are the steps
  to use the scenario (eg. how to execute a client test). If present,
  it will be shown when activating the scenario in the web interface.
* `heads`: an *array* of heads that will be activated when the
  scenario is running.


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
