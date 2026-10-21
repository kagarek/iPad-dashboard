// lib/icloud.js — minimal iCloud CalDAV client.
// Signs in with an Apple ID + app-specific password, lists the account's calendars
// and downloads the raw iCal events of one calendar for a date range.

'use strict';

var fetch  = require('node-fetch');
var xml2js = require('xml2js');
var config = require('../config/settings');

var MAX_REDIRECTS = 5;

// Discovered once per server run: the URL that holds all of this account's calendars.
var calendarHomeUrl = null;

var xmlParser = new xml2js.Parser({
  tagNameProcessors: [xml2js.processors.stripPrefix],
  explicitArray:     true,
});

// isConfigured — true when an Apple ID and app-specific password are set in .env.
function isConfigured() {
  return !!(config.calendar.icloud.username && config.calendar.icloud.appPassword);
}

// authHeader — HTTP Basic auth value for the Apple ID.
function authHeader() {
  var raw = config.calendar.icloud.username + ':' + config.calendar.icloud.appPassword;
  return 'Basic ' + Buffer.from(raw).toString('base64');
}

// davRequest — sends a WebDAV request (PROPFIND / REPORT) and returns { url, body }.
// Follows redirects by hand so the login is only ever sent to icloud.com hosts.
function davRequest(method, url, depth, body, redirectsLeft) {
  if (redirectsLeft === undefined) { redirectsLeft = MAX_REDIRECTS; }

  var host = new URL(url).hostname;
  if (!/(^|\.)icloud\.com$/i.test(host) && host !== new URL(config.calendar.icloud.caldavUrl).hostname) {
    return Promise.reject(new Error('Refusing to send iCloud login to ' + host));
  }

  return fetch(url, {
    method:   method,
    redirect: 'manual',
    headers: {
      'Authorization': authHeader(),
      'Content-Type':  'application/xml; charset=utf-8',
      'Depth':         String(depth),
    },
    body: body,
  }).then(function(response) {
    if (response.status >= 300 && response.status < 400 && response.headers.get('location')) {
      if (redirectsLeft <= 0) { throw new Error('Too many redirects from iCloud'); }
      var next = new URL(response.headers.get('location'), url).toString();
      return davRequest(method, next, depth, body, redirectsLeft - 1);
    }
    if (response.status === 401) {
      throw new Error('iCloud rejected the Apple ID or app-specific password');
    }
    if (response.status !== 207 && (response.status < 200 || response.status >= 300)) {
      throw new Error('iCloud returned HTTP ' + response.status);
    }
    return response.text().then(function(text) {
      return { url: url, body: text };
    });
  });
}

// parseMultistatus — turns a WebDAV XML reply into [{ href, props }] for successful props.
function parseMultistatus(xmlText) {
  return xmlParser.parseStringPromise(xmlText).then(function(doc) {
    var responses = (doc && doc.multistatus && doc.multistatus.response) || [];
    return responses.map(function(resp) {
      var props = {};
      (resp.propstat || []).forEach(function(ps) {
        var status = (ps.status && ps.status[0]) || '';
        if (status.indexOf(' 200') === -1) { return; }
        var prop = (ps.prop && ps.prop[0]) || {};
        Object.keys(prop).forEach(function(k) { props[k] = prop[k][0]; });
      });
      return { href: resp.href && resp.href[0], props: props };
    });
  });
}

// textOf — xml2js gives either a string or { _: text, $: attrs }; return the text.
function textOf(node) {
  if (node === undefined || node === null) { return ''; }
  if (typeof node === 'string') { return node.trim(); }
  return (node._ || '').trim();
}

// hrefOf — reads the <href> inside a property such as current-user-principal.
function hrefOf(node) {
  return node && node.href ? textOf(node.href[0]) : '';
}

// normalizeColor — iCloud colours are "#RRGGBBAA"; iOS 9 Safari only understands "#RRGGBB".
function normalizeColor(color) {
  var m = /^#([0-9a-f]{6})/i.exec(color || '');
  return m ? '#' + m[1] : null;
}

// findCalendarHome — discovers the account's calendar-home URL (two PROPFIND steps).
function findCalendarHome() {
  if (calendarHomeUrl) { return Promise.resolve(calendarHomeUrl); }

  var principalBody =
    '<?xml version="1.0" encoding="utf-8"?>' +
    '<d:propfind xmlns:d="DAV:"><d:prop><d:current-user-principal/></d:prop></d:propfind>';
  var homeBody =
    '<?xml version="1.0" encoding="utf-8"?>' +
    '<d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">' +
    '<d:prop><c:calendar-home-set/></d:prop></d:propfind>';

  return davRequest('PROPFIND', config.calendar.icloud.caldavUrl, 0, principalBody)
    .then(function(res) {
      return parseMultistatus(res.body).then(function(items) {
        var href = items.length ? hrefOf(items[0].props['current-user-principal']) : '';
        if (!href) { throw new Error('iCloud did not return a user principal'); }
        return new URL(href, res.url).toString();
      });
    })
    .then(function(principalUrl) {
      return davRequest('PROPFIND', principalUrl, 0, homeBody).then(function(res) {
        return parseMultistatus(res.body).then(function(items) {
          var href = items.length ? hrefOf(items[0].props['calendar-home-set']) : '';
          if (!href) { throw new Error('iCloud did not return a calendar home'); }
          calendarHomeUrl = new URL(href, res.url).toString();
          return calendarHomeUrl;
        });
      });
    });
}

// listCalendars — returns [{ id, name, color }] for every event calendar in the account.
function listCalendars() {
  var body =
    '<?xml version="1.0" encoding="utf-8"?>' +
    '<d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav" xmlns:a="http://apple.com/ns/ical/">' +
    '<d:prop><d:displayname/><d:resourcetype/><c:supported-calendar-component-set/><a:calendar-color/></d:prop>' +
    '</d:propfind>';

  return findCalendarHome().then(function(homeUrl) {
    return davRequest('PROPFIND', homeUrl, 1, body).then(function(res) {
      return parseMultistatus(res.body).then(function(items) {
        var calendars = [];
        items.forEach(function(item) {
          var type = item.props.resourcetype;
          if (!type || typeof type !== 'object' || !type.calendar) { return; }

          // Skip reminder lists: keep calendars that hold events (VEVENT).
          var compSet = item.props['supported-calendar-component-set'];
          if (compSet && compSet.comp) {
            var hasEvents = compSet.comp.some(function(c) { return c.$ && c.$.name === 'VEVENT'; });
            if (!hasEvents) { return; }
          }

          calendars.push({
            id:    new URL(item.href, res.url).toString(),
            name:  textOf(item.props.displayname) || 'Untitled',
            color: normalizeColor(textOf(item.props['calendar-color'])),
          });
        });
        return calendars;
      });
    });
  });
}

// icalTime — formats a Date as a CalDAV UTC timestamp, e.g. 20261021T000000Z.
function icalTime(date) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

// fetchEvents — downloads the raw iCal text of every event in one calendar that
// touches [from, to). Returns an array of VCALENDAR strings (one per event).
function fetchEvents(calendarUrl, from, to) {
  var body =
    '<?xml version="1.0" encoding="utf-8"?>' +
    '<c:calendar-query xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">' +
    '<d:prop><c:calendar-data/></d:prop>' +
    '<c:filter><c:comp-filter name="VCALENDAR"><c:comp-filter name="VEVENT">' +
    '<c:time-range start="' + icalTime(from) + '" end="' + icalTime(to) + '"/>' +
    '</c:comp-filter></c:comp-filter></c:filter>' +
    '</c:calendar-query>';

  return davRequest('REPORT', calendarUrl, 1, body).then(function(res) {
    return parseMultistatus(res.body).then(function(items) {
      return items
        .map(function(item) { return textOf(item.props['calendar-data']); })
        .filter(Boolean);
    });
  });
}

module.exports = {
  isConfigured:  isConfigured,
  listCalendars: listCalendars,
  fetchEvents:   fetchEvents,
};
