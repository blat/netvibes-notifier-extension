function buildForm() {
    var wrapper = $('#wrapper').empty().append($('<h3>').text('Select your dashboard:'));
    var current = getSelectedDashboard();
    $.each(dashboards, function(id, dashboard) {
        wrapper.append(
            $('<input>', {type: 'radio', id: 'dashboard-' + id, value: id, name: 'dashboard', checked: (current != false && id == current.pageId ? 'checked' : '')})
        ).append(
            $('<label>', {for: 'dashboard-' + id}).text(dashboard.title)
        );
    });
    wrapper.append(
        $('<button>', {id: 'save-button'}).text('Save').click(saveForm)
    );
}

function saveForm() {
    var button = $('#save-button')
        .attr({disabled: 'disabled'}).text('In progress...');
    localStorage['dashboard'] = $('input[type=radio][name=dashboard]:checked')[0].value;
    button.attr({disabled: ''}).text('Saved!');
    refresh();
    return false;
}

function signIn() {
    $('#wrapper').empty().append($('<p>').html('<strong>Error:</strong> You have to <a href="' + HOME_URL + '/signin">sign-in</a> before.'));
}

function init() {
    getDashboards(buildForm, signIn);
}

$(function() {
    init();
});