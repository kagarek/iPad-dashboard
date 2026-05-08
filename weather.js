// routes/weather.js — GET /api/weather
// Fetches current weather from OpenWeatherMap and returns simplified JSON.
// Results are cached in memory for CACHE_WEATHER_TTL_MS milliseconds.

'use strict';

var express = require('express');
var fetch   = require('node-fetch');
var config  = require('../config/settings');

var router = express.Router();

// --- In-memory cache ---
var cache = {
  data:      null,
  fetchedAt: 0,
};

// --- Route handler ---
router.get('/', function(req, res) {
  var now = Date.now();

  // Return cached data if still fresh
  if (cache.data && (now - cache.fetchedAt) < config.cache.weatherTtlMs) {
    return res.json(cache.data);
  }

  var url = 'https://api.openweathermap.org/data/2.5/weather'
    + '?q='     + encodeURIComponent(config.weather.city)
    + '&units=' + config.weather.units
    + '&appid=' + config.weather.apiKey;

  fetch(url)
    .then(function(response) { return response.json(); })
    .then(function(data) {
      // TODO (Claude Code): map `data` fields to the simplified shape below
      // and store in cache.data / cache.fetchedAt before responding.
      //
      // Expected response shape:
      // {
      //   city:        string,
      //   temp:        number,
      //   feels_like:  number,
      //   description: string,   // e.g. "light rain"
      //   icon:        string,   // OpenWeatherMap icon code, e.g. "10d"
      //   humidity:    number,   // percent
      //   wind_speed:  number,   // m/s or mph depending on units
      //   sunrise:     number,   // unix timestamp
      //   sunset:      number,   // unix timestamp
      //   updated_at:  string,   // ISO 8601
      // }
      throw new Error('Not yet implemented — fill in the mapping here');
    })
    .catch(function(err) {
      console.error('[weather] fetch error:', err.message);
      res.status(502).json({ error: err.message });
    });
});

module.exports = router;
