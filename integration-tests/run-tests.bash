#!/bin/bash

function p {
    echo -en "* $1 - "
}

function kill_rh {
    kill `ps u | grep robohydra | grep -v grep | awk '{ print $2 }'`
}

function check {
    ( sleep 0.5 && curl http://localhost:${2:-3000}${1:-/foo} 2>/dev/null || echo -e "\e[31mFAIL\e[39m"; kill_rh ) &
}

function check_connection {
    ( sleep 0.5 && curl http://localhost:${1:-3000} &>/dev/null && echo -e "\e[32mPASS\e[39m" || echo -e "\e[31mFAIL\e[39m"; kill_rh ) &
}

RHBIN="../bin/robohydra.js -q"
cd `dirname $0`


p "Empty"
check_connection
$RHBIN -n

p "Empty (file)"
check_connection
$RHBIN empty.conf

p "Plugin loading"
check
$RHBIN -n -P pass,fail

p "Plugin load path order"
check
$RHBIN -n -I robohydra/priority-plugins -P precedence

p "Plugin load path order, several directories"
check
$RHBIN -n -I robohydra/bad-priority-plugins:robohydra/priority-plugins -P precedence

p "Plugin load path order (file)"
check
$RHBIN precedence.conf

p "Plugin load path order (file + command-line)"
check
$RHBIN -I robohydra/priority-plugins bad-precedence.conf

p "Setting a port (command-line)"
check /foo 3001
$RHBIN -p 3001 -n -P pass

p "Setting a port (file)"
check /foo 3001
$RHBIN port.conf

p "Setting a port (file + command-line)"
check /foo 3002
$RHBIN -p 3002 port.conf
