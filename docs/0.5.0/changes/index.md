---
layout: default
---

New in 0.5.0
============

This is a summary of the changes between RoboHydra 0.4.0 and RoboHydra
0.5.0. For full details, check the
[ChangeLog](https://raw.github.com/robohydra/robohydra/master/ChangeLog).

### Tweak high-priority head order

Dynamic heads registered as "high priority" now come *after* the admin
plugin. That mostly means that (a) you can't replace the Admin UI with
your own plugin (you'll have to use a different URL) and that (b) you
won't get all the admin plugin requests in `robohydra.log`.

### Deprecated inconsistent names

Mixed-case configuration variables names for plugins are
deprecated (ie. variables like `trafficFilePath` become now
`trafficfilepath`).

Some `roboHydraHeadType` parameter names have been replaced with
more consistent names. In particular, `defaultProps` becomes
`defaultPropertyObject` and `parentPropBuilder` becomes
`parentPropertyBuilder`.

### New head matching possibilities

Now all heads accept properties `method` and `hostname` and will only
match requests that have the same method(s) and/or that have the same
hostname. See the documentation and the [`advanced-matching`
example](https://github.com/robohydra/robohydra/blob/master/examples/plugins/advanced-matching/index.js)
for details.

### New head types: delayer, CORS, and proxy-cache

There are three new standard heads in RoboHydra 0.5.0:

* `delayer`: delays all requests to a given URL (by default, all of
  them) by a given number of milliseconds (by default, 2000).

* `cors`: accepts all CORS requests for a given URL (by default, all
  of them).

* `proxy-cache`: caches responses to GET requests for a given amount
  of time time.

See the [plugin standard library](../plugin-stdlib) documentation for
more details.

### Improvements in `RoboHydraHeadStatic`

There's a new property `repeatMode` in `RoboHydraHeadStatic` that
controls how it uses multiple responses. It can be set to
`round-robin` (default) and `repeat-last`, which just repeats the last
response forever upon reaching it.

### Improvements in configuration files

Now configuration files can specify plugin load paths and the port the
RoboHydra server will listen on.

### Misc

Other bugfixes and improvements, including a Windows absolute path
bugfix.
