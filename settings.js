// settings.js — loads .env and exports a single frozen config object.
// All other modules import from here; nothing reads process.env directly.

'use strict';

require('dotenv').config();

function requireEnv(key) {
  var value = process.env[key];
  if (!value) {
    throw new Error('Missing required environment variable: ' + key);
  }
  return value;
}

var config = Object.freeze({
  port: parseInt(process.env.PORT, 10) || 3000,

  weather: {
    apiKey: requireEnv('OPENWEATHER_API_KEY'),
    city:   process.env.OPENWEATHER_CITY  || 'London',
    units:  process.env.OPENWEATHER_UNITS || 'metric',
  },

  news: {
    // Split comma-separated URLs into an array, trimming whitespace
    rssUrls:  (process.env.NEWS_RSS_URLS || '').split(',').map(function(u) { return u.trim(); }).filter(Boolean),
    maxItems: parseInt(process.env.NEWS_MAX_ITEMS, 10) || 8,
  },

  cache: {
    weatherTtlMs: parseInt(process.env.CACHE_WEATHER_TTL_MS, 10) || 600000,
    newsTtlMs:    parseInt(process.env.CACHE_NEWS_TTL_MS,    10) || 300000,
  },
});

module.exports = config;
