Hydra server
============

Hydra is a testing tool for HTTP-based clients. You connect your
clients to it and it responds with whatever you need for each request.
It can also check the requests received from the clients to help you
build test suites. As its behaviour is easy to change dynamically,
Hydra is ideal for HTTP-based client testing, exploration and general
poking.

It can be used in any HTTP-based client-server architecture, like
Javascript-heavy web application front-ends, clients of HTTP-based
APIs, etc. It helps answering questions like "how would the client
behave when it receives a certain response from the server?", "does
the client send the correct request to the server when certain action
is performed?", "what would happen if this request takes more than
normal to process, or "what would happen if this request gets its
response before this other request?".

A Hydra is composed of "heads", pieces of code that listen in a given
path and trigger a certain behaviour when a request for that path is
received. The behaviour can be checking the incoming request,
returning a static response, serving a file from the file system,
proxy the request to another server, store certain data and return
with a canned response, etc. All these different behaviours can be
combined in powerful ways to achieve the results you need.

Hydra is written in Javascript, runs under Node and is distributed
under the 3-clause BSD license. See LICENSE.md for details.
