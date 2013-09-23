---
layout: frontpage
---
RoboHydra HTTP client test tool
===============================

<div class="teaser-pic">
  <a href="/usecases">
    <img src="/static/img/usecases-teaser.png" />
    <figcaption>Read the<br/>use case comics!</figcaption>
  </a>
</div>

RoboHydra is a web server designed to help you test any kind of
HTTP client:

* GUIs that use a public API,
* Mobile applications that communicate with some server,
* Complex Javascript front-ends that use a server as a data store,
* Server applications that contact 3rd party servers,
* And more! See the [use case comics](/usecases) for more information.

RoboHydra allows you to easily build custom "mock" servers with little
effort, be it to build a test suite or to easily reproduce problems
while fixing bugs. RoboHydra also supports exploratory testing by
allowing you to change its behaviour dynamically via its web interface.
Last but not least, RoboHydra can also be used as a proxy, which is
useful in a variety of situations.

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
[@robohydra](https://twitter.com/robohydra) on Twitter, subscribe to
the [development group on Google
Groups](https://groups.google.com/forum/?hl=es&fromgroups#!forum/robohydra),
watch project [robohydra on
GitHub](https://github.com/operasoftware/robohydra) or subscribe to
the [RoboHydra channel on
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
were developed there, but as it's pretty generic we decided to open
source it. See [Opera's GitHub
account](http://github.com/operasoftware) for more open source
goodies.
