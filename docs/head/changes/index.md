---
layout: documentation
---

New in 0.x.x
============

This is a summary of the changes between RoboHydra 0.5.1 and RoboHydra
0.x.x. For full details, check the
[ChangeLog](https://raw.github.com/robohydra/robohydra/master/ChangeLog).


### WebSocket support

Finally, RoboHydra gets WebSocket support. There's a new head type,
`RoboHydraWebSocketHead`, that can be used to listen for WebSocket
connections. Once connected, the socket object can be saved in a
variable and used to send message whenever, or to run some code when a
message is received from the client.

See the [WebSocket documentation](../websockets) for details.

### Improvements in -I switch

The `-I` command-line switch now accepts a comma-separated list of
paths, instead of just one.

### Improvements in CORS plugin

Now the `Access-Control-Allow-Credentials` header is always set to
true to allow credentials to be passed.
