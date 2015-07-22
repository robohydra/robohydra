---
layout: documentation
---

New in 0.x.x
============

This is a summary of the changes between RoboHydra 0.6.1 and RoboHydra
0.x.x. For full details, check the
[ChangeLog](https://raw.github.com/robohydra/robohydra/master/ChangeLog).


### Fix bug in proxy-cache

The `proxy-cache` standard plugin wasn't passing the query parameters
in the proxied requests. Now it does.
