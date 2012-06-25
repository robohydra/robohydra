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
