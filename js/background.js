chrome.browserAction.onClicked.addListener(function() {
    reset().then(function() {
        openTab();
    });
});
reset();
setInterval(function() {
    refresh();
}, 120 * 1000);
