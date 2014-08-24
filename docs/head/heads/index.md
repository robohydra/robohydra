---
layout: documentation
---
RoboHydra heads
===============

Heads are the basic building blocks for RoboHydra-based servers. They
are pieces of code that define the server behaviour when a request
comes for a given URL path. For example, one head might "listen to"
requests to any URL path under `/static` (say, serving static files
from the filesystem), while another head might listen to requests to
`/api` (say, returning a canned response that happens to be useful for
testing, or never replying, or waiting for a couple of seconds before
returning a 500 Internal Server Error response).

When RoboHydra receives a new HTTP request, it goes through all active
heads in order. When it finds a head that matches the path of the
incoming request, RoboHydra dispatches the request with that
head. Otherwise, it returns 404.


The basic head
--------------

The most important type of head is `RoboHydraHead`. This is the
generic head that all other heads inherit from. It's the most generic
because it's defined by a URL path regular expression and a Javascript
handling function. To create a generic head, you need to pass the
following parameters:

* `name` (optional): a *string* with a symbolic name for the head.
* `path`: a *string* with a regular expression matching the paths this
  head should handle. Note that there are implicit "^" and "$" at the
  beginning and end of the string, and that GET parameters are
  stripped from the incoming request before trying to match with this
  regular expression. Also, URL endings are normalised in such a way
  that a head with path `/foo` or `/foo/` will match requests for both
  `/foo` and `/foo/`.
* `method` (optional): a *string* or *array* specifying the HTTP
  methods the head will match. It defaults to `*`, meaning it matches
  every method, but can be set to a specific method like `GET` or
  `OPTIONS`, or to an array of accepted methods (eg. `["GET",
  "OPTIONS"]`).
* `hostname` (optional): a *string* with a regular expression matching
  the hostnames this head should handle (by default, `.*`). It matches
  the `Host` header of the incoming request, although it will not
  contain the port, just the hostname itself (eg. if a request that
  has a `Host` header set to `localhost:3000`, the head will check if
  its `hostname` regular expression matches `localhost`).
* `handler`: a *function* that receives three parameters: `req`, `res`
  and `next`. This function will be called for every request the head
  has to handle (it's not enough that the URL path in the request
  matches the `path` property, because there could be another head
  before handling the request --see the introduction in this
  page). This function must always call `res.end()` to end the
  request, either explicitly or implicitly (eg. by passing the `res`
  object to the `next` function).
* `detached` (optional): a *boolean* specifying if the head should be
  detached when starting RoboHydra. If this is true, RoboHydra will
  behave as if the head wasn't there. Heads can be detached and
  re-attached from the RoboHydra admin interface.

Apart from a normal regular expression, the path string supports the
special syntax `:foobar` that matches any URL path fragment (eg. the
path `/articles/:id` would match `/articles/123`,
`/articles/title-of-the-article` and so on, but not
`/articles/view/123`). See the documentation for the [request
object](../api/classes/Request.html) to see how to access these
parameters.

**NOTE:** parameters `name`, `method` and `detached` are implicitly
part of all heads, regardless of type.


### The next function
In some circumstances, heads might want to call other heads below
it. The main use cases for doing this are:

1. Tweaking the request before it's processed by another head.
2. Inspecting or tweaking the response of another head before sending
to the client.

This is akin to a very simple middleware system. In order to call
other heads, the `handler` function receives a third parameter,
`next`. This third parameter is a function that receives two
parameters (request and response objects). This function, when called,
will try to dispatch the given request object with any heads below the
current one. Naturally, this processing will end up with a call to the
`end` function in the response object passed to it.

The head calling the `next` function (let's call it the "middleware
head") can decide what is being passed as request and response
objects. Often you will just pass the middleware head's request and
response objects themselves, possibly after modifying them; but
sometimes you will want to pass mock requests and responses. For
example, passing a mock response object will allow you to inspect its
contents before you decide if you pass that response as is (by using
the `forward` method), tweak the response before sending
(eg. modifying it before calling `forward`), retry the request with a
different URL if you didn't like the response, etc.


Examples
--------

This is a simple head that echoes back some of the information from
the original request (eg. for debugging purposes). It illustrates how
to access different request data:

{% highlight javascript %}
new RoboHydraHead({
    path: '/.*',
    handler: function(req, res) {
        res.headers['content-type'] = 'text/plain';
        res.write("URL: " + req.url + "\n");
        res.write("Method: " + req.method + "\n");
        res.write("Query params:\n");
        for (var qParam in req.queryParams) {
            res.write("  " + qParam + ": " + req.queryParams[qParam] + "\n");
        }
        res.write("POST params:\n");
        for (var bParam in req.bodyParams) {
            res.write("  " + bParam + ": " + req.bodyParams[bParam] + "\n");
        }
        res.write("Headers:\n");
        for (var h in req.headers) {
            res.write("  " + h + ": " + req.headers[h] + "\n");
        }
        res.end();
    }
})
{% endhighlight %}

This is another head that never closes the connection:

{% highlight javascript %}
new RoboHydraHead({
    path: '/unfinished',
    handler: function(req, res) {
        // Useful to check, for example, how well timeouts work
        // on the client side
        res.statusCode = 401;
        res.write("Write stuff but never calls end()");
    }
})
{% endhighlight %}

This is another head that sets some headers on the response:

{% highlight javascript %}
new RoboHydraHead({
    path: '/joke',
    handler: function(req, res) {
        res.headers['x-bad-joke'] = "The problem with UDP jokes " +
            "is that you never know if people get them";
        res.send("There's a joke in here, somewhere...");
    }
})
{% endhighlight %}

And this is an example of how to use the `next` function. Say that we
have a head that proxies to the development server. If we place the
following head *before* it, we'll never get 500 pages:

{% highlight javascript %}
new RoboHydraHead({
    path: '/api/.*',
    handler: function(req, res, next) {
        var fakeRes = new Response().on('end', function(evt) {
            // If we got a reply from whatever head
            // handled the request, we serve it
            // normally. If we got code 500, we serve a "Guru
            // Meditation" message instead.
            if (evt.response.statusCode === 500) {
                res.statusCode = 503;
                res.send("Guru Meditation");
            } else {
                res.forward(fakeRes);
            }
        });

        // We could tweak the "req" object before calling "next",
        // but we'll leave it as is in this example
        next(req, fakeRes);
    }
})
{% endhighlight %}

See the [tutorial](../tutorial) for other uses of the `next` function.


Other kinds of heads
--------------------
Apart from the generic RoboHydra head, there are other classes of
heads available. Namely, `RoboHydraHeadStatic`,
`RoboHydraHeadFilesystem`, `RoboHydraHeadProxy`,
`RoboHydraHeadFilter` and `RoboHydraHeadWatchdog`.


### RoboHydraHeadStatic
This head always returns fixed, static content. A head of this class
has the following properties:

* `content` (optional): the content to be sent back for every
  request. This can be a string or a plain Javascript object. While
  this property is optional, either this or `responses` must be
  present.
* `responses` (optional): an array of responses to send to the client
  (round-robin by default, but see `repeatMode`). Each response in the
  array can contain the properties `content`, `contentType` and
  `statusCode`. For each of these properties that is not given, the
  head's property is used instead. While this property is optional,
  either this or `content` must be present.
* `path` (optional): the regular expression matching URL paths to be
  handled by this head. Defaults to `/.*` if not present.
* `contentType` (optional): the value for the `Content-Type` header in
  the response. If not present and content is an object, defaults to
  `application/json`.
* `statusCode` (optional): the status code for the response. By
  default it's 200.
* `repeatMode` (optional): the way RoboHydra will repeat the responses
  when using the `responses` property. By default it's `round-robin`,
  but it can be set to `repeat-last` to make the head repeat the last
  response in the list.

#### Examples

Simple example setting the status code and content:

{% highlight javascript %}
new RoboHydraHeadStatic({
    path: '/api/users/list',
    statusCode: 500,
    content: '(Fake) Internal Server Error'
})
{% endhighlight %}

Another example that round-robins between several responses:

{% highlight javascript %}
new RoboHydraHeadStatic({
    path: '/round',
    responses: [
        {content: "This fakes an unstable server. Hit F5. (200 OK)"},
        {content: "Wait for it... (still 200 OK)"},
        {statusCode: 500,
         content: "I die every third request :'( (this is 500 ISE)"}
    ]
})
{% endhighlight %}


### RoboHydraHeadFilesystem
This head serves files from the filesystem. It has the following
properties:

* `documentRoot`: the root local filesystem path from which to serve
  files.
* `mountPath` (optional): the path to "mount" the head in. This works
  a bit differently than the `path` property in other heads. In this
  case, it's not a regular expression, but a path under which
  everything is considered handled by the head. It defaults to `/`.
* `indexFiles` (optional): the list of files that will be considered
  "index" (ie. if a request comes for a directory, and that
  directory contains one of the index files, the index file is served
  instead). Defaults to `index.html`, `index.htm`, `home.html`,
  `home.htm`. Order matters, first matching file will be used as
  index.
* `fs` (optional): an object that behaves like Node's `fs`
  module. Useful if you need to fake stuff.
* `mime` (optional): an object that behaves like Node's `mime`
  module. Useful if you need to fake stuff.

This head will serve files from the filesystem, taking into account
`If-Modified-Since` request headers and sending correct
`Last-Modified` headers and 304 status codes when necessary. For
example, a head with `documentRoot = /var/www` and `mountPath =
/static` that receives a request to `/static/css/main.css` will try to
serve the file `/var/www/css/main.css`.

#### Examples

This trivial example serves the static files in the local directory
`staticfiles/` for requests to the URL path `/static`, in such a way
that the request `http://localhost:3000/static/foo/bar.css` will serve
the local file `staticfiles/foo/bar.css`. Note how this head uses
`mountPath`, not `path`, and it's a URL path, not a regular
expression:

{% highlight javascript %}
new RoboHydraHeadFilesystem({
    mountPath: '/static',
    documentRoot: 'staticfiles'
})
{% endhighlight %}

This other example uses `README` and `README.md` as possible index
pages, instead of the more common `index.html` and such:

{% highlight javascript %}
new RoboHydraHeadFilesystem({
    mountPath: '/static/css',
    documentRoot: 'build/css',
    indexFiles: ['README', 'README.md']
})
{% endhighlight %}


### RoboHydraHeadProxy
This head reverse-proxies request to another URL. It has the following
properties:

* `proxyTo`: the root URL the requests are going to be proxied to.
* `mountPath` (optional): the path to "mount" the head in. See the
  documentation for `RoboHydraHeadFilesystem`.
* `setHostHeader` (optional): sets the `Host` header to the hostname
  of the proxied URL (`proxyTo` property) in the requests to the
  target URL. Defaults to `true`.
* `httpRequestFunction` (optional): an object that behaves like
  Node's `http.createClient` function. Useful if you need to fake
  stuff.
* `httpsRequestFunction` (optional): an object that behaves like
  Node's `https.createClient` function. Useful if you need to fake
  stuff.

This head will proxy requests to the given `proxyTo` URL.  For
example, a head with `proxyTo = http://github.com/operasoftware` and
`mountPath = /github` that receives a request to `/github/robohydra`
will proxy the request to the URL
`http://github.com/operasoftware/robohydra`.

#### Examples

The first example proxies everything to what is presumably an internal
development server. This is useful for a number of reasons, like (1)
combined with a filesystem head, frontend files can be served from the
local filesystem, while the backend of the development server can be
used; (2) as a logger for the requests that go to the server; or (3)
to use the development server most of the time, but opening the
possibility to override certain URL paths temporarily to do
exploratory testing:

{% highlight javascript %}
new RoboHydraHeadProxy({
    mountPath: '/',
    proxyTo: 'http://develop.example.com/'
})
{% endhighlight %}

Note, however, that those requests will be made with the original host
(ie. probably something like `localhost`). If you want the requests to
be made with `develop.example.com` as a request host, eg. because the
server has several virtual hosts, you can set the `setHostHeader`
property:

{% highlight javascript %}
new RoboHydraHeadProxy({
    mountPath: '/',
    proxyTo: 'http://develop.example.com/',
    setHostHeader: true
})
{% endhighlight %}


### RoboHydraHeadFilter
This head filters a request processed by another head. It has the
following properties:

* `path` (optional): the regular expression matching URL paths to be
  handled by this head. Defaults to `/.*` if not present.
* `filter`: a function receiving a `Buffer` object with the response
  body and returning the filtered response to be sent back to the
  client. The returned value can be either a string or another
  `Buffer` object.

This head will match certain URLs and pass those requests through for
processing by other heads (see the `next` function
documentation). When the response comes back from the next head, the
`RoboHydraHeadFilter` head will take the response body, apply the
given `filter` function (transparently uncompressing and compressing
back if necessary, and also updating the `Content-Length` header, if
present) and send that as a response.

#### Examples

This trivial example shows how to turn the whole response body into
uppercase letters:

{% highlight javascript %}
new RoboHydraHeadFilter({
    name: 'filter',
    path: '/.*',
    filter: function(body) {
        return body.toString().toUpperCase();
    }
}),
{% endhighlight %}

Note that the parameter to the `filter` function is a `Buffer`, so you
can treat binary data, too. Also, if you want to treat it as a string,
you must call the `toString()` method.


### RoboHydraHeadWatchdog
This head acts as a watchdog, looking for requests/responses matching
certain criteria and executing a given action. It has the following
properties:

* `path` (optional): the regular expression matching URL paths to be
  handled by this head. Defaults to `/.*` if not present.
* `watcher`: a function receiving the `Request` and `Response` objects
  for every request. If this function returns true, the `reporter`
  function will be executed.
* `reporter` (optional): a function receiving the `Request` and
  `Response` objects for the requests that make `watcher` return true.

This head will look for "interesting" request/responses (by checking
if the `watcher` function returns true), and when finding one, it will
execute a given action (the `reporter` function; by default, printing
some extra output to the console). Note that both these functions will
receive a special `Response` object that guarantees that its `body`
property is always uncompressed. If you need the original (whether it
was compressed or not), you can check the `rawBody` property.

#### Examples

The first example shows how to set a "watchdog" for requests from a
concrete browser (Opera in this case). By default, when such a request
is found, RoboHydra will print a warning in the console (together with
the server log):

{% highlight javascript %}
new RoboHydraHeadWatchdog({
    path: '/.*',
    watcher: function(req, res) {
        return req.headers['user-agent'].match(/Opera/);
    }
})
{% endhighlight %}

This other example shows how to set a watchdog for requests that
produced a certain kind of response. It also customises what happens
when such a request is received:

{% highlight javascript %}
new RoboHydraHeadWatchdog({
    path: '/.*',
    watcher: function(req, res) {
        return res.body.toString().match(/application/);
    },
    reporter: function(req, res) {
        console.log("XXXXXXXXXXXX Found a request that has 'application' in " +
                        " the response; it was for " + req.url);
    }
})
{% endhighlight %}
