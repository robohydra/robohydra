Hydra mock server
=================

Hydra is a programmable server written in Node. It's designed to make
mock servers easy to write, so you can test any client applications
that communicate with a server using some kind of HTTP interface.

When you load Hydra, you load certain plugins, and each plugin
describes Hydra heads. Each head has a name, and defines a path and a
handler function that will be executed when a request to the given
path arrives.
