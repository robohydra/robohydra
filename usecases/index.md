---
layout: default
---
RoboHydra usecases
==================

RoboHydra can be used in many different ways. It's closer to a "swiss
army knife of client testing" than a very specific testing tool with a
single purpose. Thus, it can be at first hard to tell whether or not
RoboHydra can help you do what you want. The following is a list of
usecases and examples of what RoboHydra can do.

Testsuites
----------

If you have a client server application with a complex client and want
to write a test suite specifically for the client, you can use
RoboHydra for that. There are a couple of reasons why you might want
to use RoboHydra instead of a real server in a test suite: often,
interesting test cases are not easy to reproduce with a real server
(eg. semi-broken data or combinations of server data that are
time-consuming to set up), it might be costly or simply inconvenient
to set up a real server (eg. you want front-end developers to execute
the test suite, but they work on a different platform; or you need too
many server resources to run the real thing in Continuous
Integration), or you may prefer not to hammer the server with your
tests if the API you're using is provided by someone else.

So, let's say you build a client of the [Opera Link
API](http://dev.opera.com/articles/view/introducing-the-opera-link-api/)
and decide to build a test suite for it. The first step would be to
identify what test cases are useful or interesting to test. In this
case, let's assume that what you want is to simulate a user data store
with one Speed Dial and two bookmarks, one of the bookmarks having the
same URL as the Speed Dial. In that case, these two heads would do the
job nicely:

    tests: {
        duplicateUrlInSpeeddialAndBookmark: {
            heads: [
                new RoboHydraHeadStatic({
                    path: '/rest/speeddial/children',
                    // You can pass a Javascript object directly in "content":
                    // it will be converted to JSON
                    content: [
                        {
                            "item_type": "speeddial",
                            "id": "1",
                            "properties": {
                                "reload_interval": "2147483646",
                                "title": "Opera Portal beta",
                                "uri": "http://redir.opera.com/speeddials/portal/",
                                "reload_only_if_expired": "0",
                                "reload_enabled": "0"
                            }
                        }
                    ]
                }),

                new RoboHydraHeadStatic({
                    path: '/rest/bookmark/children',
                    content: [
                        {
                            "item_type": "bookmark",
                            "id": "319A38DB4581426DA48CAB58C2528FD4",
                            "properties": {
                                "created": "2010-08-18T12:59:13Z",
                                "uri": "http://opera.com",
                                "title": "My first API bookmark"
                            }
                        },
                        {
                            "item_type": "bookmark",
                            "id": "419A38DB4581426DA48CAB58C2528FD5",
                            "properties": {
                                "created": "2010-08-18T12:59:13Z",
                                "title": "My first API bookmark",
                                "uri": "http://redir.opera.com/speeddials/portal/"
                            }
                        }
                    ]
                })
            ]
        },

        // ... Other tests ...
    }

Once you have your test defined, you can go to the [test admin
interface](http://localhost:3000/robohydra-admin/tests) and activate
each test before starting it. Note that if your client was web-based
and you were automating your tests with something like Selenium, you
could easily change the current test by sending a POST request to a
URL like
[http://localhost:3000/robohydra-admin/tests/operalink-client-testsuite/duplicateUrlInSpeeddialAndBookmark](http://localhost:3000/robohydra-admin/tests/operalink-client-testsuite/duplicateUrlInSpeeddialAndBookmark)
before every test (where "operalink-client-testsuite" in that URL
would be the name of the plugin containing the test).


Exploratory testing
-------------------

Maybe you're not interested in building a "formal" test suite for your
client, but would like to be able to reproduce certain situations
easily. For this example, imagine you're implementing a client for
some API that specifies that, in order to allow for future extensions,
all clients must ignore any attributes they don't understand. As a
tester, it would be great to be able to test that easily and reliably
(something the server will never return).

One possibility would be to use RoboHydra as a proxy, and create heads
dynamically using the [admin
interface](http://localhost:3000/robohydra-admin) whenever you want to
try something special that needs a specific response from the
server. When you're done with the test you can detach the head from
the RoboHydra and everything will go back to a regular proxy.


Testing race conditions
-----------------------

Even if your "testing" doesn't need any support, RoboHydra might come
in handy to reliably reproduce hard-to-track bugs like race
conditions.  For example, let's say you are building an application
that uses two different servers: one for authentication and another
one to retrieve data from. Usually the authentication server replies
before the client can manage to send the data retrieval request, but
if it doesn't, maybe the client will send the request with an empty or
invalid user name.

RoboHydra allows you to set up this "race condition" in a reliable
way, making the authentication request take a couple of seconds to
respond, or maybe respond with an internal server error or not respond
at all. This usage of RoboHydra might make it trivial to debug and fix
errors that otherwise could take hours, if not days. Not to mention
that once fixed, it would be much easier to verify the fix.

This simple head waits one second before serving requests for the
`/authentication` URL path:

                   new RoboHydraHead({
                       path: '/authentication',
                       handler: function(req, res, next) {
                           setTimeout(function() {
                               next(req, res);
                           }, 1000);
                       }
                   }),

                   // ... head that actually serves the
                   // "/authentication" path (eg. a proxying head) ...


Make your front-end developers' lives easier
--------------------------------------------

Imagine you have a team split into front-end developers and back-end
developers. If it's a hassle for your front-end developers to install
their own development back-end (eg. different platforms, many
dependencies, front-end developers not familiar with the language or
environment you're using for the back-end, etc.), RoboHydra might be
helpful.

One possiblity is to prepare a very simple RoboHydra plugin that
serves the front-end files from the local disk, while all other paths
are proxied. That would allow you to have a single development
backend, but many front-end developers working on their own version of
the front-end files independently of the rest. These two heads might
do the trick:

                   new RoboHydraHeadStatic({
                       mountPath: '/js',
                       documentRoot: 'src/js'
                   }),

                   new RoboHydraHeadProxy({
                       mountPath: '/',
                       proxyTo: 'http://dev.myapp.example.com'
                   }),




* Offline testing by using record and re-play with a proxy

* Investigate issues using logging through a proxy (poor man's
  wireshark) - see examples/plugins/logger
