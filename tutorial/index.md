---
layout: default
---
RoboHydra server tutorial
=========================

RoboHydra is an HTTP server designed to help you develop and test clients
of client-server applications. You start RoboHydra by specifying a
configuration file, such as the provided example `empty.conf`:

     robohydra examples/empty.conf

The ([JSON](http://en.wikipedia.org/wiki/Json) format) configuration
file specifies zero or more plugins for RoboHydra to load. In particular,
`empty.conf` doesn't load any plugins, and looks like this:

      {"plugins": []}

Plugins tell RoboHydra how to behave when it receives requests for
given paths. Without any plugins, all requests will initially return
404... except [the RoboHydra admin
interface](http://localhost:3000/robohydra-admin).  You can go to that
interface now and have a look. There's not a lot going on because,
again, there aren't any plugins loaded. But you will find that
interface handy.

Your first canned response
--------------------------

Now, let's assume you want the path `/foo` to always return the
following JSON data:

      {"success": true,
       "results": [{"url": "http://robohydra.org",
                    "title": "RoboHydra testing tool"},
                   {"url": "http://en.wikipedia.org/wiki/Hydra",
                    "title": "Hydra - Wikipedia"}]

You can do that very easily: simply go to the [admin
interface](http://localhost:3000/robohydra-admin), find the "Create a
new head" section at the bottom and type the path and the content in
the appropriate fields, and click on "Create". Don't worry about the
"Content-Type" field: by default, if the content can be parsed as
JSON, it will be `application/json`.

If you now visit [your new head](http://localhost:3000/foo), you
should receive the above data in the response, and with the correct
Content-Type. All other paths will still yield 404. However, if you
kill this RoboHydra and start a new one, that head will be lost. Don't
worry though, you can easily write plugins with whatever heads you
want to have available over and over.


Your first plugin
-----------------

If you wanted to keep this head for later, you could write a simple
plugin like this:

       var RoboHydraHeadStatic = require("robohydra").heads.RoboHydraHeadStatic;

       exports.getBodyParts = function(conf) {
           return {
               heads: [
                   new RoboHydraHeadStatic({
                       path: '/foo',
                       content: {
                           "success": true,
                           "results": [
                               {"url": "http://robohydra.org",
                                "title": "RoboHydra testing tool"},
                               {"url": "http://en.wikipedia.org/wiki/Hydra",
                                "title": "Hydra - Wikipedia"}
                           ]
                       }
                   })
               ]
           };
       };

A plugin is a collection of heads to be added to your RoboHydra on
startup. A "head" is an object that monitors a given URL path pattern
and defines how to process requests for those URLs.

In this case, our first plugin has a single head of type
`RoboHydraHeadStatic`. You can use the `RoboHydraHeadStatic` class
when you only want to return a certain static response regardless of
the incoming request. Now, save the above text in a file
`robohydra/plugins/firstplugin/index.js` and create a new file
`first.conf` with the following content:

      {"plugins": [{"name": "firstplugin", "config": {}}]}

If you start RoboHydra again with `robohydra first.conf`, a head
listening in `/foo` will be readily available.


More flexibility in request handling
------------------------------------

As sending only static, fixed responses is no fun, you can also write
your own Javascript functions to process the requests and build the
responses. For example, say you want to wait for one second before you
send the response back to the client. To do that, modify the `require`
line and `heads` section in your plugin to add a second head like so:

       var RoboHydraHeadStatic = require("robohydra").heads.RoboHydraHeadStatic,
           RoboHydraHead       = require("robohydra").heads.RoboHydraHead;

       exports.getBodyParts = function(conf) {
           return {
               heads: [
                   new RoboHydraHeadStatic({
                       // ... Same as before ...
                   }),

                   new RoboHydraHead({
                       path: '/slow',
                       handler: function(req, res) {
                           setTimeout(function() {
                               res.send("Some slow response");
                           }, 1000);
                       }
                   })
               ]
           };
       };


Accessing the request data
--------------------------

Now let's say that we want to configure how slow the request is going
to return, by specifying URLs like `/slow/1000`, `/slow/5000` and so
on. In this case, RoboHydra allows you to specify URL paths like
`/slow/:millis` which will match any URL path fragment after
`/slow`. The following handler function will allow you to configure
the wait in this way:

       new RoboHydraHead({
           path: '/slow/:millis',
           handler: function(req, res) {
               setTimeout(function() {
                   res.send("Some slow response");
               }, req.params.millis);
           }
       })

But what about URLs like `/slow/?amount=3000`? In that case, you have
the GET parameters avaiable as properties of the object
`req.getParams`. Similarly, the POST parameters and the raw body of
the request are available as `req.bodyParams` and `req.rawBody`
respectively. The latter object is of type `Buffer` (see the [Node
documentation](http://nodejs.org/docs/latest/api/buffer.html)). This
head would match the GET-parameter-style URLs:

       new RoboHydraHead({
           path: '/slow',
           handler: function(req, res) {
               setTimeout(function() {
                   res.send("Some slow response");
               }, req.getParams.millis || 1000);
           }
       })


Other handy kinds of heads
--------------------------

Apart from `RoboHydraHeadStatic` and the generic `RoboHydraHead`,
there are two other head classes: `RoboHydraHeadFilesystem` and
`RoboHydraHeadProxy`. As you can guess, the former serves static files
from the filesystem, while the latter proxies requests to another URL.

One of the many ways in which you can combine these two heads is
having a RoboHydra that proxies everything to another server, except
certain paths that contain your own, local copies of some files. This
can be useful when you have frontend developers working on some site:
if you don't want to make them have their own local installation of
the backend, they can simply have a copy of the CSS and Javascript
files they maintain, and use RoboHydra to serve their local files for
requests to, say, `/css` and `/js` while it proxies all the rest to
the common, development server.

Let's demonstrate this with a simple example. Let's say you use
DuckDuckGo as your search engine, but want to keep [Adam Yauch's
tribute logo]({{ site.url }}/downloads/logo_homepage.normal.v101.png)
as the homepage logo. One way to do this is to grab a copy of the logo
(the one linked in the previous sentence) and the [search box
icon]({{ site.url }}/downloads/search_dropdown_homepage.v102.png),
save them in a folder `fake-assets` and write this simple plugin:

      var RoboHydraHeadFilesystem = require("robohydra").heads.RoboHydraHeadFilesystem,
          RoboHydraHeadProxy      = require("robohydra").heads.RoboHydraHeadProxy;

      exports.getBodyParts = function(conf) {
          return {
              heads: [
                  new RoboHydraHeadFilesystem({
                      mountPath: '/assets',
                      documentRoot: 'fake-assets'
                  }),

                  new RoboHydraHeadProxy({
                      mountPath: '/',
                      proxyTo: 'http://duckduckgo.com'
                  })
              ]
          };
      };

Note that the first head that matches the request dispatches it, so
the order is important! Now save the plugin as
`robohydra/plugins/ddg/index.js`, create a configuration file like
shown below, and start RoboHydra as `robohydra ddg.conf`:

      {"plugins": [{"name": "ddg", "config": {}}]}

You should see the DuckDuckGo page completely functional, but with the
Adam Yauch logo.

Now you know all the basic functionality RoboHydra offers. If you want
more information, you can read and follow the <a
href="advanced/">advanced tutorial</a>.
