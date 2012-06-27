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

* delayed-proxy.conf loads a plugin that proxies all requests to
  http://robohydra.org, but only after waiting one second (you can
  specify a different URL by calling RoboHydra like `robohydra -I
  examples/plugins examples/delayed-proxy.conf
  proxyto=http://example.com`). This is useful to simulate networks
  with high latency or overloaded servers. You can go to the special
  URL
  [`/configure-delay/<NUMBER-MILLISECONDS>`](http://localhost:3000/configure-delay/5000)
  to configure the number of milliseconds to wait before proxying.

* simple-i18n.conf loads a plugin that serves static files taking into
  account the preferred language set in the request headers, eg. if a
  request comes for `/foobar.html` and the `Accept-Language` header
  contains `es`, it will try to serve `/foobar.es.html` first; if it
  doesn't exist, it will serve `/foobar.html`. It serves files from
  the `examples/simple-i18n` directory by default, but you can set a
  different directory by calling it with `robohydra -I
  examples/plugins examples/simple-i18n.conf
  simplei18ndir=my/other/dir`. It also loads the logger plugin so it's
  easy to see what's going on.
