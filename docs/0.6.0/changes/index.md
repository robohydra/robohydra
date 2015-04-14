---
layout: documentation
---

New in 0.6.0
============

This is a summary of the changes between RoboHydra 0.5.1 and RoboHydra
0.6.0. For full details, check the
[ChangeLog](https://raw.github.com/robohydra/robohydra/master/ChangeLog).


### WebSocket support

Finally, RoboHydra gets WebSocket support. There are two new head
types, `RoboHydraWebSocketHead` and `RoboHydraWebSocketHeadProxy`,
that can be used to listen for WebSocket connections.

The first one will give you access to the socket object (which can
eg. be saved in a variable) to send messages or to run some code when
a message is received from the client. The second one proxies all the
data transfer to another URL, allowing you to manipulate the data
before it's proxied.

See the [WebSocket documentation](../websockets) for details.

### Improvements in -I switch

The `-I` command-line switch now accepts a comma-separated list of
paths, instead of just one.

### Improvements in CORS plugin

Now the `Access-Control-Allow-Credentials` header is always set to
true to allow credentials to be passed.

### Deprecation-related changes

The final name for the assertion results is `testResults` (as opposed
to `scenarioResults`, now deprecated). The rationale is that the
assertion results are test results, and are not necessarily related to
scenarios.

Moreover, many old, deprecated names containing "test" to refer to
scenarios have been finally dropped and don't work anymore.
