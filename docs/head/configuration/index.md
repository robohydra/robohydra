---
layout: documentation
---

The configuration file
======================

The RoboHydra configuration file is a JSON file with the list of
plugins to load, the port to listen on, SSL information if you want
RoboHydra to use the HTTPS protocol when responding to requests, and
information about the [RoboHydra summoner](../summoners).

_It doesn't actually contain any heads, those go in plugins! See the
[Writing your own plugins](../plugins) section for more information._

Plugins
-------

A basic configuration file with a simple list of plugins looks like
this:

{% highlight json %}
{"plugins": ["logger", "replayer"]}
{% endhighlight %}

Each element in the `plugins` list in the configuration file can be
one of two things:

* A Javascript object with the properties `name` and `config`. The
former specifies the name of the plugin to load, while the latter
specifies a Javascript object with the configuration keys and values
you want to pass to the plugin.
* A string with the name of the plugin. This is equivalent to setting
`config` to an empty object.

For example, a RoboHydra configuration file loading a plugin `logger`
without special configuration and a plugin named `my-plugin` with the
configuration keys `path` and `logLevel` could be:

{% highlight json %}
{"plugins": ["logger",
             {"name": "my-plugin",
              "config": {"path": "/var/log/example.log",
                         "logLevel": "warn"}}]}
{% endhighlight %}

Plugin load paths
-----------------

If you don't have your plugins in `robohydra/plugins` or any of the
other plugin directories, you can specify a list of extra directories
for RoboHydra to search for plugins with the `pluginLoadPaths` key:

{% highlight json %}
{"plugins": ["logger", "myplugin"],
 "pluginLoadPaths": [".", "functional-tests/robohydra-plugins"]}
{% endhighlight %}

Directories later in the array have higher precedence, but plugin load
directories specified on the command line have even higher precedence.


Port
----

You can specify the port RoboHydra should listen on with the key
`port`:

{% highlight json %}
{"plugins": ["myplugin"],
 "port": 3003}
{% endhighlight %}

A port specified on the command line (`-p` option) will have
precedence over the port number in the configuration file.


Quiet
-----

If you don't want RoboHydra to print anything (except errors) on
screen, you can use the `quiet` option:

{% highlight json %}
{"plugins": ["myplugin"],
 "quiet": true}
{% endhighlight %}


SSL configuration
-----------------

If you want RoboHydra to use the HTTPS protocol, ie. to respond to SSL
requests, you have to set the `secure` property to `true`, and the
property `sslOptions` to an object with the properties `key` and
`cert` specifying the paths to the files containing the secret key and
the server certificate respectively. An example configuration file for
an HTTPS server could be:

{% highlight json %}
{"secure": true,
 "sslOptions": {"key":  "my-key.pem",
                "cert": "my-cert.pem"},
 "plugins": ["logger"]}
{% endhighlight %}


Summoners
---------

When you use [summoners](../summoners) and have more than one plugin
that specifies a hydra picker, you need to specify in the
configuration file which of the plugins contains the picker to be used
(because you can only use one!). You do so by setting the
configuration key `summoner` to an object with the property
`hydraPickerPlugin` set to the name of that plugin. For example:

{% highlight json %}
{"plugins": ["plugin-with-picker", "another-plugin-with-picker", "moar"],
 "summoner": {"hydraPickerPlugin": "plugin-with-picker"}}
{% endhighlight %}

Specifying a plugin that doesn't define any picker will result in an
error. On the other hand, if you only load one plugin that defines a
picker, there's no need to specify `hydraPickerPlugin` in the
configuration file.
