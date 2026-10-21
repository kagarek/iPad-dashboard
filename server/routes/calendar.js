// routes/calendar.js — calendar API routes
// GET  /api/calendar            — events of the chosen calendars, grouped by day (today, tomorrow, ...)
// GET  /api/calendar/list       — every available calendar (iCloud account + iCal links) with a "selected" flag
// POST /api/calendar/selection  — saves which calendars to show: body { ids: [...] }
//
// Calendars come from two places:
//   1. the iCloud account (ICLOUD_USERNAME + ICLOUD_APP_PASSWORD), listed via CalDAV
//   2. plain iCal links (CALENDAR_ICS_URLS), e.g. an iCloud "Public Calendar" link
// The chosen calendars are remembered in a small JSON file so they survive restarts.

'use strict';

var fs      = require('fs');
var path    = require('path');
var express = require('express');
var fetch   = require('node-fetch');
var ical    = require('node-ical');
var icloud  = require('../lib/icloud');
var config  = require('../config/settings');

var router = express.Router();

var DAY_MS = 24 * 60 * 60 * 1000;

// Tag colours for iCal links (iCloud calendars bring their own colour).
var LINK_COLORS = ['#5a9ad8', '#d0708a', '#6fbf8a', '#c0a060'];

// Per-URL parsed iCal link cache: { [url]: { data: {...}, fetchedAt: number } }
var feedCache = {};

// iCloud calendar list cache: { calendars: [...], error: string|null, fetchedAt: number }
var icloudListCache = null;

// iCloud events cache: { [calendarId|rangeStart]: { items: [parsed...], fetchedAt: number } }
var icloudEventCache = {};

// toHttps — iCloud shares links as webcal://, which is plain HTTPS underneath.
function toHttps(url) {
  return url.replace(/^webcal:\/\//i, 'https://');
}

// pad — zero-pads a number to two digits.
function pad(n) { return n < 10 ? '0' + n : '' + n; }

// formatTime — returns "HH:MM" in the server's local time.
function formatTime(date) {
  return pad(date.getHours()) + ':' + pad(date.getMinutes());
}

// textValue — node-ical may return a property as a string or as { val, params }.
function textValue(value) {
  if (!value) { return ''; }
  if (typeof value === 'string') { return value; }
  return value.val || '';
}

// isFresh — true when a cache entry is younger than the calendar cache TTL.
function isFresh(entry) {
  return !!entry && (Date.now() - entry.fetchedAt) < config.cache.calendarTtlMs;
}

// ------------------------------------------------------------------
// Selection (which calendars to show), stored in a JSON file
// ------------------------------------------------------------------

// loadSelection — returns the saved list of calendar ids, or null if nothing was saved yet.
function loadSelection() {
  try {
    var saved = JSON.parse(fs.readFileSync(config.calendar.selectionFile, 'utf8'));
    return Array.isArray(saved.ids) ? saved.ids : null;
  } catch (e) {
    return null;
  }
}

// saveSelection — writes the chosen calendar ids to the JSON file.
function saveSelection(ids) {
  fs.mkdirSync(path.dirname(config.calendar.selectionFile), { recursive: true });
  fs.writeFileSync(config.calendar.selectionFile, JSON.stringify({ ids: ids }, null, 2));
}

// isSelected — decides whether a calendar is shown: the saved choice wins; before anything
// is saved, CALENDAR_DEFAULT_SELECTED names are used; if that is empty too, everything shows.
function isSelected(cal, selection) {
  if (selection) {
    return selection.indexOf(cal.id) !== -1;
  }
  var defaults = config.calendar.defaultSelected;
  if (defaults.length) {
    return defaults.some(function(name) { return name.toLowerCase() === cal.name.toLowerCase(); });
  }
  return true;
}

// ------------------------------------------------------------------
// Loading calendars
// ------------------------------------------------------------------

// loadFeed — downloads and parses one iCal link, cached per URL.
function loadFeed(url) {
  if (isFresh(feedCache[url])) {
    return Promise.resolve(feedCache[url].data);
  }
  return fetch(toHttps(url))
    .then(function(response) {
      if (!response.ok) {
        throw new Error('HTTP ' + response.status);
      }
      return response.text();
    })
    .then(function(text) {
      var data = ical.parseICS(text);
      feedCache[url] = { data: data, fetchedAt: Date.now() };
      return data;
    });
}

// listLinkCalendars — describes each iCal link as a calendar; the name comes from the
// feed itself (X-WR-CALNAME). A broken link is still listed so it can be unticked.
function listLinkCalendars() {
  return Promise.all(config.calendar.icsUrls.map(function(url, index) {
    var cal = {
      id:     'link:' + url,
      name:   'Calendar link ' + (index + 1),
      color:  LINK_COLORS[index % LINK_COLORS.length],
      source: 'link',
      url:    url,
    };
    return loadFeed(url)
      .then(function(data) {
        var name = textValue((data.vcalendar || {})['WR-CALNAME']);
        if (name) { cal.name = name; }
        return cal;
      })
      .catch(function(err) {
        console.error('[calendar] link error:', err.message);
        cal.error = err.message;
        return cal;
      });
  }));
}

// listIcloudCalendars — the iCloud account's calendars, cached; never rejects.
// Resolves to { calendars: [...], error: string|null }.
function listIcloudCalendars() {
  if (!icloud.isConfigured()) {
    return Promise.resolve({ calendars: [], error: null });
  }
  if (isFresh(icloudListCache)) {
    return Promise.resolve(icloudListCache);
  }
  return icloud.listCalendars()
    .then(function(list) {
      icloudListCache = {
        calendars: list.map(function(c) {
          return { id: c.id, name: c.name, color: c.color || LINK_COLORS[0], source: 'icloud' };
        }),
        error:     null,
        fetchedAt: Date.now(),
      };
      return icloudListCache;
    })
    .catch(function(err) {
      console.error('[calendar] iCloud error:', err.message);
      // Keep showing the last known list if iCloud has a hiccup.
      if (icloudListCache) {
        return { calendars: icloudListCache.calendars, error: err.message };
      }
      return { calendars: [], error: err.message };
    });
}

// listAllCalendars — iCloud calendars followed by iCal links, each with a "selected" flag.
function listAllCalendars() {
  return Promise.all([listIcloudCalendars(), listLinkCalendars()]).then(function(results) {
    var selection = loadSelection();
    var calendars = results[0].calendars.concat(results[1]);
    calendars.forEach(function(cal) { cal.selected = isSelected(cal, selection); });
    return { calendars: calendars, icloudError: results[0].error };
  });
}

// loadCalendarData — returns parsed iCal objects for one calendar and date range.
function loadCalendarData(cal, from, to) {
  if (cal.source === 'link') {
    return loadFeed(cal.url).then(function(data) { return [data]; });
  }
  var key = cal.id + '|' + from.getTime();
  if (isFresh(icloudEventCache[key])) {
    return Promise.resolve(icloudEventCache[key].items);
  }
  return icloud.fetchEvents(cal.id, from, to).then(function(texts) {
    var items = texts.map(function(text) { return ical.parseICS(text); });
    icloudEventCache[key] = { items: items, fetchedAt: Date.now() };
    return items;
  });
}

// ------------------------------------------------------------------
// Turning events into days
// ------------------------------------------------------------------

// eventsInRange — turns parsed calendar data into a flat list of event instances
// that overlap the [from, to) window, tagged with the calendar's name and colour.
function eventsInRange(data, from, to, cal) {
  var list = [];
  Object.keys(data).forEach(function(key) {
    var event = data[key];
    if (!event || event.type !== 'VEVENT') { return; }
    if (event.status === 'CANCELLED') { return; }

    var instances = ical.expandRecurringEvent(event, {
      from:          from,
      to:            new Date(to.getTime() - 1),
      expandOngoing: true,
    });

    instances.forEach(function(inst) {
      var start = new Date(inst.start.getTime());
      var end   = inst.end ? new Date(inst.end.getTime()) : start;
      if (end <= from && start < from) { return; }
      list.push({
        title:    textValue(inst.summary) || '(no title)',
        location: textValue(inst.event.location),
        start:    start,
        end:      end,
        allDay:   !!inst.isFullDay,
        calendar: cal.name,
        color:    cal.color,
      });
    });
  });
  return list;
}

// buildDays — groups events into one bucket per day, starting today.
// An event spanning several days appears under every day it covers.
function buildDays(events, today, daysAhead) {
  var labels = ['Today', 'Tomorrow'];
  var dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  var days = [];

  for (var d = 0; d < daysAhead; d++) {
    var dayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate() + d);
    var dayEnd   = new Date(today.getFullYear(), today.getMonth(), today.getDate() + d + 1);

    var items = events.filter(function(ev) {
      // Zero-length events count if they start inside the day.
      if (ev.end.getTime() === ev.start.getTime()) {
        return ev.start >= dayStart && ev.start < dayEnd;
      }
      return ev.start < dayEnd && ev.end > dayStart;
    });

    // All-day events first, then by start time.
    items.sort(function(a, b) {
      if (a.allDay !== b.allDay) { return a.allDay ? -1 : 1; }
      return a.start - b.start;
    });

    days.push({
      label: labels[d] || dayNames[dayStart.getDay()],
      date:  dayStart.getFullYear() + '-' + pad(dayStart.getMonth() + 1) + '-' + pad(dayStart.getDate()),
      events: items.map(function(ev) {
        var time;
        if (ev.allDay) {
          time = 'All day';
        } else if (ev.start < dayStart) {
          time = 'until ' + (ev.end < dayEnd ? formatTime(ev.end) : 'all day');
        } else {
          time = formatTime(ev.start) + (ev.end > ev.start && ev.end <= dayEnd ? '–' + formatTime(ev.end) : '');
        }
        return {
          title:    ev.title,
          location: ev.location,
          time:     time,
          allDay:   ev.allDay,
          calendar: ev.calendar,
          color:    ev.color,
          start:    ev.start.getTime(),
          end:      ev.end.getTime(),
        };
      }),
    });
  }
  return days;
}

// ------------------------------------------------------------------
// Routes
// ------------------------------------------------------------------

// GET /api/calendar — events from the chosen calendars.
router.get('/', function(req, res) {
  if (!icloud.isConfigured() && !config.calendar.icsUrls.length) {
    return res.status(503).json({ error: 'No calendar configured (set iCloud login or CALENDAR_ICS_URLS)' });
  }

  var now   = new Date();
  var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  var to    = new Date(today.getTime() + config.calendar.daysAhead * DAY_MS + DAY_MS); // +1 day margin for DST

  listAllCalendars()
    .then(function(result) {
      var chosen = result.calendars.filter(function(cal) { return cal.selected; });

      // A failing calendar logs an error and contributes nothing, so the others still show.
      var failures = 0;
      return Promise.all(chosen.map(function(cal) {
        return loadCalendarData(cal, today, to)
          .then(function(datas) {
            var events = [];
            datas.forEach(function(data) { events = events.concat(eventsInRange(data, today, to, cal)); });
            return events;
          })
          .catch(function(err) {
            failures++;
            console.error('[calendar] could not load "' + cal.name + '":', err.message);
            return [];
          });
      })).then(function(results) {
        if (chosen.length && failures === chosen.length) {
          throw new Error('Could not load any calendar');
        }
        var events = [];
        results.forEach(function(list) { events = events.concat(list); });
        res.json({
          days:       buildDays(events, today, config.calendar.daysAhead),
          calendars:  chosen.map(function(cal) { return cal.name; }),
          updated_at: new Date().toISOString(),
        });
      });
    })
    .catch(function(err) {
      console.error('[calendar] error:', err.message);
      res.status(502).json({ error: err.message });
    });
});

// GET /api/calendar/list — all calendars that can be chosen on the settings side.
router.get('/list', function(req, res) {
  listAllCalendars()
    .then(function(result) {
      res.json({
        calendars: result.calendars.map(function(cal) {
          return {
            id:       cal.id,
            name:     cal.name,
            color:    cal.color,
            source:   cal.source,
            selected: cal.selected,
            error:    cal.error || null,
          };
        }),
        icloud: {
          configured: icloud.isConfigured(),
          error:      result.icloudError,
        },
      });
    })
    .catch(function(err) {
      console.error('[calendar] list error:', err.message);
      res.status(502).json({ error: err.message });
    });
});

// POST /api/calendar/selection — remembers which calendars to show.
router.post('/selection', function(req, res) {
  var ids = req.body && req.body.ids;
  if (!Array.isArray(ids) || !ids.every(function(id) { return typeof id === 'string'; })) {
    return res.status(400).json({ error: 'Expected { ids: [ ...calendar ids ] }' });
  }
  try {
    saveSelection(ids);
  } catch (err) {
    console.error('[calendar] could not save selection:', err.message);
    return res.status(503).json({ error: 'Could not save selection' });
  }
  res.json({ ok: true, ids: ids });
});

module.exports = router;
