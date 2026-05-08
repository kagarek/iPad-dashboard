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

// splitUrls — splits a comma-separated env string into a trimmed, filtered array.
function splitUrls(str) {
  return (str || '').split(',').map(function(u) { return u.trim(); }).filter(Boolean);
}

var config = Object.freeze({
  port: parseInt(process.env.PORT, 10) || 3000,

  weather: {
    url:  requireEnv('WEATHER_URL'),
    city: process.env.WEATHER_CITY || 'Home',
  },

  news: {
    // Legacy single-source settings (kept for /api/news?source=N)
    rssUrls:  splitUrls(process.env.NEWS_RSS_URLS),
    maxItems: parseInt(process.env.NEWS_MAX_ITEMS, 10) || 8,

    // Named categories used by /api/news/categories
    categories: {
      worldwide: {
        urls:     splitUrls(process.env.NEWS_WORLDWIDE_URLS),
        maxItems: parseInt(process.env.NEWS_WORLDWIDE_MAX, 10) || 2,
      },
      croatia: {
        urls:     splitUrls(process.env.NEWS_CROATIA_URLS),
        maxItems: parseInt(process.env.NEWS_CROATIA_MAX, 10) || 3,
      },
      ukraine: {
        urls:     splitUrls(process.env.NEWS_UKRAINE_URLS),
        maxItems: parseInt(process.env.NEWS_UKRAINE_MAX, 10) || 5,
      },
    },
  },

  cache: {
    weatherTtlMs: parseInt(process.env.CACHE_WEATHER_TTL_MS, 10) || 600000,
    newsTtlMs:    parseInt(process.env.CACHE_NEWS_TTL_MS,    10) || 300000,
  },
});

module.exports = config;
