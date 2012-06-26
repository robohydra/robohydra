RoboHydra sample plugins
------------------------

These are some examples of configuration files and plugins. To use
them, call RoboHydra like so:

    $ robohydra -I examples/plugins examples/just-tests.conf


Description
-----------

* empty.conf is a configuration file that doesn't load any plugins
  whatsoever.  Thus, the only available path is /robohydra-admin (you
  can create dynamic heads from that web UI)

* just-tests.conf loads a single plugin with only tests (no default
  heads). Go to
  [/robohydra-admin](http://localhost:3000/robohydra-admin) to see the
  tests, start them, and see the list of available heads depending on
  the current running test
