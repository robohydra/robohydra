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
* `handler`: a *function* that receives three parameters: `req`, `res`
  and `next`. This function will be called for every request the head
  has to handle (it's not enough that the URL path in the request
  matches the `path` property, because there could be another head
  before handling the request --see "Dispatching requests"). This
  function must always call `res.end()` to end the request, either
  explicitly or implicitly (eg. by passing the `res` object to the
  `next` function).
* `detached` (optional): a *boolean* specifying if the head should be
  detached when starting RoboHydra. If this is true, RoboHydra will
  behave as if the head wasn't there. Heads can be detached and
  re-attached from the RoboHydra admin interface.

Apart from a normal regular expression, the path string supports the
special syntax `:foobar` that matches any URL path fragment (eg. the
path `/articles/:id` would match `/articles/123`,
`/articles/title-of-the-article` and so on, but not
`/articles/view/123`). See the documentation for the request object,
below, to see how to access these parameters.


### The request object
The first parameter of the handling function is the request
object. This object contains the following properties:

* `method`: the HTTP request method (eg. `GET`, `POST`, ...).
* `url`: the URL path of the incoming request, including GET
  parameters (eg. `/foo`, `/bar/qux`, `/articles?order=date`).
* `headers`: an object with the request headers. These headers are in
  Node-style (ie. lowercased).
* `queryParams`: an object containing the GET parameters for the
  request. It was called `getParams` before, but now that property is
  deprecated.
* `rawBody`: a `Buffer` object with the raw body of the request.
* `bodyParams`: an object containing the body parameters, if the body
  was parseable. Otherwise, `undefined`.
* `params`: an object containing all URL path parameters in the
  request. See below for an explanation.

When defining URL paths, expressions like `:id` or `:user` can be used
as part of the regular expression. These expressions will match any
URL path fragment, and the matched contents will be available in the
`params` object in the request object. For example, if you have a head
for path `/articles/:articleid/view` and you receive a request for
`/articles/introduction-to-robohydra/view`, the request object will
have a `params` property with a single property, `articleid` with
value `introduction-to-robohydra`.

When you use the `next` function in a RoboHydra head (see
documentation below), you sometimes want to modify the request before
sending it further to the next head. You can modify the request in
place before calling `next`, or simply create a new mock request with
the `Request` class. To do the latter, call the constructor with an
object containing the request properties. Valid properties are:

* `url`: the URL path of the request.
* `method`: `GET`, `POST`, etc. defaults to `GET`.
* `headers`: an object with the request headers.
* `rawBody`: a `Buffer` object with the request body, if any.



### The response object
The response object is how you send data back to the client. The
response object has the following API:

* `statusCode`: a property containing the HTTP status code to return
  to the client (by default 200).
* `headers`: an object with the Node-style (lowercase) response
  headers.
* `write`: a method to write content to the body. It accepts a single
  parameter, namely a `Buffer` or string to append to the current
  response body. This method allows a RoboHydra head to write the
  response body in chunks, and the response will be sent in chunks to
  the client (so you could, say, send data, then wait, then send more
  data, wait, then close the connection).
* `end`: a method you must call to end the request.
* `send`: a method to send content to the client. It's a `write` +
  `end`, so you can call `send` with the content to be sent instead of
  calling `write`, then `end`.

When you use the `next` function in a RoboHydra head (see
documentation below), you often want to pass a mock response so you
can inspect or modify it before sending it back to the client. In that
case you will be interested in these other API methods methods:

* `Response` class constructor: It receives one optional parameter,
  the event listener for the `end` event (see the `on` method and
  event documentation below). Here you would typically inspect or
  modify the mock response, then write data to your own response
  object, possibly with the help of the methods below. If you don't
  pass any parameters, you can add your own event listeners with the
  `on` method.
* `on`: It attaches event listeners to the response object. It
  receives an event name (see event list below) and a callback
  function. The callback function will receive a single parameter,
  `event`, an object with the property `type` set to the event type,
  plus different properties according to the event fired. Note that
  you can setup more than one event listener for a single event: in
  that case, all event listeners will be executed.
* `chain`: It connects a response with the given parameter (another
  response) in such a way that all events in the second response will
  be duplicated in the first one. It's intended to be used when
  creating a response. As it replicates all events, it keeps
  streaming. Note that, as you can setup more than one event listener
  for a given event, you can chain a response to another one, then add
  extra event listeners for extra processing or logging.
* `copyFrom`: It receives a response as a parameter and copies the
  data in the parameter to the current response
  (eg. `res.copyFrom(res2)` copies `res2` into `res`). It's intended
  to be used when `res2` is finished and won't change again. Thus, it
  breaks streaming.
* `forward`: It receives a response as a parameter and forwards it as
  if that had been the original response. In other words,
  `res.forward(res2)` is equivalent to `res.copyFrom(res2);
  res.end()`. It's intended to be used when `res2` is finished and
  won't change again. Thus, it breaks streaming. See the `chain` above
  for an alternative that respects streaming.

The list of response object events is:

* `head`: Fired when the header is written. Event objects for this
  event contain two properties, `statusCode` and `headers`.
* `data`: Fired when there is data written in the response
  object. Event objects for this event contain a single property,
  `data`, an instance of `Buffer`.
* `end`: Fired when the response is finished. Event objects for this
  event contain a single property, `response`, the response object
  that fired the event.


### The next function
In some circumstances, heads might want to call other heads below
it. The main use cases for doing this are:

1. Tweaking the request before it's processed by another head.
2. Inspecting or tweaking the response of another head before sending
to the client.

See examples of both in the tutorials. In order to call other heads,
the `handler` function receives a third parameter, `next`, a function
that receives two parameters (request and response objects). This
function, when called, will try to dispatch the given request object
with any heads below the current one. Naturally, this processing will
end up with a call to the `end` function in the response object.

But note that the head calling the `next` function can decide what is
being passed as request and response objects (they need not be the
request and response objects passed to the original head). A common
thing to do is passing a mock response object: when the second head
processes the request, the callback function you passed in the
constructor of the mock response will be called. Thus, you are free to
pass the response as is (by using the `forward` method), tweak the
response before sending (eg. modifying it before calling `forward`),
retry the request with a different URL if you didn't like the
response, etc.


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
  (round-robin). Each response in the array can contain the properties
  `content`, `contentType` and `statusCode`. For each of these
  properties that is not given, the head's property is used
  instead. While this property is optional, either this or `content`
  must be present.
* `path` (optional): the regular expression matching URL paths to be
  handled by this head. Defaults to `/` if not present.
* `contentType` (optional): the value for the `Content-Type` header in
  the response. If not present and content is an object, defaults to
  `application/json`.
* `statusCode` (optional): the status code for the response. By
  default it's 200.


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


### RoboHydraHeadProxy
This head proxies request to another URL. It has the following
properties:

* `proxyTo`: the root URL the requests are going to be proxied to.
* `mountPath` (optional): the path to "mount" the head in. See the
  documentation for `RoboHydraHeadFilesystem`.
* `httpCreateClientFunction` (optional): an object that behaves like
  Node's `http.createClient` function. Useful if you need to fake
  stuff.

This head will proxy requests to the given `proxyTo` URL.  For
example, a head with `proxyTo = http://github.com/operasoftware` and
`mountPath = /github` that receives a request to `/github/robohydra`
will proxy the request to the URL
`http://github.com/operasoftware/robohydra`.


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
