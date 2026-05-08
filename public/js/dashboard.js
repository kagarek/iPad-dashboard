// dashboard.js — orchestrator.
// Starts polling loops for weather and news, and drives the live clock.
// Must stay ES5-compatible (no const/let/arrow functions/template literals).

/* global renderWeather, renderNews */

(function() {

  // --- Configuration (mirrors server defaults) ---
  var WEATHER_INTERVAL_MS = 10 * 60 * 1000;   // 10 minutes
  var NEWS_INTERVAL_MS    =  5 * 60 * 1000;   //  5 minutes

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

  // pad — zero-pads a number to two digits without ES6.
  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  // updateClock — writes current time and date into the clock widget.
  function updateClock() {
    var now  = new Date();
    var days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    var months = ['January','February','March','April','May','June',
                  'July','August','September','October','November','December'];

    document.getElementById('clock-time').textContent =
      pad(now.getHours()) + ':' + pad(now.getMinutes()) + ':' + pad(now.getSeconds());

    document.getElementById('clock-date').textContent =
      days[now.getDay()] + ', ' + now.getDate() + ' ' + months[now.getMonth()] + ' ' + now.getFullYear();
  }

  // fetchWeather — polls the weather API and passes data to the renderer.
  function fetchWeather() {
    xhrGet('/api/weather', function(data) {
      renderWeather(data);
    });
  }

  // fetchNews — polls the news API and passes data to the renderer.
  function fetchNews() {
    xhrGet('/api/news', function(data) {
      renderNews(data);
    });
  }

  // init — starts all polling loops after the DOM is ready.
  function init() {
    updateClock();
    setInterval(updateClock, 1000);

    fetchWeather();
    setInterval(fetchWeather, WEATHER_INTERVAL_MS);

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
