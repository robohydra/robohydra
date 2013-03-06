---
layout: default
---
RoboHydra HTTP client test tool
===============================

RoboHydra is a web server designed to help you test any kind of
HTTP-based client: GUIs that use a public API, mobile applications
that communicate with some server in order to retrieve information,
complex Javascript front-ends that use the server mostly as a data
store, etc.

RoboHydra allows you to easily build custom "mock" servers with little
effort, be it to build a test suite or easily reproduce problems while
fixing bugs. You can even add functionality to your RoboHydra-based
server via its web interface, which is very useful when doing
exploratory testing of your client. All these capabilities can _also_
be combined with proxying in several useful ways.

For more information about the different ways in which you can use
RoboHydra, have a look at the [use cases](usecases) (now includes a
comic!).

Documentation
=============

To get started, go read the [basic tutorial](tutorial) and the more
[advanced tutorial](tutorial/advanced). There are also a number of
screencasts in the [RoboHydra YouTube
channel](http://www.youtube.com/user/robohydra/videos).

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

This code is Copyright 2012-2013 Esteban Manchado Velázquez, and it's
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
