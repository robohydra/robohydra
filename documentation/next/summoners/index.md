---
layout: documentation
---
RoboHydra Summoners
===================

Since 0.4, a single RoboHydra server can support multiple users
simultaneously. In 0.3 and previous versions a RoboHydra server had a
single RoboHydra request dispatcher, and hence could only keep one set
of head states (attached/detached), a single active scenario and so
on.

However, starting from version 0.4, a RoboHydra server can now have
multiple RoboHydra dispatchers, each with its own set of attached
heads, active tests and so on. A RoboHydra _summoner_ is the entity
that decides, for a given request, which RoboHydra dispatcher takes
care of the request.

Let's see an example: say that we have a summoner that chooses the
RoboHydra dispatcher based on a cookie `user` in the incoming
request. That means that when a request contains the cookie `user`
with the value `alice`, the summoner might assign eg. the RoboHydra
dispatcher called "alice", to it. When another request comes,
containing the cookie `user` with the value `bob`, the summoner will
assign a different dispatcher.

The implication of this is that the first user can detach heads, start
scenarios and so on, without affecting the state of the second user's
RoboHydra. This is very useful when you want to have a single
RoboHydra installation (say, in http://common-test-server.example.com)
for your company or team, and have several people use it
simultaneously. This is as opposed to the model you had to use for
older RoboHydras, in which every user would have a local RoboHydra
server in their own machine.

Take into account that the RoboHydra admin interface follows the same
rules, so each user can independently see and manipulate the state of
the heads, etc. from the web UI.

How to use it
-------------

The default summoner will always use the dispatcher "\*default\*", and
thus will behave like older versions of RoboHydra. If you want to
support multiple users, you'll have to first decide how you want to
tell them apart. Cookies work well, but you might want to use headers,
GET parameters or whatever else.

Once you know how you want to tell your users apart, you'll have to
write a plugin that exports a function `getSummonerTraits`. This
function works in a way similar to `getBodyParts`, in which it
receives the configuration and returns an object with (in this case)
the traits of the summoner. The only currently supported summoner
trait is `robohydraPicker`, a function that receives the request
object and returns a string with the name of the RoboHydra dispatcher
to use for that request. A trivial example of such a plugin could be:

    exports.getSummonerTraits = function(config) {
        return {
            robohydraPicker: function(req) {
                if ('user' in req.queryParams) {
                    return req.queryParams.user;
                }
                return "*default*";
            };
        }
    };

If you load a single plugin with a `robohydraPicker` summoner trait,
the server will use this RoboHydra picker function to decide how to
dispatch the different incoming requests.

If you have more than one `robohydraPicker` available, you will have
to use a configuration file a set the `robohydraPickerPlugin` property
in `summoner`, like so:

    {"plugins": ["plugin-with-picker", "another-plugin-with-picker", "moar"],
     "summoner": {"robohydraPickerPlugin": "plugin-with-picker"}}
