---
layout: documentation
---
Plugin standard library
=======================

RoboHydra comes with a number of plugins offering functionality that,
while useful in many situations, doesn't belong in the core of
RoboHydra. These plugins are always in the load path, but if you want
them in your server, you must explicitly mention them in your
configuration file or command-line options. The following is a
description of the different available plugins and how to use them:

`frontend-dev-proxy`
--------------------

Simple proxy for front-end developers. It proxies requests to a given
URL (eg. your internal development server) except for a list of URL
paths, which will be served from local files (eg. front-end files like
CSS or Javascript). This allows front-end developers to work on an
application without having to install a full backend on their
machines.

To use it, load the `frontend-dev-proxy` plugin and set its `proxyurl`
configuration variable to the proxy target URL, and `urlpath` to a
comma-separated list of URL paths that will be served from the local
filesystem. Finally, `localdir` must be set to a comma-separated list
of _local directories_ to serve the URL paths from. Variables
`urlpath` and `localdir` need to have the same number of
elements. Assume you start RoboHydra like so:

{% highlight bash %}
$ robohydra -n -P frontend-dev-proxy proxyurl=http://dev.example.com \
                       urlpath=/css,/js localdir=static/css,static/js
{% endhighlight %}

A request to such a server to `http://localhost:3000/css/project.css`
will be served from the local file `static/css/project.css`, a request
to `http://localhost:3000/js/vendor/lodash.js` will be served from the
local file `static/js/vendor/lodash.js`, and a request to
`http://localhost:3000/categories/` will be proxied to
`http://dev.example.com/categories/`.


`logger`
--------

Simple logging plugin that will save all traffic to `robohydra.log` in
the current directory. While it doesn't log the full contents of the
response bodies; paths, headers and an excerpt of the response body
are present in an easy-to-scan, plain-text form so this plugin is
useful in many situations to debug problems or see traffic patterns.

To use it, simply load plugin `logger` anywhere.

See the [standard plugins
screencast](http://www.youtube.com/watch?v=tuEOSoi0RFM#t=7m30s) for
more details.


`no-caching`
------------

Avoids any client-side caching by tweaking client request caching
headers. In particular, it deletes the `If-Modified-Since` header and
sets `Cache-Control` to `no-cache`.

By default `no-caching` operates on all requests, but you can limit
its influence to requests to a given path by setting the
`nocachingpath` configuration variable to that path. This can be done
in the [configuration file](../configuration/) or on the command-line
(eg. calling RoboHydra as `robohydra your.conf
nocachingpath=/foo`). Note that the value of `nocachingpath` is
interpreted as a regular expression, as it will be the value of the
`path` property of the head that tweaks the headers.

The `logger` plugin is a good companion for the `no-caching` plugin,
as it allows you to see the effects on the requests.  See the
[standard plugins
screencast](http://www.youtube.com/watch?v=tuEOSoi0RFM#t=7m30s) for
more details.


`replayer`
----------

Records or replays traffic. This is useful in a number of situations,
like replaying certain server traffic while offline, capturing certain
bug-inducing traffic to attach to a bug or test case, record some
traffic to fiddle with it and replay modified versions to see what
happens when a client receives broken/unusual responses from the
server, etc.

To use it, load the `replayer` plugin and set the variable
`replayerurl` to the URL of the site you want to record, eg. start
RoboHydra as `robohydra -n -P replayer
replayerurl=http://myserver.example.com/api`. To start recording,
visit the URL
[/start-recording](http://localhost:3000/start-recording) and then
visit whatever URLs you want. With the configuration above, any
requests to `http://localhost:3000/foobar` will go to
`http://myserver.example.com/api/foobar`. The traffic will be saved in
a file `robohydra-replayer.json` in the current directory by default,
but a different filename can be specified in the `trafficFilePath`
configuration variable. Note that this traffic file is relatively easy
to fiddle with, which makes it easy to make variations of the traffic
for testing.

Once you have some traffic that you want to replay (recorded in the
same session or simply a file you had pre-recorded in a previous
session), you can replay it by visiting the URL
[/start-replaying](http://localhost:3000/start-replaying). From that
moment on, the recording will stop and requests to, say,
`http://localhost:3000/foobar` will receive the response recorded for
`/foobar` (if there was more than one response recorded for that URL,
all responses will be in the traffic file and used in a round-robin
fashion). Any requests made to paths that don't have any recorded
response will result with 404 Not Found.

See the [standard plugins
screencast](http://www.youtube.com/watch?v=tuEOSoi0RFM#t=31s) for more
details.
