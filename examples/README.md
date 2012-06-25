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
  heads). Go to /robohydra-admin to see the tests, start them, and see
  the list of available heads depending on the current running test

* replayer.conf loads 'replayer', a simple plugin to record and replay
  requests (useful to, say, record how the server behaved at a certain
  point, then replay the requests to reproduce the problem while
  offline). To use it, you have to start RoboHydra as "robohydra -I
  examples/plugins examples/replayer.conf
  replayerurl=http://myserver.example.com". Then, visit the URL
  /start-recording when you want to start recording and visit whatever
  URLs you want (RoboHydra will proxy to the "replayerurl"). When you
  have the requests recorded, visit /start-replaying to stop recording
  and start replaying those requests. All recorded requests are in
  robohydra-replayer.json, so you can keep the file around and replay
  whenever you want.
