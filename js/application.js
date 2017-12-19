const HOME_URL   = 'https://www.netvibes.com';
const API_URL    = HOME_URL + '/api';

/**
 * Support for Chrome
 */
if (typeof browser == 'undefined') {
    browser = chrome;
}

/**
 * List of private dashboards.
 */
var dashboards = [];
var streamIds = [];

/**
 * Get list of private dashboards.
 *
 * @return void
 */
function getDashboards() {
    return fetch(API_URL + '/dashboards/bootstrap', {
        credentials: 'include',
        method: 'POST',
    })
    .then(function(res) { return res.json(); })
    .then(function(data) {
        if (data.error || !data.bootstrap.App.User) {
            dashboards = [];
            return false;
        } else {
            dashboards = data.bootstrap.App.User.listOfPages;
            if (typeof localStorage['dashboard'] == 'undefined') {
                localStorage['dashboard'] = data.bootstrap.App.User.preferences.openPages;
            }
            return true;
        }
    });
}

/**
 * Get selected dashboard.
 * If local storage is empty or invalid (ID doesn't exist),
 * select the first dashboard.
 *
 * @return object
 */
function getSelectedDashboard() {
    var current = false;
    if (typeof localStorage['dashboard'] != 'undefined') {
        for (var i = 0; i < dashboards.length; i++) {
            var dashboard = dashboards[i];
            if (dashboard.pageId == localStorage['dashboard']) {
                current = dashboard;
                localStorage['dashboard'] = dashboard.pageId;
            }
        }
    }
    return current;
}

/**
 * Get list of streams.
 *
 * @return void
 */
function getStreams() {
    var dashboard = getSelectedDashboard();
    if (dashboard == false) {
        error();
    } else {
        fetch(API_URL + '/my/dashboards/data?pageId=' + dashboard.pageId, {
            credentials: 'include',
            method: 'POST',
        })
        .then(function(res) { return res.json(); })
        .then(function(data) {
            streamIds = [];
            var modules = data.userData.modules;
            for (var i = 0; i < modules.length; i++) {
                var module = modules[i];
                if (typeof(module.streams) != 'undefined') {
                    for (var j = 0; j < module.streams.length; j++) {
                        streamIds.push(module.streams[j]);
                    }
                }
            }
            getUnreadCount();
        });
    }
}

/**
 * Get unread count from list of feed IDs and/or module IDs.
 *
 * @return void
 */
function getUnreadCount() {
    var dashboard = getSelectedDashboard();
    if (dashboard == false) {
        error();
    } else {
        fetch(API_URL + '/streams?pageId=' + dashboard.pageId, {
            credentials: 'include',
            method: 'POST',
            body: JSON.stringify({
                options: {limit: 0},
                streams: streamIds
            }),
            headers: {
                'Content-type': 'application/json'
            },
        })
        .then(function(res) { return res.json(); })
        .then(function(data){
            var count = 0;
            var streams = data.results.streams;
            for (var i = 0; i < streams.length; i++) {
                var stream = streams[i];
                if (typeof(stream.flags) != 'undefined') {
                    count += stream.flags.unread;
                }
            }
            updateUnreadCount(count);
        });
    }
}

/**
 * Update unread count.
 * If this count is equal to 0 (= nothing to read),
 * we set black&white icon,
 * else classic Netvibes icon.
 *
 * @param int unread_count Unread count
 */
function updateUnreadCount(unread_count) {
    var icon = 'img/' + (parseInt(unread_count) > 0 ? 'icon' : 'disabled') + '_64.png';
    if (unread_count == 0) {
        unread_count = '';
    }
    browser.browserAction.setBadgeText({text: unread_count > 1000 ? '1K+' : unread_count.toString()});
    browser.browserAction.setIcon({path: icon});
}

/**
 * Reset all data.
 *
 * @return void
 */
function reset() {
    return getDashboards().then(function(res) {
        if (res) {
            getStreams();
        } else {
            error();
        }
    });
}

/**
 * Refresh data.
 * Only unread count. Not dashboards.
 *
 * @return void
 */
function refresh() {
    getUnreadCount();
}

/**
 * Show the selected Netvibes dashboard.
 * If a tab is already open on Netvibes (welcome page, private dashboard or sign-in/up), use it!
 * Else, open a new tab.
 *
 * @return void
 */
function openTab() {
    var dashboard = getSelectedDashboard();
    var url =  (dashboard == false) ? '/options.html' : HOME_URL + '/dashboard/' + dashboard.name;
    browser.tabs.query({currentWindow: true}, function(tabs) {
        var founded = false;
        for (i = 0; i < tabs.length; i++) {
            var tab = tabs[i];
            if (!founded && tab.url.match(HOME_URL + '/([a-z]{2}$|signin|signup|dashboard/' + (dashboard.name || '')+ ')')) {
                founded = true;
                var data = {active: true };
                if (!tab.url.match('^' + url)) {
                    data.url = url;
                }
                browser.tabs.update(tab.id, data);
            }
        }
        if (!founded) browser.tabs.create({active: true, url: url});
    });
}

/**
 * Update notification to show an error occured
 *
 * @return void
 */
function error() {
    var icon = 'img/disabled.png';
    browser.browserAction.setBadgeText({text: '?'});
    browser.browserAction.setIcon({path: icon});
}
