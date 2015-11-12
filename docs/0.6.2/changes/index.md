---
layout: documentation
---

New in 0.6.2
============

This is a summary of the changes between RoboHydra 0.6.1 and RoboHydra
0.6.2. For full details, check the
[ChangeLog](https://raw.github.com/robohydra/robohydra/master/ChangeLog).


### Plugin configuration defaults

Now configuration files can have a key `pluginConfigDefaults`,
specifying default configuration settings for all plugins. Any
configuration keys appearing in the plugin itself will of course have
precedence over the configuration defaults.

### Fix bug in proxy-cache

The `proxy-cache` standard plugin wasn't passing the query parameters
in the proxied requests. Now it does.

### Keep compatibility with older versions of Node

Tighten the dependency on `qs` so that RoboHydra keeps working on
older versions of Node.
