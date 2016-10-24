---
layout: documentation
---

New in 0.6.5
============

This is a summary of the changes between RoboHydra 0.6.3/0.6.4 and
RoboHydra 0.6.5. For full details, check the
[ChangeLog](https://raw.github.com/robohydra/robohydra/master/ChangeLog).


### Deprecated `req.bodyParams`

From this version, `req.bodyParams` is deprecated. Instead, use
`req.body` (see below).

### Added `req.body`

Add new `body` property to request objects. It will contain a parsed
version of the body, if possible: for
`application/x-www-form-urlencoded` requests, `body` will have the
same contents as `bodyParams`; for `application/json` requests, `body`
will have an object with the parsed JSON body, etc.

### Added new `passThrough` option to `RoboHydraHeadFilesystem`

Add a new `passThrough` option to `RoboHydraHeadFilesystem`. When this
option is set to `true` (default is `false`), any requests to
non-existent files will pass-through to the next head instead of
returning 404.

### Added new `admin` priority for dynamic heads

This new priority (which can be passed to
`robohydra.registerDynamicHead()`) allows placing heads at the very
top, before the admin plugin.  This is useful for eg. replacing parts
of the admin UI, to protect it with a password, or to limit its access
to certain IPs ranges.

### Add `robohydra/` to the plugin search path

From this version, `robohydra/` is part of the plugin search
path. That means that by default you can now write your plugins as
`robohydra/PLUGINNAME/index.js`, in addition to the longer
`robohydra/plugins/PLUGINNAME/index.js`.
