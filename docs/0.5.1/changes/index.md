---
layout: default
---

New in 0.5.1
============

This is a summary of the changes between RoboHydra 0.5.0 and RoboHydra
0.5.1. For full details, check the
[ChangeLog](https://raw.github.com/robohydra/robohydra/master/ChangeLog).


### New "headers" property for RoboHydraHeadStatic

Now arbitrary headers can be set in `RoboHydraHeadStatic` responses,
both programmatically and from the Admin UI.

### "roboHydraHeadType" renamed to "robohydraHeadType"

Use the more consistently-cased `robohydraHeadType`. The old one will
still work in 0.5.1, but it's deprecated.

### "chain" method in `Response` deprecated in favour of "follow"

Deprecate the `chain` method in `Response` objects, and create a new
method `follow` which should be used instead. The difference is that
`follow` is called on the receiving object, which is more consistent
with the `copyFrom` method.

### RoboHydra now easier to embed

The `robohydra` module now exports a `createRoboHydraServer` function
that allows for easy embedding of a RoboHydra server in your own
project.

### "reset" method available for all heads

The head method "reset" is now available for all heads.

### Add --quiet option

Now RoboHydra can be called with the --quiet option to avoid printing
any messages on screen. The "quiet" option can also be set from the
configuration file.
