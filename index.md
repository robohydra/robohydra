---
layout: default
---
RoboHydra HTTP client test tool
===============================

RoboHydra is a web server designed to help you test any kind of
HTTP-based client. It could be a GUI that uses a public API, a mobile
application that communicates with some server in order to retrieve
information, a complex Javascript front-end application that uses the
server mostly as a data store, or many other things.

In these situations, RoboHydra allows you to easily make custom "mock"
servers with little effort, be it to build a test suite, easily
reproduce problems while fixing bugs, or to help with exploratory
testing.

RoboHydra is easy to configure to return the responses you want,
mimicking any server behaviour needed to test your clients. Examples
of this might be:

* Testing how the client behaves when it receives a certain
combination of valid (but possibly uncommon or cumbersome to
reproduce) data.

* Being able to easily reproduce race conditions.

* Checking how the client behaves when the server returns Internal
Server Error or invalid data.

* Simulating server connection latency when connecting to a real
server.

For more information about the different ways in which you can use
RoboHydra, have a look at the [use cases](usecases).

Documentation
=============

The documentation is a work in progress. To get started, go read the
[basic tutorial](tutorial) and the more [advanced
tutorial](tutorial/advanced). You will also find examples in the
[use cases](usecases) section.

Download
========

You can get the [code on
GitHub](https://github.com/operasoftware/robohydra), or install
RoboHydra via NPM with the following command:

    npm install robohydra

Updates
=======

For updates and announcements related to this project, follow
[@robohydra](https://twitter.com/robohydra) on Twitter or watch
project [robohydra on
GitHub](https://github.com/operasoftware/robohydra).

License and copyright
=====================

This code is Copyright 2012 Esteban Manchado Velázquez, and it's
released under the [Apache 2.0
license](http://www.apache.org/licenses/LICENSE-2.0.txt).

This project started at [Opera Software ASA](http://opera.com) as an
internal tool to test some of our projects. Large parts of this code
were (and still are) developed there, but as it's pretty generic we
decided to open source it. See [Opera's GitHub
account](http://github.com/operasoftware) for more open source
goodies.
