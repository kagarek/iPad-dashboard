// routes/news.js — GET /api/news?source=<index>
// Parses an RSS feed and returns the top N headlines as JSON.
// Each feed is cached separately for CACHE_NEWS_TTL_MS milliseconds.

'use strict';

var express   = require('express');
var RssParser = require('rss-parser');
var config    = require('../config/settings');

var router = express.Router();
var parser = new RssParser();

// --- In-memory cache: one entry per RSS URL ---
// Structure: { [url]: { data: [...], fetchedAt: number } }
var cache = {};

// --- Route handler ---
router.get('/', function(req, res) {
  var sourceIndex = parseInt(req.query.source, 10) || 0;
  var urls        = config.news.rssUrls;

  if (!urls.length) {
    return res.status(503).json({ error: 'No RSS URLs configured in .env' });
  }

  // Clamp index to valid range
  if (sourceIndex < 0 || sourceIndex >= urls.length) {
    sourceIndex = 0;
  }

  var url = urls[sourceIndex];
  var now = Date.now();

  // Return cached data if still fresh
  if (cache[url] && (now - cache[url].fetchedAt) < config.cache.newsTtlMs) {
    return res.json(cache[url].data);
  }

  parser.parseURL(url)
    .then(function(feed) {
      var items = feed.items.slice(0, config.news.maxItems).map(function(item) {
        return {
          title:   item.title   || '',
          link:    item.link    || '',
          pubDate: item.pubDate ? new Date(item.pubDate).toISOString() : '',
          source:  feed.title   || '',
        };
      });

      cache[url] = { data: items, fetchedAt: Date.now() };

      res.json(items);
    })
    .catch(function(err) {
      console.error('[news] fetch error:', err.message);
      res.status(502).json({ error: err.message });
    });
});

module.exports = router;
