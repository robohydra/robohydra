#!/bin/bash

function t {
    echo -en "* $1 - "
}

function kill_rh {
    kill -INT `ps u | grep robohydra | grep -v grep | awk '{ print $2 }'`
}

function wait_for_server {
    max_times=200
    count=0
    while [ $count -lt $max_times ]; do
        curl http://localhost:${1:-3000} &>/dev/null
        # Return code 7 means "Could not connect"
        if [ "$?" -ne 7 ]; then
            break
        fi

        sleep 0.1
        count=`expr $count + 1`
    done
}

function check {
    path=${1:-/foo}
    port=${2:-3000}
    ( wait_for_server $port && curl http://localhost:$port$path 2>/dev/null || echo -e "\e[31mFAIL\e[39m"; kill_rh ) &
}

function check_connection {
    port=${1:-3000}
    ( wait_for_server $port && curl http://localhost:$port &>/dev/null && echo -e "\e[32mPASS\e[39m" || echo -e "\e[31mFAIL\e[39m"; kill_rh ) &
}

function spin_rh {
    NODE_PATH=../.. ../bin/robohydra.js -q "$@"
}

cd `dirname $0`


t "Empty"
check_connection
spin_rh -n

t "Empty (file)"
check_connection
spin_rh empty.conf

t "Plugin loading"
check
spin_rh -n -P pass,fail

t "Plugin load path order"
check
spin_rh -n -I robohydra/priority-plugins -P precedence

t "Plugin load path order, several directories"
check
spin_rh -n -I robohydra/bad-priority-plugins:robohydra/priority-plugins -P precedence

t "Plugin load path order (file)"
check
spin_rh precedence.conf

t "Plugin load path order (file + command-line)"
check
spin_rh -I robohydra/priority-plugins bad-precedence.conf

t "Setting a port (command-line)"
check /foo 3001
spin_rh -p 3001 -n -P pass

t "Setting a port (file)"
check /foo 3001
spin_rh port.conf

t "Setting a port (file + command-line)"
check /foo 3002
spin_rh -p 3002 port.conf

t "Passing configuration through the command-line"
check
spin_rh vars.conf result=pass

t "Command-line configuration has precedence over configuration file"
check
spin_rh conf.conf result=pass

t "Setting plugin configuration defaults"
check
spin_rh plugin-defaults.conf

t "Command-line configuration has precedence over configuration defaults"
check
spin_rh wrong-plugin-defaults.conf result=pass

t "Default plugin configuration doesn't bleed"
check
spin_rh plugin-defaults-bleeding.conf

t "Specific plugin configuration doesn't overwrite previous plugins' config"
check
spin_rh plugin-defaults-overwriting.conf
