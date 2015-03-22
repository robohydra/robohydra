---
layout: documentation
---
WebSocket support
=================

Apart from testing clients that use regular HTTP and HTTPS connection,
you can test clients that use WebSockets. This works with heads, as
with HTTP/HTTPS, but WebSocket heads are slightly different.


The basic WebSocket head
------------------------

The basic WebSocket-enabled head is called
`RoboHydraWebSocketHead`. This would be the WebSocket-enabled
equivalent to `RoboHydraHead`. It has the following properties.

* `name` (optional): a *string* with a symbolic name for the head.
* `path`: a *string* with a regular expression matching the paths this
  head should handle. Note that there are implicit "^" and "$" at the
  beginning and end of the string, and that GET parameters are
  stripped from the incoming request before trying to match with this
  regular expression. Also, URL endings are normalised in such a way
  that a head with path `/foo` or `/foo/` will match requests for both
  `/foo` and `/foo/`.
* `hostname` (optional): a *string* with a regular expression matching
  the hostnames this head should handle (by default, `.*`). It matches
  the `Host` header of the incoming request, although it will not
  contain the port, just the hostname itself (eg. if a request that
  has a `Host` header set to `localhost:3000`, the head will check if
  its `hostname` regular expression matches `localhost`).
* `handler`: a *function* that receives two parameters: `req`
  and `socket`. This function will be called for every request the head
  has to handle (it's not enough that the URL path in the request
  matches the `path` property, because there could be another head
  before handling the request --see the introduction in this
  page). This function doesn't have to call any method to signal that
  it's done.
* `detached` (optional): a *boolean* specifying if the head should be
  detached when starting RoboHydra. If this is true, RoboHydra will
  behave as if the head wasn't there. Heads can be detached and
  re-attached from the RoboHydra admin interface.
* `reset` (optional): a *function* that gets executed when the head
  has to be reset (when the scenario it belongs to is started).

See the [documentation for heads](../heads) for details about the path
matching and regular expressions.

The most important bit here is the `handler` function. It works a
little differently than the handler function in `RoboHydraHead`-based
heads: while these receive a request object and a response object and
have to decide when the response is finished (and thus the connection
closed), WebSocket heads simply receive the request object and a
socket object which can be used to write to it whenever, and close it
whenever we want (maybe never!). The socket object has these methods:

* `send`: writes the given parameter (string or `Buffer`) to the
  WebSocket.
* `close`: closes the connection.
* `on`: adds an event handler for the given event (`message` or
  `error`). The first event will fire whenever the client sends a
  message through the WebSocket, and the event handler will be called
  with a single parameter (a string with the message sent). The second
  event will be fired when there's an error (eg. the client closed the
  connection).

Normally, you will want to save the given socket in a variable to use
it afterwards. If you do so, make sure you save it in a variable
_local to the `getBodyParts` function_.

**Note:** As event handling (eg. receiving messages from a WebSocket)
happens outside of the regular request flow, unhandled exceptions
_will_ crash RoboHydra. Be careful and make sure you catch all
exceptions!


### Examples

_To try out any of the following heads you can use the WebSocket client at [`examples/websockets/index.html`](https://github.com/robohydra/robohydra/blob/master/examples/websockets/index.html)._

This is a simple "echo service" WebSocket head. It simply echoes back
whatever is written to the socket:

{% highlight javascript %}
new RoboHydraWebSocketHead({
    path: '/.*',
    handler: function(req, socket) {
        socket.on('message', function(msg) {
            socket.send(msg);
        });
    }
})
{% endhighlight %}

This is another head that closes the connection right away:

{% highlight javascript %}
new RoboHydraWebSocketHead({
    path: '/.*',
    handler: function(req, socket) {
        socket.close();
    }
})
{% endhighlight %}

And finally, this is a plugin that saves the socket for later use and
sends some message every time a different head receives a regular
HTTP request:

{% highlight javascript %}
var heads                  = require("robohydra").heads,
    RoboHydraHead          = heads.RoboHydraHead,
    RoboHydraWebSocketHead = heads.RoboHydraWebSocketHead;

module.exports.getBodyParts = function() {
    var sock;

    return {
        heads: [
            new RoboHydraHead({
                path: '/fake-new-update',
                handler: function(req, res) {
                    var msg = req.queryParams.message || 'Default fake message';

                    if (sock) {
                        sock.send(msg);
                        res.send('Faked new update');
                    } else {
                        res.send('Could not fake update, do not have socket');
                    }
                }
            }),

            new RoboHydraWebSocketHead({
                path: '/.*',
                handler: function(req, socket) {
                    sock = socket;
                }
            })
        ]
    };
};
{% endhighlight %}


RoboHydraWebSocketHeadProxy
---------------------------

Apart from the basic WebSocket-enabled head, there is another one
called `RoboHydraWebSocketHeadProxy`. This is somewhat similar to
`RoboHydraHeadProxy` in that it can proxy WebSocket connections to
another URL, and will send the data back and forth. It has the
following properties:

* `proxyTo`: the root URL the requests are going to be proxied to.
* `mountPath` (optional): the path to "mount" the head in. This works
  a bit differently than the `path` property in other heads. In this
  case, it's not a regular expression, but a path under which
  everything is considered handled by the head. It defaults to `/`.
* `preProcess` (optional): a *function* that will be executed before
  sending client data to the server. The function will receive one
  parameter, namely the data to be sent. If this function returns
  `false`, no data will not be sent at all; if it returns another
  value, that value will be sent instead; if no value is returned, the
  regular value will be sent.
* `postProcess` (optional): a *function* that will be executed before
  sending server data back to the client. The function will receive one
  parameter, namely the data to be sent. If this function returns
  `false`, no data will not be sent at all; if it returns another
  value, that value will be sent instead; if no value is returned, the
  regular value will be sent.
