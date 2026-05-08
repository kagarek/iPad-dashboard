// dashboard.js — orchestrator.
// Starts polling loops for weather and news, and drives the live clock.
// Must stay ES5-compatible (no const/let/arrow functions/template literals).

/* global renderWeather, renderNews */

(function() {

  // --- Configuration (mirrors server defaults) ---
  var WEATHER_INTERVAL_MS = 10 * 60 * 1000;   // 10 minutes
  var NEWS_INTERVAL_MS    =  5 * 60 * 1000;   //  5 minutes

  // --- Helpers ---

  // xhrGet — fires an XHR GET and calls callback(parsedJson) on success,
  // or callback(null) on any error.
  function xhrGet(url, callback) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.onreadystatechange = function() {
      if (xhr.readyState !== 4) { return; }
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          callback(JSON.parse(xhr.responseText));
        } catch (e) {
          console.error('[dashboard] JSON parse error for ' + url, e);
          callback(null);
        }
      } else {
        console.error('[dashboard] HTTP ' + xhr.status + ' for ' + url);
        callback(null);
      }
    };
    xhr.send();
  }

  // --- Clock --- 

  // updateClock — writes current time and date into the clock widget.
  function updateClock() {
    var now  = new Date();
    var h    = String(now.getHours()).padStart ? now.getHours() : now.getHours();
    var m    = now.getMinutes();
    var s    = now.getSeconds();

    // Zero-pad without ES6 (padStart not available in iOS 9)
    function pad(n) { return n < 10 ? '0' + n : '' + n; }

    document.getElementById('clock-time').textContent = pad(h) + ':' + pad(m) + ':' + pad(s);

    // TODO (Claude Code): format a nice date string, e.g. "Thursday, 7 May 2026"
    document.getElementById('clock-date').textContent = now.toDateString();
  }

  // --- Weather ---

  function fetchWeather() {
    xhrGet('/api/weather', function(data) {
      renderWeather(data);
    });
  }

  // --- News ---

  function fetchNews() {
    xhrGet('/api/news', function(data) {
      renderNews(data);
    });
  }

  // --- Boot ---

  function init() {
    // Clock — update immediately then every second
    updateClock();
    setInterval(updateClock, 1000);

    // Weather — fetch immediately then on interval
    fetchWeather();
    setInterval(fetchWeather, WEATHER_INTERVAL_MS);

    // News — fetch immediately then on interval
    fetchNews();
    setInterval(fetchNews, NEWS_INTERVAL_MS);
  }

  // Wait for DOM to be ready (iOS 9 safe)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
