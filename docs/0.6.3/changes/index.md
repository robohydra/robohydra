---
layout: documentation
---

New in 0.6.3
============

This is a summary of the changes between RoboHydra 0.6.2 and RoboHydra
0.6.3. For full details, check the
[ChangeLog](https://raw.github.com/robohydra/robohydra/master/ChangeLog).


### Fix bug in `pluginConfigDefaults`

When using `pluginConfigDefaults`, the configuration from different
plugins would be mixed in very bad ways. Now it behaves as expected.

### Make the `logger` plugin respect streaming

The `logger` plugin would break streaming heads, so that requests would
always wait to have all the response information, then send everything
at once. Now the plugin handles streaming well, so streaming heads get
the right behaviour also when having a `logger` plugin in front.
