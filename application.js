const API_URL    = 'http://www.netvibes.com/api';
const HOME_URL   = 'http://www.netvibes.com';

/**
 * List of private dashboards.
 */
var dashboards = {};

/**
 * Get list of private dashboards.
 *
 * @return void
 */
function getDashboards(callback_success, callback_error) {
    $.getJSON(API_URL + '/my/dashboards', function(data) {
        dashboards = {};
        $.each(data.dashboards, function(id, dashboard) {
            if (dashboard.access == 'private' && dashboard.active) {
                dashboards[id] = dashboard;
            }
        });
    })
    .success(function() { callback_success(); })
    .error(function() { callback_error(); });
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
        $.each(dashboards, function(id, dashboard) {
            if (id == localStorage['dashboard']) {
                current = dashboard;
                localStorage['dashboard'] = id;
            }
        });
    }
    return current;
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
        $.getJSON(API_URL + '/my/streams/' + dashboard.pageId + '/info', function(data) {
            updateUnreadCount(data.unread_count);
        });
    }
}

/**
 * Update unread count.
 * If this count is equal to 0 (= nothing to read),
 * we set black&white icon,
 * else classic Netvibes icon.
 *
 * @params int unread_count Unread count
 */
function updateUnreadCount(unread_count) {
    var icon = (parseInt(unread_count) > 0) ? 'icon.png' : 'disabled.png';
    if (unread_count == 0) {
        unread_count = '';
    }
    chrome.browserAction.setBadgeText({text: unread_count.toString()});
    chrome.browserAction.setIcon({path: icon});
}

/**
 * Reset all data.
 *
 * @return void
 */
function reset() {
    getDashboards(getUnreadCount, error);
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
    var url = HOME_URL + ((dashboard == false) ? '/signin' : '/privatepage/' + dashboard.name);
    chrome.tabs.getAllInWindow(null, function(tabs) {
        var founded = false;
        $.each(tabs, function(i, tab) {
            if (!founded && tab.url.match('http://www.netvibes.com/([a-z]{2}$|signin|signup|privatepage/' + (dashboard.name || '')+ ')')) {
                founded = true;
                var data = {selected: true };
                if (!tab.url.match('^' + url)) {
                    data.url = url;
                }
                chrome.tabs.update(tab.id, data);
            }
        });
        if (!founded) chrome.tabs.create({selected: true, url: url});
    });
}

/**
 * Update notification to show an error occured
 *
 * @return void
 */
function error() {
    var icon = 'disabled.png';
    chrome.browserAction.setBadgeText({text: '?'});
    chrome.browserAction.setIcon({path: icon});
}

