// calendar.js — the calendar widget: a card with events on the front and a
// "choose calendars" list on the back. Tapping the header flips the card.
// ES5-compatible. renderCalendar is called by dashboard.js after each API response.

// How long the settings side may stay open untouched before flipping back on its own.
var CAL_SETTINGS_IDLE_MS = 2 * 60 * 1000;

// State of the settings (back) side.
var _calSettings = {
  calendars: [],     // [{ id, name, color, source, selected, error }]
  dirty:     false,  // true once something was ticked/unticked
  onSaved:   null,   // called after a new choice is saved (refreshes the events)
  idleTimer: null,
};

// calendarXhr — small XHR helper: calls callback(parsedJson) or callback(null) on error.
function calendarXhr(method, url, body, callback) {
  var xhr = new XMLHttpRequest();
  xhr.open(method, url, true);
  if (body) { xhr.setRequestHeader('Content-Type', 'application/json'); }
  xhr.onreadystatechange = function() {
    if (xhr.readyState !== 4) { return; }
    var data = null;
    try { data = JSON.parse(xhr.responseText); } catch (e) { data = null; }
    if (xhr.status >= 200 && xhr.status < 300) {
      callback(data);
    } else {
      console.error('[calendar] HTTP ' + xhr.status + ' for ' + url);
      callback(data && data.error ? data : null);
    }
  };
  xhr.send(body ? JSON.stringify(body) : null);
}

// ------------------------------------------------------------------
// Front side: events
// ------------------------------------------------------------------

// renderCalendarDay — builds one day section: a label and its list of events.
function renderCalendarDay(day) {
  var section = document.createElement('div');
  section.className = 'cal-day';

  var label = document.createElement('div');
  label.className   = 'news-col-label';
  label.textContent = day.label;
  section.appendChild(label);

  var ul = document.createElement('ul');
  ul.className = 'cal-list';

  if (!day.events.length) {
    var empty = document.createElement('li');
    empty.className   = 'cal-empty';
    empty.textContent = 'No events';
    ul.appendChild(empty);
  }

  for (var i = 0; i < day.events.length; i++) {
    var ev = day.events[i];
    var li = document.createElement('li');
    li.className = ev.allDay ? 'cal-event cal-allday' : 'cal-event';

    var time = document.createElement('div');
    time.className   = 'cal-time';
    time.textContent = ev.time;

    var text = document.createElement('div');
    text.className = 'cal-text';

    var title = document.createElement('div');
    title.className   = 'cal-title';
    title.textContent = ev.title;
    text.appendChild(title);

    // Which calendar it came from (e.g. "Max School", "Family"), in that calendar's colour
    if (ev.calendar) {
      var tag = document.createElement('div');
      tag.className   = 'cal-source';
      tag.textContent = ev.calendar;
      if (ev.color) { tag.style.color = ev.color; }
      text.appendChild(tag);
    }

    if (ev.location) {
      var loc = document.createElement('div');
      loc.className   = 'cal-location';
      loc.textContent = ev.location;
      text.appendChild(loc);
    }

    li.appendChild(time);
    li.appendChild(text);
    ul.appendChild(li);
  }

  section.appendChild(ul);
  return section;
}

// renderCalendar — redraws the events side, or shows the error badge
// if data is null or contains an error field (keeps the last good events visible).
function renderCalendar(data) {
  var content = document.getElementById('calendar-content');
  var loading = document.getElementById('calendar-loading');
  var error   = document.getElementById('calendar-error');

  loading.style.display = 'none';

  if (!data || data.error || !data.days) {
    error.style.display = 'block';
    return;
  }

  content.innerHTML = '';
  if (data.calendars && !data.calendars.length) {
    var hint = document.createElement('div');
    hint.className   = 'status-msg';
    hint.textContent = 'No calendars chosen — tap "Calendar" above to pick some.';
    content.appendChild(hint);
  } else {
    for (var i = 0; i < data.days.length; i++) {
      content.appendChild(renderCalendarDay(data.days[i]));
    }
  }

  error.style.display   = 'none';
  content.style.display = '';
}

// ------------------------------------------------------------------
// Back side: choose calendars
// ------------------------------------------------------------------

// setSettingsStatus — shows a short message above the calendar list (empty hides it).
function setSettingsStatus(message, isError) {
  var el = document.getElementById('cal-settings-status');
  el.textContent   = message || '';
  el.className     = isError ? 'error-msg' : 'status-msg';
  el.style.display = message ? '' : 'none';
}

// renderCalendarSettings — draws one tappable row per calendar with a tick when chosen.
function renderCalendarSettings() {
  var ul = document.getElementById('cal-settings-list');
  ul.innerHTML = '';

  var cals = _calSettings.calendars;
  for (var i = 0; i < cals.length; i++) {
    ul.appendChild(buildSettingsRow(cals[i]));
  }
}

// buildSettingsRow — one row: colour dot, name, where it comes from, tick box.
function buildSettingsRow(cal) {
  var li = document.createElement('li');
  li.className = cal.selected ? 'cal-option checked' : 'cal-option';

  var dot = document.createElement('span');
  dot.className = 'cal-option-dot';
  dot.style.backgroundColor = cal.color || '#5a9ad8';

  var text = document.createElement('div');
  text.className = 'cal-option-text';

  var name = document.createElement('div');
  name.className   = 'cal-option-name';
  name.textContent = cal.name;

  var sub = document.createElement('div');
  sub.className   = 'cal-option-sub';
  sub.textContent = cal.error ? ('⚠ ' + cal.error) : (cal.source === 'icloud' ? 'iCloud' : 'Calendar link');

  text.appendChild(name);
  text.appendChild(sub);

  var box = document.createElement('span');
  box.className   = 'cal-option-check';
  box.textContent = '✓';

  li.appendChild(dot);
  li.appendChild(text);
  li.appendChild(box);

  li.addEventListener('click', function() {
    cal.selected = !cal.selected;
    li.className = cal.selected ? 'cal-option checked' : 'cal-option';
    _calSettings.dirty = true;
    resetSettingsIdleTimer();
  });
  return li;
}

// loadCalendarSettings — asks the server for every calendar and fills the back side.
function loadCalendarSettings() {
  _calSettings.calendars = [];
  _calSettings.dirty     = false;
  renderCalendarSettings();
  setSettingsStatus('Loading calendars…', false);

  calendarXhr('GET', '/api/calendar/list', null, function(data) {
    if (!data || data.error || !data.calendars) {
      setSettingsStatus('⚠ Could not load the calendar list' + (data && data.error ? ': ' + data.error : ''), true);
      return;
    }
    _calSettings.calendars = data.calendars;
    renderCalendarSettings();

    if (data.icloud && data.icloud.error) {
      setSettingsStatus('⚠ iCloud: ' + data.icloud.error, true);
    } else if (data.icloud && !data.icloud.configured) {
      setSettingsStatus('iCloud is not connected yet — only calendar links are listed.', false);
    } else if (!data.calendars.length) {
      setSettingsStatus('No calendars found.', false);
    } else {
      setSettingsStatus('', false);
    }
  });
}

// resetSettingsIdleTimer — restarts the countdown that flips the card back automatically.
function resetSettingsIdleTimer() {
  if (_calSettings.idleTimer) { clearTimeout(_calSettings.idleTimer); }
  _calSettings.idleTimer = setTimeout(closeCalendarSettings, CAL_SETTINGS_IDLE_MS);
}

// openCalendarSettings — flips the card to the "choose calendars" side.
function openCalendarSettings() {
  document.getElementById('cal-flipper').className = 'flipped';
  loadCalendarSettings();
  resetSettingsIdleTimer();
}

// closeCalendarSettings — flips back to the events, saving the choice if it changed.
function closeCalendarSettings() {
  if (_calSettings.idleTimer) { clearTimeout(_calSettings.idleTimer); }
  _calSettings.idleTimer = null;
  document.getElementById('cal-flipper').className = '';

  if (!_calSettings.dirty) { return; }
  _calSettings.dirty = false;

  var ids = [];
  for (var i = 0; i < _calSettings.calendars.length; i++) {
    if (_calSettings.calendars[i].selected) { ids.push(_calSettings.calendars[i].id); }
  }
  calendarXhr('POST', '/api/calendar/selection', { ids: ids }, function(data) {
    if (!data || data.error) {
      document.getElementById('calendar-error').style.display = 'block';
      return;
    }
    if (_calSettings.onSaved) { _calSettings.onSaved(); }
  });
}

// initCalendarSettings — wires the header taps; onSaved runs after a new choice is saved.
function initCalendarSettings(onSaved) {
  _calSettings.onSaved = onSaved;
  document.getElementById('cal-front-header').addEventListener('click', openCalendarSettings);
  document.getElementById('cal-back-header').addEventListener('click', closeCalendarSettings);
}
