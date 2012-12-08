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
testing. These capabilities can _also_ be combined with proxying in
several useful ways (eg. helping web developers write the front-end
code for a project without the need to install a full backend; see the
[second screencast](http://www.youtube.com/watch?v=dR-XDogJ8b8) for an
example of this).

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
RoboHydra, have a look at the [use cases](usecases) and the
[screencasts](http://www.youtube.com/user/robohydra/videos).

Screencasts
===========

You can see all screencasts in the [RoboHydra YouTube
channel](http://www.youtube.com/user/robohydra/videos). For
more in-depth information see the tutorials and the reference
documentation in the "[Documentation](#documentation)" section below.

This has an introduction to RoboHydra and an example of how to use it
to test a client of a public API
([memegenerator.net](http://version1.api.memegenerator.net/) in this
case):

<iframe width="420" height="315"
src="http://www.youtube.com/embed/ZlCqa0mbd4g" frameborder="0"
allowfullscreen="allowfullscreen">Screencast #1: Intro and public API
client testing</iframe>

This is about using RoboHydra to develop web application front-ends,
and shows how to make a simple plugin from scratch:

<iframe width="420" height="315"
src="http://www.youtube.com/embed/dR-XDogJ8b8" frameborder="0"
allowfullscreen="allowfullscreen">Screencast #2: Using RoboHydra to
develop web application front-ends, writing a simple plugin</iframe>

This one shows the plugins that come with the RoboHydra distribution:
replayer (a plugin to record and replay data from a real server),
logger (a detailed log file generator), and no-caching (removes client
caching headers before processing requests):

<iframe width="420" height="315"
src="http://www.youtube.com/embed/tuEOSoi0RFM" frameborder="0"
allowfullscreen="allowfullscreen">RoboHydra screencast #3: standard
plugins (replayer, logger and no-caching)</iframe>

Documentation
=============

To get started, go read the [basic tutorial](tutorial) and the more
[advanced tutorial](tutorial/advanced). You will also find examples in
the [use cases](usecases) section.

[Dev Opera](http://dev.opera.com) published three articles on
RoboHydra that serve as tutorials for different RoboHydra use cases:

1. [Robohydra: a new testing tool for client-server
interactions](http://dev.opera.com/articles/view/robohydra-a-new-testing-tool-for-client-server-interactions/)
serves as a general introduction and covers how to build a simple
development proxy for front-end developers.

2. [Using RoboHydra as a mock
server](http://dev.opera.com/articles/view/using-robohydra-as-a-mock-server/)
covers how to use RoboHydra to build mock servers that help you
reproduce bugs and build a functional testsuite.

3. [RoboHydra: advanced
techniques](http://dev.opera.com/articles/view/robohydra-advanced-techniques/)
covers advanced techniques that can be applied to any kind of
RoboHydra server.

You also have [reference documentation](documentation) available. The
sources don't have embedded documentation (yet), but most of what you
need is described in the pages above, and the rest you can read in the
[sources](https://github.com/operasoftware/robohydra) themselves
(they're still small and easy to understand).

Download
========

You can get the [code on
GitHub](https://github.com/operasoftware/robohydra), or install
RoboHydra via NPM with the following command:

    npm install robohydra

You can check the
[ChangeLog](https://raw.github.com/operasoftware/robohydra/master/ChangeLog)
for the changes between versions.

Updates
=======

For updates and announcements related to this project, follow
[@robohydra](https://twitter.com/robohydra) on Twitter, watch project
[robohydra on GitHub](https://github.com/operasoftware/robohydra) or
subscribe to the [RoboHydra channel on
YouTube](http://www.youtube.com/user/robohydra/videos).

License and copyright
=====================

This code is Copyright 2012 Esteban Manchado Velázquez, and it's
released under the [Apache 2.0
license](http://www.apache.org/licenses/LICENSE-2.0.txt). Jacob Rask
did all the CSS for the admin interface (and I stole it for this
website). If you knew me you would be able to tell that I hadn't
written that CSS.

This project started at [Opera Software ASA](http://opera.com) as an
internal tool to test some of our projects. Large parts of this code
were (and still are) developed there, but as it's pretty generic we
decided to open source it. See [Opera's GitHub
account](http://github.com/operasoftware) for more open source
goodies.
