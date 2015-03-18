---
layout: documentation
---
Writing your own plugins
========================

Most uses of RoboHydra need writing custom plugins for the behaviour
you want. Writing plugins is easy, as you can use ready-made RoboHydra
heads that do most common operations. See the
[tutorial](../tutorial) to get an idea of what's possible and get
started, and the [head documentation](../heads) for a detailed
description of the capabilities of each type of head.

A plugin is a _directory-based_ Node package (ie. you can't have
plugins like `robohydra/plugins/my-plugin.js`, it has to be
`robohydra/plugins/my-plugin/index.js` or similar) that defines the
function `getBodyParts`, and maybe also the function
`getSummonerTraits`. When loading your plugin, RoboHydra will call
`getBodyParts` with two parameters:

* `conf`: this is a Javascript object with all configuration
  properties defined in the configuration file and/or the
  command-line, *plus* the special configuration keys `robohydra` (the
  `RoboHydra` object loading the plugin) and `path` (the full path to
  the plugin directory, although it's also available as `__dirname`
  under Node).
* `modules`: this is a Javascript object with special modules for the
  plugin to use. Currently there are two modules available: `assert`,
  used for assertions (see "The 'assert' module" below); and
  `fixtures`, used to load fixtures (see "The 'fixtures' module"
  below).

The `getBodyParts` function must return an object with the following
optional properties:

* `heads`: an *array* of `RoboHydraHead` objects.
* `scenarios`: an *object* with scenario names as properties, and
  objects as values.

For more information about how to define heads read the "[RoboHydra
heads](../heads/)" section. For more information about the
`getSummonerTraits` function read the "[RoboHydra
summoners](../summoners/)" section. For more information about
scenarios read the "[Defining Scenarios](../scenarios/)" section.


Modules
-------

Modules are utility functions available to plugins via the second
parameter to `getBodyParts`. This parameter is an object with several
keys (`assert`, `fixtures`, ...), defined below:

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

These functions are used like `modules.assert.equal(actual, expected)`.


### The "fixtures" module

The `fixtures` module defines a single function, `load`, to load
fixtures. Fixtures are files inside the `fixtures/` subdirectory
inside a plugin directory. From the plugin code you can call
`modules.fixtures.load("foo.bar")` to load the file
`<plugindir>/fixtures/foo.bar`. Note that it returns a [`Buffer`
object](http://nodejs.org/docs/latest/api/buffer.html) (not a string!)
or throw an exception if the fixture is not found or not readable.


Examples
--------

See the [example
plugins](https://github.com/robohydra/robohydra/tree/master/examples/plugins)
and the [standard plugin
library](https://github.com/robohydra/robohydra/tree/master/plugins)
in the repository for examples.
