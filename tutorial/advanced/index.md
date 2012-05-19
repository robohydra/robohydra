---
layout: default
---
If you haven't already, please read the [beginner's
tutorial]({{ site.url }}/tutorial) first.

Chaining
--------

If you look at the filenames for the static files we have copied into
our `fake-assets` folder (see the DuckDuckGo example in the basic
tutorial), you'll notice that they contain a version number. Now say
that we don't want those version numbers in our filenames (eg. because
we want our local files to work even if DuckDuckGo decides to change
their version number). For these situations, Hydra has a simple
solution: chaining. The idea behind chaining is that each request
handler can accept an extra parameter, a function that allows the head
to call any heads below it. As that function can be called with any
request and response objects, you can do interesting things like
tweaking the request being processed (eg. change the URL, add or
remove headers, etc.) or tweaking the response being returned
(eg. change the body or the headers). You could even call the function
several times, to retry a request, combine the responses of several
requests, or whatever else you might need.

In this example, we're simply going to strip the `.vXXX` part of the
filenames inside `assets`, where `XXX` are numbers. To do so, simply
add a new head at the top and tweak the `documentRoot` in the second
head:

      var HydraHeadFilesystem = require("hydra").heads.HydraHeadFilesystem,
          HydraHeadProxy      = require("hydra").heads.HydraHeadProxy,
          HydraHead           = require("hydra").heads.HydraHead;

      exports.getBodyParts = function(conf) {
          return {
              heads: [
                  new HydraHead({
                      path: '/assets/.*',
                      handler: function(req, res, next) {
                          req.url = req.url.replace(new RegExp("\.v[0-9]\+"), "");
                          next(req, res);
                      }
                  }),

                  new HydraHeadFilesystem({
                      basePath: '/assets',
                      documentRoot: 'fake-assets-unversioned'
                  }),

                  new HydraHeadProxy({
                      basePath: '/',
                      proxyTo: 'http://duckduckgo.com'
                  })
              ]
          };
      };


Now, create a new directory `fake-assets-unversioned` with the same
files, but renaming them to `search_dropdown_homepage.png` and
`logo_homepage.normal.png`. Once you have the new files, start Hydra
again with `hydra ddg.conf`. Everything should keep working as before,
and will keep working even if DuckDuckGo changes the version number in
the URLs.

But what about tweaking the response we get from some other head?
That's interesting, too. Let's turn "DuckDuckGo" into "Duck… Duck…
Go!". To do that, we have to create another head before the
`HydraHeadProxy`. This new head will call the proxying head with the
`next` function, but passing a fake response object. Then it will
tweak the body of that response, _then_ return that tweaked
response. It sounds complicated, but the code is simple enough:

      new HydraHead({
          path: '/',
          handler: function(req, res, next) {
              var fakeRes = new Response(
                  function() {
                      this.body = this.body.toString().replace(
                          new RegExp("DuckDuckGo", "g"),
                          "Duck… Duck… Go!"
                      );
                      res.forward(this);
                  }
              );

              // Avoid compressed responses to avoid having to
              // uncompress before processing
              delete req.headers["accept-encoding"];
              next(req, fakeRes);
          }
      }),

The `Response` constructor receives an argument, a function to be
executed when the response ends. We use this function to inspect the
response we got from the other head, tweak it and send our own
response. Also, note how we remove the "Accept-Encoding" header from
the request before proxying it: this is to avoid that the response
comes compressed. We could have also received the normal request and
uncompress it, but this is simpler for this example.


Test suites
-----------

If you're serious about testing your client code, you're probably
going to end up writing a test suite of some sort. Not necessarily
completely automated, but at least you will want an easy way to change
Hydra's behaviour to match each test scenario.

Now, you could do that with everything we have learned up until now:
you could define many heads for the same path and enable or disable
all the relevant heads from the web interface. But that is complex and
tiring, not to mention very error prone. Alas, Hydra has a much better
way to deal with that situation: defining tests. A test consists of a
collection of heads. These heads are active only when the test they
belong to is active (and only one test can be active at any given
time).

Thus, if you need to easily restore a certain behaviour in Hydra, you
can define, in a named test, a collection of heads that define that
behaviour. Then, every time you need to restore that behaviour, you
start the corresponding test.

Let's go back to the first example in the first part of the
tutorial. In it, we made Hydra return certain "search results" in the
`/foo` path. If we're serious about testing that client, we probably
want Hydra to return different things, like no results, a couple of
results or even an internal server error. Let's implement those three
cases as tests. Create a new file `hydra/plugins/search/index.js` with
the following contents:

      var HydraHead           = require("hydra").heads.HydraHead,
          HydraHeadStatic     = require("hydra").heads.HydraHeadStatic,
          Response            = require("hydra").Response;

      exports.getBodyParts = function(conf) {
          return {
              heads: [
                  new HydraHeadStatic({
                      path: '/foo',
                      content: "This is the default behaviour of /foo"
                  }),
                  new HydraHeadStatic({
                      path: '/bar',
                      content: "This is always available, regardless of the current test"
                  })
              ],
              tests: {
                  noResults: {
                      heads: [
                          new HydraHeadStatic({
                              path: '/foo',
                              content: {
                                  "success": true,
                                  "results": []
                              }
                          })
                      ]
                  },

                  twoResults: {
                      heads: [
                          new HydraHeadStatic({
                              path: '/foo',
                              content: {
                                  "success": true,
                                  "results": [
                                      {"url": "http://hydrajs.org",
                                       "title": "Hydra testing tool"},
                                      {"url": "http://en.wikipedia.org/wiki/Hydra",
                                       "title": "Hydra - Wikipedia"}
                                  ]
                              }
                          })
                      ]
                  },

                  serverProblems: {
                      description: "Make a search with any non-empty search term. The client should show some error messaging stating the server couldn't fulfill the request or wasn't available",
                      heads: [
                          new HydraHead({
                              path: '/.*',
                              handler: function(req, res) {
                                  res.statusCode = 500;
                                  res.send("500 - (Synthetic) Internal Server Error");
                              }
                          })
                      ]
                  }
              }
          };
      };

Once saved, create a matching configuration file and start Hydra with
it:

      {"plugins": [{"name": "search", "config": {}}]}

You can see the available tests, which one is active (if any) and
start and stop them in the [test admin
interface](http://localhost:3000/hydra-admin/tests). When starting
Hydra there won't be any active test, so
[`/foo`](http://localhost:3000/foo) will say "This is the default
behaviour of /foo". However, if we go to the test interface and start
any of the tests, we'll have the desired behaviour in `/foo`. Go now
to the test interface and experiment a bit with the results you get
when starting the different tests.

Note how when you start the last test, Hydra will show some
instructions and some expected behaviour (the `instructions` field is
interpreted as Markdown). This can be very handy if you want to build
some kind of acceptance test suite of your client.  And in case you
want to automate the testing of the client, you will also want to
automate the starting/switching of tests in Hydra. In that case,
remember you can start and stop them by making POST requests to
http://localhost:3000/hydra-admin/tests/PLUGIN-NAME/TEST-NAME.


Assertions
----------

If you're preparing a more formal test suite for your project, you may
want to not only check how the client behaves with different responses
from the server, but also if the client requests are well-formed and
correct. Hydra heads can contain assertions that will be counted as
part of the current active test.

Let's say we are still testing the client of that search engine in the
previous section, and we want to make sure we don't have character
encoding problems. Thus, we'll add a test that checks that the client
sent a correctly formed, UTF-8 search string. We can start by adding a
new test, `nonAsciiSearchTerm`, with the following definition:

      exports.getBodyParts = function(conf, modules) {
          var assert = modules.assert;

          return {
              heads: [
                  // ...
              ],
              tests: {
                  // ...

                  nonAsciiSearchTerm: {
                      instructions: "Search for the string 'blåbærsyltetøy'.\n\nYou should _get one search result_ and it should be _displayed correctly_.",
                      heads: [
                          new HydraHead({
                              path: '/foo',
                              handler: function(req, res) {
                                  assert.equal(req.getParams.q,
                                               "blåbærsyltetøy",
                                               Character encoding should be ok");

                                  res.headers['content-type'] =
                                      'application/json; charset=utf-8';
                                  res.send(JSON.stringify({
                                      "success": true,
                                      "results": [{"url":   "http://example.com",
                                                   "title": "Blåbærsyltetøy'r us"}]
                                  }));
                              }
                          })
                      ]
                  }

Note that now the `getBodyParts` function accepts a second parameter,
`modules`. This second parameter is an object with available modules
as its properties. The only module available as of today is `assert`:
an object with all the functions in the standard, [`assert`
module](http://nodejs.org/docs/latest/api/assert.html) from Node. This
version, though, is special for Hydra and allows Hydra to fetch the
results.

Now, if you start the `nonAsciiSearchTerm` test and make a request
with the wrong string, you'll get an empty response and see the test
failure in the [test index
page](http://localhost:3000/hydra-admin/tests). If you send the
correct string, you'll see the one-result response and the test pass
in the test index page. In case you want to access this information in
an automated fashion, you can get the results in JSON format at the
URL
[http://localhost:3000/hydra-admin/tests/results.json](http://localhost:3000/hydra-admin/tests/results.json).

And this is the end of the advanced Hydra tutorial. Now you have
learned about all features and it's just a matter of experimenting and
creating your own plugins.
