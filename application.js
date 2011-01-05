const API_URL    = 'http://www.netvibes.com/api';
const PW_URL     = 'http://www.netvibes.com/modules/multipleFeeds/providers';
const HOME_URL   = 'http://www.netvibes.com';
const SIGNIN_URL = 'http://www.netvibes.com/signin';

var dashboards = new Array();
var feeds = new Array();
var modules = new Array();
var filter = false;
var home_url = HOME_URL;
var api_url = API_URL;
var waiting = 0;

// Issue #1: Wrong feed ID for some multiple feeds
// Issue #2: Cookies not setted on brand.netvibesbusiness.com || Filters don't work on netvibes.com

function getDashboards(from) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', API_URL + '/my/dashboards?format=json', true);
    xhr.onreadystatechange = function() {
        if (xhr.readyState == 4) {
            switch (xhr.status) {
                case 200:
                    var json = JSON.parse(xhr.responseText);
                    dashboards = new Array();
                    for (var id in json.dashboards) {
                        var dashboard = json.dashboards[id];
                        if (dashboard.access != 'public') {
                            dashboards.push({
                                id: id,
                                title: dashboard.title,
                                name: dashboard.name,
                                brand: dashboard.brand
                            });
                        }
                    }

                    switch (from) {
                        case 'background':
                            getFeeds();
                            break;
                        case 'options':
                            buildForm();
                            break;
                    }
                    break;
                case 403:
                    forbidden();
                    break;
            }
        }
    }
    xhr.send();
}

function getFeeds() {
    var i = 0;
    if (typeof localStorage['dashboard'] != 'undefined') {
        for (i = 0; i < dashboards.length; i++) {
            if (dashboards[i].id == localStorage['dashboard']) {
                break;
            }
        }
    }
    var dashboard = dashboards[i];
    localStorage['dashboard'] = dashboard.id;
    home_url = HOME_URL + '/privatepage/' + dashboard.name;
    api_url = (dashboard.brand && filter) ? 'http://' + dashboard.brand + '.netvibesbusiness.com/api' : API_URL;

    var xhr = new XMLHttpRequest();
    xhr.open('GET', API_URL + '/my/widgets/' + dashboard.id + '?format=json', true);
    xhr.onreadystatechange = function() {
        if (xhr.readyState == 4) {
            switch (xhr.status) {
                case 200:
                    var json = JSON.parse(xhr.responseText);
                    feeds = new Array();
                    modules = new Array();
                    var urls = new Array();
                    filter = false;
                    for (var i = 0; i < json.widgets.length; i++) {
                        var widget = json.widgets[i];
                        switch (widget.name) {
                            case 'RssReader':
                                if (typeof(widget.data.feedUrl) != 'undefined' && widget.data.feedUrl.match(/^https?:\/\/\w+@/)) { // secure feed
                                    modules.push(widget.id);
                                } else {
                                    if (typeof(widget.data.feedId) != 'undefined') {
                                        feeds.push(widget.data.feedId);
                                    } else {
                                        urls.push(encodeURIComponent(widget.data.feedUrl));
                                    }
                                }
                                break;
                            case 'MultipleFeeds':
                                switch (widget.data.provider) {
                                    case 'custom': // miso
                                        var url = widget.data.url + '/default.js';
                                        break;
                                    default: // pw
                                        var url = PW_URL + '/' + widget.data.provider + '/' + widget.data.category + '.js';
                                        break;
                                }
                                if (typeof widget.data['list_' + widget.data.category] != 'undefined') {
                                    var list = widget.data['list_' + widget.data.category].split(',');
                                } else {
                                    var list = false;
                                }
                                getMultipleFeeds(url, list);
                                break;
                            case 'SmartTagged': // filter
                                filter = true;
                                feeds.push(widget.data.feedId);
                                break;
                        }
                    }
                    if (urls.length > 0) getFeedIds(urls);
                    else getUnreadCount();
                    break;
                case 403:
                    forbidden();
                    break;
            }
        }
    }
    xhr.send();
}

function getMultipleFeeds(url, list) {
    waiting++;
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.onreadystatechange = function() {
        if (xhr.readyState == 4) {
            switch (xhr.status) {
                case 200:
                    var json = JSON.parse(xhr.responseText);
                    var urls = new Array();
                    for (var i = 0; i < json.length; i++) {
                        var feed = json[i];
                        if (list == false) {
                            urls.push(feed.url);
                        } else {
                            for (var j = 0; j < list.length; j++) {
                                var id = list[j];
                                if (id == feed.id) {
                                    urls.push(encodeURIComponent(feed.url));
                                }
                            }
                        }
                    }
                    waiting--;
                    getFeedIds(urls);
                    break;
            }
        }
    }
    xhr.send();
}

function getFeedIds(urls) {
    waiting++;
    var xhr = new XMLHttpRequest();
    xhr.open('GET', api_url + '/feeds/add?format=json&url[]=' + urls.join('&url[]='), true);
    xhr.onreadystatechange = function() {
        if (xhr.readyState == 4) {
            switch (xhr.status) {
                case 200:
                    var json = JSON.parse(xhr.responseText);
                    for (var url in json.feeds) {
                        feeds.push(json.feeds[url]);
                    }
                    waiting--;
                    getUnreadCount();
                    break;
                }
        }
    }
    xhr.send();
}

function getUnreadCount() {
    if (waiting == 0) {
        if (feeds.length == 0 && modules.length == 0) {
            updateUnreadCount(0);
        } else {
            var xhr = new XMLHttpRequest();
            xhr.open('GET', api_url + '/feeds/info?format=json&feeds=' + feeds.join(',') + '&modules=' + modules.join(','), true);
            xhr.onreadystatechange = function() {
                if (xhr.readyState == 4) {
                    switch (xhr.status) {
                        case 200:
                            var json = JSON.parse(xhr.responseText);
                            var duplicate = false;
                            for (var i = 0; i < json.feeds.length; i++) {
                                var feed = json.feeds[i];
                                if (feed.is_duplicate) {
                                    for (var j = 0; j < feeds.length; j++) {
                                        if (feeds[j] == feed.id) {
                                            feeds[j] = feed.is_duplicate;
                                            duplicate = true;
                                            break;
                                        }
                                    }
                                }
                            }
                            if (duplicate) getUnreadCount();
                            else updateUnreadCount(json.unread_count);
                            break;
                        case 403:
                            forbidden();
                            break;
                    }
                }
            }
            xhr.send();
        }
    }
}

function updateUnreadCount(unread_count) {
    var icon = (parseInt(unread_count) > 0) ? 'icon.png' : 'disabled.png';
    if (unread_count == 0) {
        unread_count = '';
    }
    chrome.browserAction.setBadgeText({text: unread_count.toString()});
    chrome.browserAction.setIcon({path: icon});
}

function refresh() {
    waiting = 0;
    getFeeds();
}

function forbidden() {
    home_url = SIGNIN_URL;
    updateUnreadCount('!');
}

function openTab() {
    chrome.tabs.create({selected: true, url: home_url});
}

function buildForm() {
    document.write('<h1>Netvibes Notifier for Google Chrome</h1>');
    var current = localStorage['dashboard'];
    document.write('<h3>Select your dashboard:</h3>');
    for (var i = 0; i < dashboards.length; i++) {
        var dashboard = dashboards[i];
        if (dashboard.access != 'public') {
            document.write('<input type="radio" id="' + dashboard.id + '" value="' + dashboard.id + '" name="dashboard" ' + (dashboard.id == current ? 'checked="checked"' : '') + '/>');
            document.write('<label for="' + dashboard.id + '">' + dashboard.title + '</label>');
            document.write('<br/>');
        }
    }
    document.write('<p><button id="button" onclick="saveForm()">Save</button></p>');
}

function saveForm() {
    var button = document.getElementsByTagName('button')[0];
    button.innerHTML = 'In progress...';
    button.disabled = true;
    var radio = document.getElementsByName('dashboard');
    for (var i = 0; i < radio.length; i++) {
        if (radio[i].checked) {
            localStorage['dashboard'] = radio[i].value;
        }
    }
    button.innerHTML = 'Saved!';
    button.disabled = false;
    refresh();
    return false;
}
