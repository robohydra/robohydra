---
layout: documentation
---
RoboHydra Summoners
===================

What
----

RoboHydra summoners is a way to share a single RoboHydra server
between multiple users.


Why
---

Imagine that you work in some project with some other people. In 0.3
and earlier versions, if you setup a common RoboHydra server (let's
call it `http://common-test-server.example.com`), only one person
would be able to use it at any given time. For example, if Alice opens
up a browser and starts the scenario `intermittentNetworkFailure`,
Bob, that came one minute later, will find that scenario started; if
he starts, say, `mixedCharsets`, Alice will find that suddenly the
RoboHydra server doesn't behave as she wanted it to.


How
---

First of all, let's define a _hydra_ as a collection of heads and
scenarios with their status (attached/detached,
active/inactive). Before RoboHydra 0.4, a RoboHydra server had a
single hydra, and thus if you added a new head or started a scenario,
anyone making requests to the server will see those changes. RoboHydra
0.4 and later allows you to have several hydras in the same server,
and decide which hydras get which requests.

That is, in 0.3 and earlier versions a request was processed like
this:

<figure>
  <img src="/static/img/summoners-0.png" />
  <figcaption>Figure 1: <strong>old</strong> request dispatch
  (RoboHydra 0.3 and earlier)</figcaption>
</figure>

However, now, by default, it's more something like this:

<figure>
  <img src="/static/img/summoners-1.png" />
  <figcaption>Figure 2: default, single user request dispatch
  (RoboHydra 0.4 and newer)</figcaption>
</figure>

The (crucial) difference is that there's no assumption that there's a
single hydra in the server. Now there's a RoboHydra summoner that
looks at the request, then decides which hydra should dispatch it.  A
summoner is simply a Javascript function that computes the id of the
hydra that will process the request. If this is the first request to
that hydra, the hydra will be created transparently. Thus, in the
general case, a request is processed like so:

<figure>
  <img src="/static/img/summoners-2.png" />
  <figcaption>Figure 3: multi-user request dispatch
  (RoboHydra 0.4 and newer)</figcaption>
</figure>

1. A request comes to the server. Let's say that it contains a cookie
   `session=8a40f`.
1. The summoner executes a custom function that returns the value
   `8a40f`. As there's no hydra named `8a40f`, the summoner creates
   it.
1. The new hydra `8a40f` processes the request normally.
1. Later, a second request comes with the cookie `session=25b1c`.
1. The summoner executes the function again, this time with the second
   request as a parameter, and the function returns `25b1c`. As
   there's no hydra with the name `25b1c`, the summoner creates it.
1. The new hydra `25b1c` processes the second request normally. If the
   summoner function had returned `8a40f` for the second request
   (presumably because it also had a session cookie with that value),
   no new hydras would have been created, and the second request would
   have been processed by the already existing hydra `8a40f`.

Take into account that the RoboHydra admin interface follows the same
rules, so each user can independently see and manipulate the state of
the heads, etc. from the web UI.



Usage
-----

The default summoner always returns `*default*`, and thus will always
use the same hydra (see figure 2 above), ie. will behave like older
versions of RoboHydra. If you want to support multiple users, you'll
have to first decide how you want to tell them apart. Cookies work
well, but you might want to use headers, GET parameters or whatever
else.

Once you know how you want to tell your users apart, you'll have to
write a plugin that exports a function `getSummonerTraits`. This
function works in a way similar to `getBodyParts`: it receives the
configuration and returns an object with the traits of the
summoner. The only currently supported summoner trait is
`hydraPicker`, a function that receives the request object and
returns a string with the name of the hydra to use for that request. A
trivial example of such a plugin could be:

{% highlight javascript %}
exports.getBodyParts = function() {
    return {};
};

exports.getSummonerTraits = function() {
    return {
        hydraPicker: function(req) {
            if ('user' in req.queryParams) {
                return req.queryParams.user;
            }
            return "*default*";
        };
    }
};
{% endhighlight %}

If the RoboHydra server loads only one plugin with a `hydraPicker`
summoner trait, it will use this RoboHydra picker function to decide
how to dispatch the different incoming requests. If it has more than
one `hydraPicker` available, you will have to use a configuration
file a set the `hydraPickerPlugin` property in `summoner`. See the
[configuration section](../configuration) for more information.


Full example
------------

Say that we want to have a common RoboHydra server for everyone
working on a given project, and we decide that each user will have to
"login" to the server so that RoboHydra can tell the different users
apart. This login mechanism won't have any password, which is ok
because our users don't have any incentive to pretend they are other
users.

First we have to create the login mechanism. It will be a single head
serving the login form and setting a cookie when the username is
received:

{% highlight javascript %}
var heads         = require("robohydra").heads,
    RoboHydraHead = heads.RoboHydraHead;
var cookie = require("cookie");

exports.getBodyParts = function() {
    return {
        heads: [
            new RoboHydraHead({
                name: 'loginPage',
                path: '/.*',
                handler: function(req, res, next) {
                    if ('login' in req.body) {
                        res.headers['set-cookie'] =
                            cookie.serialize('sessionId', req.body.login);
                        next(req, res);
                        return;
                    }

                    var cookies = cookie.parse(req.headers.cookie || "");
                    if (cookies.sessionId) {
                        next(req, res);
                    } else {
                        res.headers['content-type'] = 'text/html';
                        res.write('Login: <form method="post">');
                        res.write('<input name="login"></form>');
                        res.end();
                    }
                }
            }),

            new RoboHydraHead({
                name: 'content',
                path: '/.*',
                handler: function(req, res) {
                    var cookies = cookie.parse(req.headers.cookie || "");
                    var sessionId = cookies.sessionId || req.body.login;
                    res.send('You are now logged in as ' + sessionId);
                }
            })
        ]
    };
};
{% endhighlight %}

Now we create the custom, cookie-based hydra picker by _adding_ this
code _at the bottom of the file_:

{% highlight javascript %}
exports.getSummonerTraits = function() {
    return {
        hydraPicker: function(req) {
            var cookies = cookie.parse(req.headers.cookie || "");
            return cookies.sessionId || "";
        }
    };
};
{% endhighlight %}

This code would be enough to add a cookie-based summoner and a simple
login form. With this in place, you can add whatever heads or
scenarios you want and have several users use this server without
stepping on each others' toes.
