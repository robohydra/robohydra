---
layout: default
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


Dispatching requests
--------------------

When RoboHydra receives a new HTTP request, it goes through all active
heads in order. When it finds a head that matches the path of the
incoming request, RoboHydra dispatches the request with that
head. Otherwise, it returns 404.

Note that heads can call heads below them. See the `next` parameter in
the head handling function.


Writing your own plugins
------------------------

Most uses of RoboHydra need writing custom plugins for the behaviour
you want. Writing plugins is easy, as you can use ready-made RoboHydra
heads that do most common operations. See the [tutorial](../tutorial)
to get an idea of what's possible and get started, and below for a
detailed description of the capabilities of each type.

A plugin is a directory-based Node package (ie. you can't have plugins
like `robohydra/plugins/my-plugin.js`, it has to be
`robohydra/plugins/my-plugin/index.js` or similar) that defines the
symbol `getBodyParts`. That symbol must be a function, and that
function will be called when loading the plugin with two parameters:

* `conf`: this is a Javascript object with all configuration properties
  defined in the configuration file and the command-line, *plus* the
  special configuration keys `robohydra` (the `RoboHydra` object
  loading the plugin) and `path` (the full path to the plugin
  directory, although it's also available as `__dirname` under Node).
* `modules`: this is a Javascript object with special modules for the
  plugin to use. Currently there is only one module available,
  `assert`, used for assertions (see "The 'assert' module" below for
  more information).

The `getBodyParts` function must return an object with the following
optional properties (note that for a plugin with zero heads and zero
tests is not valid):

* `heads`: an *array* of `RoboHydraHead` objects.
* `tests`: an *object* with test names as properties, and an object as
  values.


### Defining tests

Tests define interesting scenarios that allow you to reproduce certain
situations or bugs in your clients. They are a collection of heads
that, together, define that scenario. Each test in an object with the
following properties:

* `instructions` (optional): a *string* explaining what are the steps
  to execute the test. If present, it will be shown when activating
  the test in the web interface.
* `heads`: an *array* of heads that will be activated when the test is
  running.


### The "assert" module

The assert module defines all functions in Node's [`assert`
module](http://nodejs.org/docs/latest/api/assert.html). However, there
are two key differences between RoboHydra's assert module and Node's:

1. RoboHydra's assert functions are tied to the RoboHydra server,
allowing RoboHydra to fetch and store the results and present them on
the web interface.

2. RoboHydra's assert functions *won't die* when there's an assert
failure, but instead will return `false`. This is much more useful
because it allows you to easily return a normal response to the client
(the same or different than the response the client would get if the
assertion had passed).


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
  modify the mock response (`this` in the function always points to
  the mock response object), then write data to your own response
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
  won't change again. Thus, it breaks streaming.

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


Taming the RoboHydra programmatically
-------------------------------------

In some situations you will want to access or control the RoboHydra
that loaded the plugin. As the `config` object passed to
`getBodyParts` function has a reference to it, you can call any
methods to get information or change it: starting tests, loading extra
plugins, detaching or re-attaching heads, injecting extra test
results, sending the test results to another server, or any other
thing you can think of. You could also write your own admin interface
if you wanted to, as the stock admin interface is essentially a normal
plugin (see
[`lib/plugins/admin.js`](https://github.com/operasoftware/robohydra/blob/master/lib/plugins/admin.js)
in the RoboHydra source code).

The following is a list of interesting public RoboHydra API methods
and properties:

* `registerDynamicHead`: receives a single head and
  registers it in RoboHydra (at the end of the `*dynamic-heads*`
  pseudo-plugin).
* `registerPluginObject`: receives a plugin as a parameter
  and registers it in RoboHydra (at the end). A plugin is a Javascript
  object with the following properties:

  * `name`: mandatory, must be made of just ASCII letters, numbers,
  underscores and dashes.
  * `heads`: optional, an array of heads in the plugin.
  * `tests`: optional, a plain object with tests. See `getBodyParts`
  documentation for details.
* `requirePlugin`: It receives a plugin name to load and an object
  with the configuration, and returns an object with two properties:
  `module` (the module loaded through Node) and `config` (the given
  configuration object plus additional properties --currently, the
  `robohydra` property and `path`, the full path to the loaded
  plugin). Normally one would call the `getBodyParts` function in the
  returned `module`, passing the returned `config` and
  `robohydra.getModulesObject()` as parameters; the result of that
  `getBodyParts` call would then be passed to `registerPluginObject`
  after adding a proper `name` for it.
* `getModulesObject`: returns an object with the available modules
  (currently only `assert`).
* `getPlugins`: returns a list of all current plugins, including
  pseudo-plugins.
* `getPluginNames`: returns a list of all current plugin names, including
  pseudo-plugins.
* `getPlugin`: receives one parameter (plugin name) and returns the
  plugin by that name. If there's no registered plugin with the given
  name it throws a `RoboHydraPluginNotFoundException`.
* `headForPath`: given a URL path, it returns the first head that
  matches that URL. If given a head as a second parameter
  (`afterHead`), only heads appearing after `afterHead` will be
  considered.
* `attachHead` / `detachHead`: given a plugin name and a head name,
  they (re-)attach or detach the given head. If no such head exists,
  `RoboHydraHeadNotFoundException` is thrown. If the head was already
  attached/detached, `InvalidRoboHydraHeadStateException` is thrown.
* `addPluginLoadPath`: It adds the given path to the list of paths to
  search for plugins.
* `startTest`: given a plugin name and test name, start the given
  test. If it doesn't exist, throw `InvalidRoboHydraTestException`.
* `stopTest`: stops the current test, if any.
* `currentTest` (property): object with two properties, `plugin` and
  `test`, pointing to the currently running test. If there's no running
  test, it's `*default*` / `*default*`.
* `testResults` (property): object with the current test results. Its
  keys are plugin names and its values are objects with test names as
  keys. The values of the latter objects are test results: objects
  with the keys `result` (`undefined` if the test doesn't have any
  result yet, or `pass` or `fail` if at least one assertion has run
  for that test), `passes` (an array with the description of the
  passing assertions) and `failures` (ditto for failing assertions).
