const API_URL    = 'http://www.netvibes.com/api';
const PW_URL     = 'http://www.netvibes.com/modules/multipleFeeds/providers';
const HOME_URL   = 'http://www.netvibes.com';

/**
 * List of private and non-branded dashboards.
 */
var dashboards = new Array();

/**
 * List of feed IDs in the selected dashboard.
 */
var feeds = new Array();

/**
 * List of module IDs (= secure feeds in the selected dashboard).
 */
var modules = new Array();

/**
 * Get list of private dashboards.
 * Skip branded dashboards
 * because we don't know theirs URLs
 * and cookies are not setted on brand.netvibesbusinnes.com
 * and filters don't work on www.netvibes.com,
 * so if tagging is enabled, unread counter is wrong!
 *
 * @return void
 */
function getDashboards(callback_success, callback_error) {
    $.getJSON(API_URL + '/my/account', function(data) {
        username = data.username;
        $.getJSON(API_URL + '/my/dashboards', function(data) {
            dashboards = new Array();
            $.each(data.dashboards, function(id, dashboard) {
                if (dashboard.access != 'public' && !dashboard.premium && (!dashboard.brand || dashboard.brand == 'www' || dashboard.brand == username)) {
                    dashboards.push({
                        id: id,
                        title: dashboard.title,
                        name: dashboard.name
                    });
                }
            });
        })
        .success(function() { callback_success(); })
        .error(function() { callback_error(); });
    })
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
    if (dashboards.length == 0) {
        return false;
    }
    var i = 0;
    if (typeof localStorage['dashboard'] != 'undefined') {
        $.each(dashboards, function(j, dashboard) {
            if (dashboard.id == localStorage['dashboard']) {
                i = j;
            }
        });
    }
    var current = dashboards[i];
    localStorage['dashboard'] = current.id;
    return current;
}

/**
 * Get feeds identified by:
 * - config URL if multiple feeds (miso or PW)
 * - module ID if url contains a login (= secure feed)
 * - ID when it's possible, else url.
 *
 * @return void
 */
function getFeeds() {
    var dashboard = getSelectedDashboard();
    if (dashboard == false) return;
    $.getJSON(API_URL + '/my/widgets/' + dashboard.id, function(data) {
        feeds = new Array();
        modules = new Array();
        var urls = new Array();
        $.each(data.widgets, function(i, widget) {
            switch (widget.name) {
                case 'RssReader':
                    // If there is a login in the URL, it's a secure feed.
                    // Need the module ID instead of the feed ID.
                    if (widget.data.feedUrl && widget.data.feedUrl.match(/^https?:\/\/\w+@/)) {
                        modules.push(widget.id);
                    } else {
                        feeds.push(widget.data.feedId);
                    }
                    break;
                case 'MultipleFeeds':
                    var list = widget.data['list_' + widget.data.category] ? widget.data['list_' + widget.data.category].split(',') : false; // List of selected tabs
                    $.each(widget.feeds, function(i, feed) {
                        if (!list || list.indexOf(feed.id.toString()) >= 0) {
                            feeds.push(feed.feedId);
                        }
                    });
                    break;
                /* Doesn't work because need to know the base url of premium dashboard
                case 'SmartTagged':
                    feeds.push(widget.data.feedId);
                    break;
                */
            }
        });
        getUnreadCount();
    });
}

/**
 * Get unread count from list of feed IDs and/or module IDs.
 *
 * @return void
 */
function getUnreadCount() {
    if (getSelectedDashboard() == false) {
        error();
    } else if (feeds.length == 0 && modules.length == 0) {
        updateUnreadCount(0);
    } else {
        $.getJSON(API_URL + '/feeds/info', {feeds: feeds.join(','), modules: modules.join(',')}, function(data) {
            var duplicate = false;
            $.each(data.feeds, function(i, feed) {
                if (feed.is_duplicate) {
                    var j = feeds.indexOf(feed.id);
                    feeds[j] = feed.is_duplicate;
                    duplicate = true;
                }
            });
            if (duplicate) getUnreadCount();
            else updateUnreadCount(data.unread_count);
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
    getDashboards(getFeeds, error);
}

/**
 * Refresh data.
 * Only feeds, modules and unread count. Not dashboards.
 *
 * @return void
 */
function refresh() {
    getFeeds();
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

