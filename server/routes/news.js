// routes/news.js — news API routes
// GET /api/news/categories  — all three named categories in one response
// GET /api/news?source=<n>  — legacy single-source endpoint

'use strict';

var express   = require('express');
var RssParser = require('rss-parser');
var config    = require('../config/settings');

var router = express.Router();

// Configure parser to capture media namespace fields used by BBC and others
var parser = new RssParser({
  customFields: {
    item: [
      ['media:thumbnail', 'mediaThumbnail'],
      ['media:content',   'mediaContent'],
    ],
  },
});

// Per-URL raw feed cache: { [url]: { items: [...], fetchedAt: number } }
var feedCache = {};

// extractImage — returns the best available image URL from an RSS item, or null.
function extractImage(item) {
  if (item.mediaThumbnail && item.mediaThumbnail.$ && item.mediaThumbnail.$.url) {
    return item.mediaThumbnail.$.url;
  }
  if (item.mediaContent && item.mediaContent.$ && item.mediaContent.$.url) {
    return item.mediaContent.$.url;
  }
  if (item.enclosure && item.enclosure.url && (item.enclosure.type || '').indexOf('image') !== -1) {
    return item.enclosure.url;
  }
  return null;
}

// parseFeed — fetches one RSS URL and returns a normalised item array.
// Results are cached per URL for CACHE_NEWS_TTL_MS milliseconds.
function parseFeed(url) {
  var now = Date.now();
  if (feedCache[url] && (now - feedCache[url].fetchedAt) < config.cache.newsTtlMs) {
    return Promise.resolve(feedCache[url].items);
  }
  return parser.parseURL(url).then(function(feed) {
    var items = feed.items.map(function(item) {
      return {
        title:   item.title   || '',
        link:    item.link    || '',
        pubDate: item.pubDate ? new Date(item.pubDate).toISOString() : '',
        source:  feed.title   || '',
        image:   extractImage(item),
      };
    });
    feedCache[url] = { items: items, fetchedAt: Date.now() };
    return items;
  });
}

// fetchCategory — fetches one or more feeds, merges, sorts newest-first, slices.
// A failing feed logs an error and contributes an empty array so others still work.
function fetchCategory(urls, maxItems) {
  if (!urls || !urls.length) {
    return Promise.resolve([]);
  }
  var promises = urls.map(function(url) {
    return parseFeed(url).catch(function(err) {
      console.error('[news] feed error ' + url + ':', err.message);
      return [];
    });
  });
  return Promise.all(promises).then(function(results) {
    var merged = [];
    for (var i = 0; i < results.length; i++) {
      merged = merged.concat(results[i]);
    }
    merged.sort(function(a, b) {
      return new Date(b.pubDate) - new Date(a.pubDate);
    });
    return merged.slice(0, maxItems);
  });
}

// GET /api/news/categories — fetches all three categories in parallel.
router.get('/categories', function(req, res) {
  var cats = config.news.categories;
  Promise.all([
    fetchCategory(cats.worldwide.urls, cats.worldwide.maxItems),
    fetchCategory(cats.croatia.urls,   cats.croatia.maxItems),
    fetchCategory(cats.ukraine.urls,   cats.ukraine.maxItems),
  ])
  .then(function(results) {
    res.json({
      worldwide: results[0],
      croatia:   results[1],
      ukraine:   results[2],
    });
  })
  .catch(function(err) {
    console.error('[news] categories error:', err.message);
    res.status(502).json({ error: err.message });
  });
});

// GET /api/news?source=<index> — legacy single-source endpoint.
router.get('/', function(req, res) {
  var sourceIndex = parseInt(req.query.source, 10) || 0;
  var urls        = config.news.rssUrls;

  if (!urls.length) {
    return res.status(503).json({ error: 'No NEWS_RSS_URLS configured in .env' });
  }
  if (sourceIndex < 0 || sourceIndex >= urls.length) {
    sourceIndex = 0;
  }

  fetchCategory([urls[sourceIndex]], config.news.maxItems)
    .then(function(items) { res.json(items); })
    .catch(function(err) {
      console.error('[news] fetch error:', err.message);
      res.status(502).json({ error: err.message });
    });
});

module.exports = router;
