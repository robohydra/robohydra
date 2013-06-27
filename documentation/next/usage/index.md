---
layout: documentation
---
RoboHydra usage
===============

To start a RoboHydra server, you call `robohydra` with a configuration
file as a parameter. The RoboHydra configuration file is a JSON file
with the list of plugins to load, and SSL information if you want
RoboHydra to use the HTTPS protocol when responding to requests. A
configuration file without any plugins looks like this:

    {"plugins": []}

Assuming that file is called `empty.conf` (you have one such file in
the `examples` directory in the RoboHydra distribution), if you start
RoboHydra with `robohydra empty.conf` you will get a server that will
return 404 for every URL except the admin interface (available in
`/robohydra-admin`).

Each element in the `plugins` list in the configuration file can be
one of two things:

* A plain Javascript object with the properties `name` and `config`. The
former specifies the name of the plugin to load, while the latter
specifies a Javascript object with the configuration keys and values
you want to pass to the plugin.
* A string with the name of the plugin. This is equivalent to setting
`config` to an empty object.

An example of a RoboHydra configuration file loading a plugin `logger`
(without special configuration) and a plugin named `my-plugin` with
the configuration keys `path` and `logLevel` could be:

    {"plugins": ["logger",
                 {"name": "my-plugin",
                  "config": {"path": "/var/log/example.log",
                             "logLevel": "warn"}]}

You can load as many plugins as you want. Remember that the order is
important: the heads declared in the first will catch requests before
any heads defined in further plugins.

If you want RoboHydra to use the HTTPS protocol, you have to set the
`secure` property to `true`, and the property `sslOptions` to an
object with the following two properties: `key` and `cert`, both being
the paths to the files containing the secret key and the certificate
for the server. An example configuration file for an HTTPS server
could be:

    {"secure": true,
     "sslOptions": {"key":  "my-key.pem",
                    "cert": "my-cert.pem"},
     "plugins": ["logger"]}


Findings plugins
----------------

RoboHydra has a list of directories where it looks for plugins. That
list contains some system-wide directories, and
`robohydra/plugins`. That means that, typically, a plugin called
`my-plugin` will be found in `robohydra/plugins/my-plugin/`.

If you have your plugins in some other directory, you can add
directories to the RoboHydra load path with the `-I` parameter, like
so:

    robohydra -I extra-plugins example.conf

If `example.conf` had a reference to a plugin named `my-plugin`, it
would be searched first under `extra-plugins/my-plugin`, then in the
rest of the search directories.


Overriding configuration values
-------------------------------

Now, let's say you have a configuration file like the above, but for a
concrete execution of RoboHydra you want to use `tmp/test.log` as the
log file. In that case, you don't have to modify your configuration
file. Instead, you can pass the `path` configuration in the
command-line, like so:

    robohydra myapp.conf path=tmp/test.log
