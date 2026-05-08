// routes/weather.js — GET /api/weather
// Fetches current weather from Open-Meteo and returns simplified JSON.
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

// --- WMO weather code → human-readable description ---
var WMO_DESCRIPTIONS = {
  0: 'clear sky',
  1: 'mainly clear', 2: 'partly cloudy', 3: 'overcast',
  45: 'fog', 48: 'icy fog',
  51: 'light drizzle', 53: 'drizzle', 55: 'heavy drizzle',
  61: 'light rain', 63: 'rain', 65: 'heavy rain',
  71: 'light snow', 73: 'snow', 75: 'heavy snow', 77: 'snow grains',
  80: 'light showers', 81: 'showers', 82: 'heavy showers',
  85: 'snow showers', 86: 'heavy snow showers',
  95: 'thunderstorm', 96: 'thunderstorm with hail', 99: 'heavy thunderstorm with hail',
};

// --- Route handler ---
router.get('/', function(req, res) {
  var now = Date.now();

  // Return cached data if still fresh
  if (cache.data && (now - cache.fetchedAt) < config.cache.weatherTtlMs) {
    return res.json(cache.data);
  }

  fetch(config.weather.url)
    .then(function(response) { return response.json(); })
    .then(function(data) {
      if (!data.current) {
        throw new Error('Unexpected response from Open-Meteo');
      }

      var c = data.current;

      // Extract daily fields (all arrays — index 0 is today)
      var daily   = data.daily || {};
      var sunrise  = daily.sunrise         && daily.sunrise[0]          ? Math.floor(new Date(daily.sunrise[0]).getTime() / 1000) : null;
      var sunset   = daily.sunset          && daily.sunset[0]           ? Math.floor(new Date(daily.sunset[0]).getTime()  / 1000) : null;
      var temp_max = daily.temperature_2m_max && daily.temperature_2m_max[0] != null ? Math.round(daily.temperature_2m_max[0]) : null;
      var temp_min = daily.temperature_2m_min && daily.temperature_2m_min[0] != null ? Math.round(daily.temperature_2m_min[0]) : null;
      var uv_index = daily.uv_index_max    && daily.uv_index_max[0]    != null ? Math.round(daily.uv_index_max[0])            : null;

      var result = {
        city:        config.weather.city,
        temp:        Math.round(c.temperature_2m),
        feels_like:  Math.round(c.apparent_temperature),
        description: WMO_DESCRIPTIONS[c.weather_code] || 'unknown',
        icon:        '',
        humidity:    c.relative_humidity_2m,
        wind_speed:  c.wind_speed_10m,
        temp_max:    temp_max,
        temp_min:    temp_min,
        uv_index:    uv_index,
        sunrise:     sunrise,
        sunset:      sunset,
        updated_at:  new Date().toISOString(),
      };

      cache.data      = result;
      cache.fetchedAt = Date.now();

      res.json(result);
    })
    .catch(function(err) {
      console.error('[weather] fetch error:', err.message);
      res.status(502).json({ error: err.message });
    });
});

module.exports = router;
