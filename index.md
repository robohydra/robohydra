---
layout: default
---
Hydra HTTP client test tool
===========================

Hydra is a tool to test any kind of HTTP-based client. It could be a
GUI that uses a public API, a mobile application that communicates
with some server in order to retrieve information, a complex
Javascript front-end application that uses the server mostly as a data
store, or many other things.

In these situations, Hydra allows you to easily make custom "mock"
servers with little effort, be it to build a test suite, easily
reproduce problems while fixing bugs, or to help with exploratory
testing.

Hydra is a web server that is easy to configure (even dynamically!) to
return the responses you want, mimicking any server behaviour needed
to test your clients. Examples of this might be:

* Testing how the client behaves when it receives a certain
combination of valid (but possibly uncommon or hard to reproduce) data.

* Being able to easily reproduce certain race conditions.

* Checking how the client behaves when the server returns Internal
Server Error or invalid data.

* Simulating server connection latency when connecting to a real
server.

Documentation
=============

The documentation is a work in progress. To get started, go read the
[basic tutorial](tutorial) and the more [advanced
tutorial](tutorial/advanced).

Download
========

You can get the [code on
GitHub](https://github.com/operasoftware/hydra), or install Hydra via
NPM with the following command:

    npm install hydra

All this code is released under the 3-clause BSD license, and it's
copyright [Opera Software ASA](http://opera.com).
