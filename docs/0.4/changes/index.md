---
layout: default
---

New in 0.4
==========

This is a summary of the changes between RoboHydra 0.3 and RoboHydra
0.4. For full details, check the
[ChangeLog](https://raw.github.com/robohydra/robohydra/master/ChangeLog).


### "Tests" renamed to "scenarios"

"Tests" (as in the collection of heads that get attached/detached at
the same time) are now called "scenarios". It's a more appropriate
name and much less ambiguous.

The use of `tests` in plugins is deprecated, and support for it will
be dropped the next version.

### REST API

Now there's an actual [REST API](../rest) to easily interact with the
RoboHydra server: it allows you to check and manipulate the state of
the heads and scenarios of a given hydra.

### External scenarios

Scenarios can now be written in their own file in a special directory
inside the plugin, as opposed to being written inside the plugin's
`index.js`. This makes it much easier to maintain plugins with many
scenarios.

### Property `setHostHeader` now `true` by default

This is a **breaking change**, but I don't expect a lot of people to
be bitten by this. On the other hand, I'm constantly bitten by the
old counter-intuitive default value, and it's hard to debug and figure
out what the problem is if you don't already know that RoboHydra
doesn't set it by default.

### New "fixtures" module

Plugins now receive a second module, `fixtures`, in the second
parameter to `getBodyParts`. This new module has a single function,
`load`, that allow you to load fixtures easily without having to worry
about paths. See the [plugin documentation](../plugins) for details.

### RoboHydra Summoners

Version 0.4 introduces a new feature, summoners, that allows you to
use a single RoboHydra server for multiple users. Read the [rationale,
documentation and examples](../summoners) for more details.

### Configuration files now optional

RoboHydra has a new command-line option, `-n`, to avoid reading a
configuration file. It also has an option `-P` to specify a
comma-separated list of plugins to load on startup. These two options
combined allow you to start RoboHydra without any configuration file.

### Standard way to create new classes of heads

RoboHydra 0.4 also introduces a standard way to [create your own head
classes](../custom-heads), the `roboHydraHeadType` function.

### Simplified admin UI

The new admin UI is a bit simpler and has been adapted to the changes
in this version.
