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

* empty-https.conf is like empty.conf, but listening for HTTPS
  connections. It uses an example, self-signed certificate. You can
  read about how to make your own self-signed certificates at
  http://nodejs.org/docs/latest/api/tls.html.

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

* simple-streaming.conf loads a plugin that serves some simple content
  in chunks, to demonstrate RoboHydra's streaming capabilities. To see
  it in action, go to `/data` and watch how the data comes in slowly
  (you may need to use some command-line tool like `wget` to see the
  effect clearly).

* simple-filtering.conf loads a plugin that will proxy requests to Dev
  Opera, but before returning content to the client, it will replace
  all the occurrences of "developers" by "DEVELOPERS, DEVELOPERS,
  DEVELOPERS, DEVELOPERS".

* simple-summmoner.conf loads a plugin with a summoner
  configuration. All URLs will return 404 because there's no content,
  but you can see in
  [/robohydra-admin](http://localhost:3000/robohydra-admin) that if
  you pass a GET parameter `user`, you'll change the hydra processing
  the request.

* custom-types.conf loads a plugin that demonstrates how to write a
  custom head class. See the code in `examples/plugins/custom-types`.
