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
 * Number of ajax requests in progress.
 * Use to get unread count only when all data is loaded (= all URLs converted in feed ID).
 */
var waiting = 0;

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
function getDashboards(callback) {
    $.getJSON(API_URL + '/my/dashboards', {format: 'json'}, function(data) {
        dashboards = new Array();
        $.each(data.dashboards, function(id, dashboard) {
            if (dashboard.access != 'public' && !dashboard.brand) {
                dashboards.push({
                    id: id,
                    title: dashboard.title,
                    name: dashboard.name
                });
            }
        });
        callback();
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
    $.getJSON(API_URL + '/my/widgets/' + getSelectedDashboard().id, {format: 'json'}, function(data) {
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
                    } else { // Else, get the ID or the URL.
                        if (widget.data.feedId) {
                            feeds.push(widget.data.feedId);
                        } else {
                            urls.push(encodeURIComponent(widget.data.feedUrl));
                        }
                    }
                    break;
                case 'MultipleFeeds':
                    switch (widget.data.provider) {
                        case 'custom':
                            var url = widget.data.url + '/default.js'; // Miso: config URL is in data
                            break;
                        default:
                            var url = PW_URL + '/' + widget.data.provider + '/' + widget.data.category + '.js'; // PW: build the config URL with provider and category
                            break;
                    }
                    var list = widget.data['list_' + widget.data.category] ? widget.data['list_' + widget.data.category].split(',') : false; // List of selected tabs
                    getMultipleFeeds(url, list);
                    break;
                /* Doesn't work because need to know the base url of premium dashboard
                case 'SmartTagged':
                    feeds.push(widget.data.feedId);
                    break;
                */
            }
        });
        if (urls.length > 0) getFeedIds(urls);
        else getUnreadCount();
    });
}

/**
 * Get URLs of feeds contains in a multiple feeds.
 *
 * @param string url The url of config file
 * @param array list List of feeds enabled in the multiple feeds
 *
 * @return void
 */
function getMultipleFeeds(url, list) {
    waiting++;
    $.getJSON(url, function(data) {
        var urls = new Array();
        $.each(data, function(url, feed) {
            if (!list || list.indexOf(feed.id.toString()) >= 0) {
                urls.push(feed.url);
            }
        });
        waiting--;
        getFeedIds(urls);
    });
}

/**
 * Convert URLs into feed IDs.
 *
 * @params array urls List of URLs
 *
 * @return void
 */
function getFeedIds(urls) {
    waiting++;
    $.getJSON(API_URL + '/feeds/add', {format: 'json', url: urls}, function(data) {
        $.each(data.feeds, function(url, id) {
            feeds.push(id);
        });
        waiting--;
        getUnreadCount();
    });
}

/**
 * Get unread count from list of feed IDs and/or module IDs.
 *
 * @return void
 */
function getUnreadCount() {
    if (waiting == 0) {
        if (feeds.length == 0 && modules.length == 0) {
            updateUnreadCount(0);
        } else {
            $.getJSON(API_URL + '/feeds/info', {format: 'json', feeds: feeds.join(','), modules: modules.join(',')}, function(data) {
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
 * Refresh data.
 * Only feeds, modules and unread count. Not dashboards.
 *
 * @return void
 */
function refresh() {
    waiting = 0;
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
    chrome.tabs.getAllInWindow(null, function(tabs) {
        var founded = false;
        var url = HOME_URL + '/privatepage/' + getSelectedDashboard().name;
        $.each(tabs, function(i, tab) {
            if (!founded && tab.url.match('http://www.netvibes.com/([a-z]{2}$|signin|signup|privatepage/' + getSelectedDashboard().name + ')')) {
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
 * Build options form.
 * This form show list of private and non-branded dashboards
 * and user can choose a dashboard to follow (= see notification).
 *
 * @return void
 */
function buildForm() {
    var wrapper = $('#wrapper').empty()
        .append($('<img>', {src: 'icon.png'}))
        .append($('<h1>').text('Netvibes Notifier'))
        .append($('<h3>').text('Select your dashboard:'));
    $.each(dashboards, function(i, dashboard) {
        wrapper.append(
            $('<input>', {type: 'radio', id: 'dashboard-' + dashboard.id, value: dashboard.id, name: 'dashboard', checked: (dashboard.id == getSelectedDashboard().id ? 'checked' : '')})
        ).append(
            $('<label>', {for: 'dashboard-' + dashboard.id}).text(dashboard.title)
        );
    });
    wrapper.append(
        $('<button>', {id: 'save-button'}).text('Save').click(saveForm)
    );
}

/**
 * Save options form.
 * Set the choosen dashboard into local storage.
 *
 * @return void
 */
function saveForm() {
    var button = $('#save-button')
        .attr({disabled: 'disabled'}).text('In progress...');
    localStorage['dashboard'] = $('input[type=radio][name=dashboard]:checked')[0].value;
    button.attr({disabled: ''}).text('Saved!');
    refresh();
    return false;
}
