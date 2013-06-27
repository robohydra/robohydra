---
layout: documentation
---
HTTP REST Interface
===================

Sometimes it's useful to interact with RoboHydra from an external
program. The typical usecase would be setting an appropriate scenario
before running a test, but there are other, interesting
possibilities. For that reason, RoboHydra offers a simple REST API to
gather information and change the current state (attach/detach heads,
start/stop scenarios).

Format
------

For now, all URLs in the API return always JSON, and don't pay any
attention to the `Accept` headers. See each URL for specific examples.

Plugins
-------

    http://localhost:3000/robohydra-admin/rest/plugins

This call gives you the list of loaded plugins, together the full
information for each plugin's heads and scenarios. Example output
(reformatted for readability):

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

Single plugin
-------------

    http://localhost:3000/robohydra-admin/rest/plugins/<PLUGINNAME>

This call gives you the information (heads and scenarios) for the
given plugin. Example output (reformatted for readability):

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

Single head
-----------

    http://localhost:3000/robohydra-admin/rest/plugins/<PLUGINNAME>/heads/<HEADNAME>

This call gives you the information for the given head. Example output
(reformatted for readability):

    {
        "attached": true,
        "name": "language-detection",
        "plugin": "simple-i18n"
    }

You can also detach/reattach a head by sending a POST request to that
URL with the new value for the `attached` property, form-encoded.

Single scenario
---------------

    http://localhost:3000/robohydra-admin/rest/plugins/<PLUGINNAME>/scenarios/<SCENARIONAME>

This call gives you the information for the given scenario. Example
output (reformatted for readability):

    {
        "plugin": "simple-18n",
        "name": "simple",
        "active": false
    }

You can also start/stop a scenario by sending a POST request to that
URL with the new value for the `active` property, form-encoded.

Test results
------------

    http://localhost:3000/robohydra-admin/rest/test-results

This call gives the current assertion results for every
scenario. Normally a test will be considered passed if there's at
least one assertion in the "passes" list and no assertions in the
"failures" list. Example output (reformatted for readability):

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
