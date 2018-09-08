---
layout: documentation
---

New in 0.6.8
============

This is a summary of the changes between RoboHydra 0.6.7 and RoboHydra
0.6.8. For full details, check the
[ChangeLog](https://raw.github.com/robohydra/robohydra/master/ChangeLog).


### Fix proxying code for Node >= 9

Unfortunately, Node 9.x made a breaking change in `url.parse` (in
particular, the value of `someUrl.search` when there isn't any
value). This broke the RoboHydra proxying code. Now it's fixed and it
should work regardless of the Node version.
