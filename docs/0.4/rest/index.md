---
layout: documentation
---
HTTP REST Interface
===================

Sometimes it's useful to interact with RoboHydra from an external
program. The typical usecase would be setting an appropriate scenario
before running a test and check the results afterwards, but there are
other interesting possibilities. For that reason, RoboHydra offers a
simple REST API to gather information about the loaded plugins and
available heads. It allows allows you to make simple changes
(attach/detach heads and start/stop scenarios).

Format
------

For now, all URLs in the API return JSON. They don't pay any attention
to the `Accept` headers. See each URL for specific examples.

Plugins
-------

    http://localhost:3000/robohydra-admin/rest/plugins

This call gives you the list of loaded plugins, together the full
information for each plugin's heads and scenarios. Example output
(reformatted for readability):

{% highlight json %}
{
    "plugins": [
        {
            "heads": [],
            "name": "logger",
            "scenarios": []
        },
        {
            "name": "simple-i18n",
            "heads": [
                {
                    "attached": true,
                    "name": "language-detection",
                    "plugin": "simple-i18n"
                },
                {
                    "attached": true,
                    "name": "plain-fileserver",
                    "plugin": "simple-i18n"
                }
            ],
            "scenarios": [
                {
                    "plugin": "simple-18n",
                    "name": "simple",
                    "active": false
                }
            ]
        }
    ]
}
{% endhighlight %}

Single plugin
-------------

    http://localhost:3000/robohydra-admin/rest/plugins/<PLUGINNAME>

This call gives you the information (heads and scenarios) for the
given plugin. Example output (reformatted for readability):

{% highlight json %}
{
    "name": "simple-i18n",
    "heads": [
        {
            "attached": true,
            "name": "language-detection",
            "plugin": "simple-i18n"
        },
        {
            "attached": true,
            "name": "plain-fileserver",
            "plugin": "simple-i18n"
        }
    ],
    "scenarios": [
        {
            "attached": true,
            "name": "language-detection",
            "plugin": "simple-i18n"
        }
    ]
}
{% endhighlight %}

Single head
-----------

    http://localhost:3000/robohydra-admin/rest/plugins/<PLUGINNAME>/heads/<HEADNAME>

This call gives you the information for the given head. Example output
(reformatted for readability):

{% highlight json %}
{
    "attached": true,
    "name": "language-detection",
    "plugin": "simple-i18n"
}
{% endhighlight %}

You can also detach/reattach a head by sending a POST request to that
URL with the new value for the `attached` property, form-encoded. Eg.:

    $ curl -X POST -d "attached=false" http://localhost:3000/robohydra-admin/rest/plugins/foo/heads/bar
    {"plugin":"foo","name":"bar","attached":false}

Single scenario
---------------

    http://localhost:3000/robohydra-admin/rest/plugins/<PLUGINNAME>/scenarios/<SCENARIONAME>

This call gives you the information for the given scenario. Example
output (reformatted for readability):

{% highlight json %}
{
    "plugin": "simple-18n",
    "name": "simple",
    "active": false
}
{% endhighlight %}

You can also start/stop a scenario by sending a POST request to that
URL with the new value for the `active` property, form-encoded. Eg.:

    $ curl -X POST -d "active=true" http://localhost:3000/robohydra-admin/rest/plugins/foo/scenarios/testScenario
    {"plugin":"foo","scenario":"testScenario","active":true}


Test results
------------

    http://localhost:3000/robohydra-admin/rest/test-results

This call gives the current assertion results for every
scenario. Normally a test will be considered passed if there's at
least one assertion in the "passes" list and no assertions in the
"failures" list. Example output (reformatted for readability):

{% highlight json %}
{
    "*default*": {
        "*default*": {
            "passes": [],
            "failures": []
        }
    },

    "simple-i18n": {
        "basic": {
            "passes": [
                "Should serve the right page",
                "Should favour matching specific country variants"
            ],
            "failures": [
                "Should serve pages with the right headers"
            ]
        }
    }
}
{% endhighlight %}
