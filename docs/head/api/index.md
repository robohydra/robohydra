---
layout: documentation
---
Taming the RoboHydra programmatically
=====================================

In some situations you will want to access or control the RoboHydra
that loaded the plugin. As the `config` object passed to
`getBodyParts` function has a reference to it, you can call any
methods to get information or change it: starting tests, loading extra
plugins, detaching or re-attaching heads, injecting extra test
results, sending the test results to another server, or any other
thing you can think of. You could also write your own admin interface
if you wanted to, as the stock admin interface is essentially a normal
plugin (see
[`lib/plugins/admin.js`](https://github.com/robohydra/robohydra/blob/master/lib/plugins/admin.js)
in the RoboHydra source code).

The following is a list of interesting public RoboHydra API methods
and properties:

* `registerDynamicHead`: receives a head and an object with
  options. Registers the head in RoboHydra (at the _beginning_ of the
  appropriate pseudo-plugin, which by default is `*dynamic*`). The
  only possible option is `priority`: if it's set to `high`, the head
  will be added to the `*priority-dynamic*` pseudo-plugin instead.
* `registerPluginObject`: receives a plugin as a parameter
  and registers it in RoboHydra (at the end). A plugin is a Javascript
  object with the following properties:

  * `name`: mandatory, must be made of just ASCII letters, numbers,
  underscores and dashes.
  * `path`: mandatory, it points to the plugin _directory_.
  * `config`: optional, an object with the plugin configuration.
  * `module`: mandatory, the plugin module (ie. an object with the
  `getBodyParts` function; see more information in the
  [plugin documentation](../plugins)).
* `getModulesObject`: returns an object with the available modules.
* `getPlugins`: returns a list of all current plugins, including
  pseudo-plugins.
* `getPluginNames`: returns a list of all current plugin names, including
  pseudo-plugins.
* `getPlugin`: receives one parameter (plugin name) and returns the
  plugin by that name. If there's no registered plugin with the given
  name it throws a `RoboHydraPluginNotFoundException`.
* `headForPath`: given a URL path, it returns the first head that
  matches that URL. If given a head as a second parameter
  (`afterHead`), only heads appearing after `afterHead` will be
  considered.
* `attachHead` / `detachHead`: given a plugin name and a head name,
  they (re-)attach or detach the given head. If no such head exists,
  `RoboHydraHeadNotFoundException` is thrown. If the head was already
  attached/detached, `InvalidRoboHydraHeadStateException` is thrown.
* `addPluginLoadPath`: It adds the given path to the list of paths to
  search for plugins.
* `startScenario`: given a plugin name and scenario name, start the
  given scenario. If it doesn't exist, throw
  `InvalidRoboHydraTestException`.
* `stopScenario`: stops the current scenario, if any.
* `currentScenario` (property): object with two properties, `plugin`
  and `scenario`, pointing to the currently active scenario. If
  there's no active scenario, it's `*default*` / `*default*`.
* `testResults` (property): object with the current test results. Its
  keys are plugin names and its values are objects with scenario names
  as keys. The values of the latter objects are test results: objects
  with the keys `result` (value is `undefined` if the test doesn't
  have any result yet, or `pass` or `fail` if at least one assertion
  has run for that test), `passes` (an array with the description of
  the passing assertions) and `failures` (ditto for failing
  assertions).
