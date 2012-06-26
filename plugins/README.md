RoboHydra plugin library
========================

These are some useful plugins you might want to use for your own
RoboHydra servers. As they're bundled in a special directory of the
RoboHydra distribution, you can use them in your configuration files
without specifying extra load directories (ie. no need to use -I).


How to use them
---------------

To use them, simply mention them in your configuration file like in
the following examples. Note that typically they must appear before
your other plugins.

Example 1: myserver.conf (load "no-caching")

    {"plugins": [{"name": "no-caching",
                  "config": {}},
                 {"name": "some-other-plugin",
                  "config": {}}]}

Example 2: myserver.conf (load "no-caching" with custom configuration)

    {"plugins": [{"name": "no-caching",
                  "config": {"nocachingpath": "/custom-path"}},
                 {"name": "some-other-plugin",
                  "config": {}}]}


Description
-----------

* logger - simple logging plugin that will save all traffic to
  robohydra.log in the current directory. This plugin is useful in
  many situations so you should consider loading it for any
  non-trivial RoboHydra server.

* no-caching - tweaks client requests to remove caching headers (in
  particular, it deletes the If-Modified-Since header and sets
  Cache-Control to 'no-cache'). By default no-caching removes those
  requests for all paths, but you can specify a custom path calling
  RoboHydra as "robohydra your.conf nocachingpath=/foo". The 'logger'
  plugin is a good companion for 'no-caching', as it allows you to see
  the effects on the requests.

* replayer - plugin that records or replays requests (useful to, say,
  record how the server behaved at a certain point, then replay the
  requests to reproduce the problem while offline). To use it, you
  have to start RoboHydra as `robohydra -I examples/plugins
  examples/replayer.conf
  replayerurl=http://myserver.example.com`. Then, visit the URL
  [/start-recording](http://localhost:3000/start-recording) when you
  want to start recording and visit whatever URLs you want (RoboHydra
  will proxy to the "replayerurl"). When you have the requests
  recorded, visit
  [/start-replaying](http://localhost:3000/start-replaying) to stop
  recording and start replaying those requests. All recorded requests
  are in `robohydra-replayer.json`, so you can keep the file around
  and replay whenever you want.
