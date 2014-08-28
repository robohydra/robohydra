---
layout: documentation
---
Custom RoboHydra heads
======================

Sometimes it's useful to have a custom RoboHydra head class for your
needs. In those cases, you can create a new class and manually inherit
from `RoboHydraHead` (or whatever other head you want to base your
class on) or use then `roboHydraHeadType` function.

This function receives a settings object with the following keys:

* `defaultPropertyObject`: The property object used when creating a
  head of this type without specifying any parameters (eg. when
  inheriting from this class).
* `init`: A function to be executed in the constructor. Needed
  sometimes for extra initialization and/or property sanity checks.
* `mandatoryProperties`: Array of mandatory properties. Creating a
  head of this type without any of these properties will result in an
  error.
* `name`: The name of the new type. This is the string that will
  appear in the admin UI head list, under the column "Type".
* `optionalProperties`: Array of optional properties. Each item in the
  array can be a simple string with the name of the property, or an
  object with the keys `name` and (optionally) `defaultValue`. The
  latter is the value to be used if the property is not specified on
  object creation (defaults to `undefined`).
* `parentClass`: The class to inherit from. If not specified,
  `RoboHydraHead` is assumed.
* `parentPropertyBuilder`: A function that calculates the properties
  to be used when calling the parent class' constructor, from the new
  head's properties (available in `this`).
* `reset`: A function that resets the head to its initial state. It's
  normally not needed, but if a head of this type is used in a
  scenario, the `reset()` method (ie. the code passed in this
  property) will be called on each start of the containing scenario.

All of them are optional, but you would normally specify at least a
name, one of the property lists, and `parentPropertyBuilder`.

Example
-------

Say that you're building a mock server for an application that
produces XML responses. These responses look like this:

{% highlight xml %}
<?xml version="1.0" encoding="UTF-8"?>
<friends>
  <friend>
    <name>Friend 1 name</name>
    <email>friend1@example.com</email>
  </friend>
  <friend>
    <name>Friend 2 name</name>
    <email>friend2@example.com</email>
  </friend>
</friends>
{% endhighlight %}

Although you could certainly produce that kind of XML with a
`RoboHydraHeadStatic`, it would be quite a bit of work to maintain
that server. Ideally, you would have a specific RoboHydra head that
outputs that kind of response, so that you could write code like this:

{% highlight javascript %}
new RoboHydraHeadFriendResponse({
    friends: [
        {name: "Friend 1 name",
         email: "friend1@example.com"},
        {name: "Friend 2 name",
         email: "friend2@example.com"}
    ]
})
{% endhighlight %}

Not only it's much faster to both read and write compared to using a
`RoboHydraHeadStatic` directly and spelling out all the XML details:
it's also much easier to maintain, especially if/when you decide to
change the details of the XML formatting. So, our new head class,
`RoboHydraHeadFriendResponse`, could be written like so:

{% highlight javascript %}
var RoboHydraHeadFriendResponse = roboHydraHeadType({
    name: 'friend-response',
    parentClass: heads.RoboHydraHeadStatic,

    mandatoryProperties: ['friends'],
    optionalProperties: [{name: 'path', defaultValue: '/api/friends/list'},
                         {name: 'contentType', defaultValue: 'text/xml'}],
    defaultPropertyObject: {friends: []},

    init: function() {
        if (! util.isArray(this.friends)) {
            throw new InvalidRoboHydraHeadException("The 'friends' property " +
                                                        "must be an array!");
        }
    },

    parentPropertyBuilder: function() {
        var content = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n" +
                "<friends>\n" +
                this.friends.map(function(friend) {
                    return "<friend><name>" + friend.name + "</name>" +
                        "<email>" + friend.email + "</email></friend>";
                }).join("\n") +
                "</friends>";

        return {
            path: this.path,
            contentType: this.contentType,
            content: content
        };
    }
});
{% endhighlight %}

This code could be inside your plugin file, if it's only going to be
used by a single plugin, or you could write a regular Node.js module
and require it from whichever plugins need to use it.
