---
layout: default
---

New in 0.x.x
============

This is a summary of the changes between RoboHydra 0.5.0 and RoboHydra
0.x.x. For full details, check the
[ChangeLog](https://raw.github.com/robohydra/robohydra/master/ChangeLog).


### New "headers" property for RoboHydraHeadStatic

Now arbitrary headers can be set in `RoboHydraHeadStatic` responses,
both programmatically and from the Admin UI.

### "roboHydraHeadType" renamed to "robohydraHeadType"

Use the more consistently-cased `robohydraHeadType`. The old one will
still work, but it's deprecated.

### "reset" method available for all heads

The head method "reset" is now available for all heads.
