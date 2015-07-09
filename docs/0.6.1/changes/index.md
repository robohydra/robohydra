---
layout: documentation
---

New in 0.6.1
============

This is a summary of the changes between RoboHydra 0.6.0 and RoboHydra
0.6.1. For full details, check the
[ChangeLog](https://raw.github.com/robohydra/robohydra/master/ChangeLog).


### Can manipulate hydras created by a summoner

If you're using [summoners](../summoners/), now you can delete hydras
created by it using the Admin web UI, or the [REST API](../rest/).

### New head type: replayer

The new head `RoboHydraHeadReplayer` replays traffic saved by the
`replayer` plugin. Having it as an independent head makes it easier to
save the traffic of several interesting interactions, and eg. make
scenarios based on them.

### Plugin improvements

Big improvements in the `replayer` plugin UI; added `delaydisabled`
option to the `delayer` plugin to disable it on startup.
