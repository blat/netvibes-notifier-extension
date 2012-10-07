chrome.browserAction.onClicked.addListener(function() {
    reset();
    openTab();
});
reset();
setInterval(function() { refresh(); }, 2 * 60 * 1000);
