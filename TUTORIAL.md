Hydra server tutorial
=====================

Hydra is an HTTP server. To start it you specify a configuration file
with zero or more plugins:

     hydra examples/empty.conf

The file empty.conf is one of the Hydra distribution examples. It
looks like this (as you can see, it's in
[JSON](http://en.wikipedia.org/wiki/Json) format):

      {"plugins": []}

If you start it with such a configuration, it won't load any plugins
so it won't know what to do. Thus, all requests will return
404... except [http://localhost:3000/hydra-admin](the Hydra admin
interface). You can go to that interface now and have a look. There's
not a lot going on because, again there aren't any plugins loaded, but
you will find that interface handy.

Your first canned response
--------------------------

Now, let's assume you want the path `/foo` to always return the
following JSON data:

      {"success": true,
       "results": [{"url": "http://hydrajs.org",
                    "title": "Hydra testing tool"},
                   {"url": "http://en.wikipedia.org/wiki/Hydra",
                    "title": "Hydra - Wikipedia"}]

You can do that very easily: simply go to the
[http://localhost:3000/hydra-admin](admin interface) find the "Create a
new head" section at the bottom and type the path and the content in
the appropriate fields, and click on "Create". Don't worry about the
Content-Type: by default, if the content can be parsed as JSON, it
will be `application/json`.

If you now visit [http://localhost:3000/foo](your new head), you
should receive the above data in the response, with the correct
Content-Type. All other paths will still yield 404. However, if you
kill this Hydra and start a new one, that head will be lost. Don't
worry though, you can easily write plugins with the heads that you
want to have available over and over.


Your first plugin
-----------------

If you wanted to keep this head for later, you could write a simple
plugin like this:

       var HydraHeadStatic = require("hydra").heads.HydraHeadStatic;

       exports.getBodyParts = function(conf) {
           return {
               heads: [
                   new HydraHeadStatic({
                       path: '/foo',
                       content: {
                           "success": true,
                           "results": [
                               {"url": "http://hydrajs.org",
                                "title": "Hydra testing tool"},
                               {"url": "http://en.wikipedia.org/wiki/Hydra",
                                "title": "Hydra - Wikipedia"}
                           ]
                       }
                   })
               ]
           };
       };

You can use the `HydraHeadStatic` class when you only want to return a
certain static response regardless of the incoming request. Now, save
the plugin text in a file `hydra/plugins/firstplugin/index.js` and
create a new configuration file `first.conf` with the following
content:

      {"plugins": [{"name": "firstplugin", "config": {}}]}

If you start Hydra again with `hydra first.conf`, a head listening in
`/foo` will be readily available.


More flexibility in request handling
------------------------------------

As sending only static, fixed responses is no fun, you can also write
your own Javascript functions to process the requests and build the
responses. For example, say you want to wait for one second before you
send the response back to the client. To do that, modify the `require`
line and `heads` section in your plugin to add a second head like so:

       var HydraHeadStatic = require("hydra").heads.HydraHeadStatic,
           HydraHead       = require("hydra").heads.HydraHead;

       exports.getBodyParts = function(conf) {
           return {
               heads: [
                   new HydraHeadStatic({
                       // ... Same as before ...
                   }),

                   new HydraHead({
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


Other handy kinds of heads
--------------------------

Apart from `HydraHeadStatic` and the generic `HydraHead`, there are
two other interesting heads you might want to use. They are
`HydraHeadFilesystem` and `HydraHeadProxy`. As you can guess, the
former server static files from the filesystem, while the latter
proxies the requests to another URL.

One of the many ways in which you can combine these two heads is
having a Hydra that proxies everything to another server, except
certain paths that contain your own, local copies of some files. This
can be useful when you have frontend developers working on some site:
if you don't want to make them have their own local installation of
the backend, they can simply have a copy of the CSS and Javascript
files they maintain, and use Hydra to serve their local files for
requests to, say, `/css` and `/js` while it proxies all the rest to
the common, development server.

But let's demonstrate this with a simpler example. Let's say you use
DuckDuckGo as your search engine, but want to keep [Adam Yauch's
tribute logo](http://hcoder.org/) as the homepage logo. One way to do
this is to grab a copy of the logo (the one linked in the previous
sentence) and the [search box icon](http://hcoder.org), save them in a
folder `fake-assets` and write this simple plugin:

      var HydraHeadFilesystem = require("hydra").heads.HydraHeadFilesystem,
          HydraHeadProxy      = require("hydra").heads.HydraHeadProxy;

      exports.getBodyParts = function(conf) {
          return {
              heads: [
                  new HydraHeadFilesystem({
                      basePath: '/assets',
                      documentRoot: 'fake-assets'
                  }),

                  new HydraHeadProxy({
                      basePath: '/',
                      proxyTo: 'http://duckduckgo.com'
                  })
              ]
          };
      };

Note that the first head that matches the request dispatches it, so
the order is important! Now save the plugin as
`hydra/plugins/ddg/index.js`, create a configuration file like shown
below, and start Hydra as `hydra ddg.conf`:

      {"plugins": [{"name": "ddg", "config": {}}]}

You should see the DuckDuckGo page completely functional, but with the
Adam Yauch logo.
