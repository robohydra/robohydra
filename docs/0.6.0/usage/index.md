---
layout: documentation
---
RoboHydra usage
===============

The normal way to start a RoboHydra is specifying a configuration file
with the plugins to load, and possibly other settings:

    robohydra myconfig.conf

That will start a RoboHydra server listening on port 3000, which you
can kill by hitting Ctrl-C on the console.

Not specifying a configuration file will normally result in an error,
but you can specify the `-n` flag to make RoboHydra not try to read
any configuration file. In that case, you _can_ specify a list plugins
to be loaded:

    robohydra -n -P logger,replayer

You can load as many plugins as you want. Remember that the order is
important: the heads declared in the first will catch requests before
any heads defined in further plugins.

Calling the `robohydra` program without any arguments whastoever will
show the help.


Findings plugins
----------------

RoboHydra has a list of directories where it looks for plugins. That
list contains some system-wide directories, and
`robohydra/plugins`. That means that, typically, a plugin called
`my-plugin` will be found in `robohydra/plugins/my-plugin/`.

If you have your plugins in some other directory, you can add
directories to the RoboHydra load path with the `-I` parameter, like
so:

    robohydra -I extra-plugins -n -P my-plugin

RoboHydra will in that case look for `my-plugin` under
`extra-plugins/my-plugin`, then in the rest of the search directories.


Configuration values for plugins
--------------------------------

You can also pass configuration key-value pairs from the command-line,
like so:

    robohydra myapp.conf path=tmp/test.log

This way, the configuration key `path` will be set to `tmp/test.log`
for *all* plugins, overriding anything the configuration file says.
