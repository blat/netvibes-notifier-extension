function editOptions() {
    document.getElementById('sign-in').style.display = 'none';
    var form = document.getElementById('options');
    var options = document.getElementById('dashboards');
    while (options.firstChild) options.removeChild(options.firstChild);
    var current = getSelectedDashboard();
    for (i = 0; i < dashboards.length; i++) {
        var dashboard = dashboards[i];

        var input = document.createElement('input');
        input.setAttribute('type', 'radio');
        input.setAttribute('id', 'dashboard-' + dashboard.pageId);
        input.setAttribute('value', dashboard.pageId);
        input.setAttribute('name', 'dashboard');
        if (current != false && dashboard.pageId == current.pageId) {
            input.setAttribute('checked', 'checked');
        }
        options.appendChild(input);

        var label = document.createElement('label');
        label.setAttribute('for', 'dashboard-' + dashboard.pageId);
        label.innerText = dashboard.title;
        options.appendChild(label);
    }

    form.addEventListener('submit', function(e) {
        e.preventDefault();
        var elements = document.getElementsByName('dashboard');
        for (i = 0; i < elements.length; i++) {
            if (elements[i].checked) {
                localStorage['dashboard'] = elements[i].getAttribute('value');
            }
        }
        showMessage('Saved!', 'success');
        reset();
    });

    document.getElementById('sign-out').addEventListener('click', function(e) {
        e.preventDefault();
        fetch(HOME_URL + '/signout', {
            credentials: 'include'
        }).then(function(res) {
            showMessage('You are signed out!', 'success');
            reset().then(function() {
                signIn();
            });
        });
    });
    form.style.display = 'block';
}

function signIn() {
    document.getElementById('options').style.display = 'none';
    var form = document.getElementById('sign-in');
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        var params = 'email=' + encodeURIComponent(document.getElementById('email').value)
            + '&password=' + encodeURIComponent(document.getElementById('password').value)
            + '&session_only=' + !document.getElementById('remember-me').checked
        fetch(API_URL + '/auth/signin', {
            credentials: 'include',
            method: 'POST',
            body: params,
            headers: {
                'Content-type': 'application/x-www-form-urlencoded'
            },
        })
        .then(function(res) { return res.json(); })
        .then(function(data) {
            if (data.error) {
                showMessage(data.error.message, 'error');
            } else {
                showMessage('You are signed in!', 'success');
                reset().then(function() {
                    editOptions();
                });
            }
        });
    });
    form.style.display = 'block';
}

function showMessage(message, type) {
    var element = document.getElementById('alert');
    element.innerText = message;
    element.className = type;
    element.style.display = 'block';
    setTimeout(function() {
        element.style.display = 'none';
    }, 3000);
}

function init() {
    return getDashboards().then(function(res) {
        if (res) {
            editOptions();
        } else {
            signIn();
        }
    });
}

document.addEventListener("DOMContentLoaded", function(event) {
    init();
});
