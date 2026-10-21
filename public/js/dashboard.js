// dashboard.js — orchestrator.
// Starts polling loops for weather, news, calendar and flashcards, and toggles night sleep mode.
// Must stay ES5-compatible (no const/let/arrow functions/template literals).

/* global renderWeather, renderNews, renderCalendar, initCalendarSettings, renderFlashcard */

(function() {

  // --- Configuration ---
  var WEATHER_INTERVAL_MS   = 10 * 60 * 1000;   // 10 minutes
  var NEWS_INTERVAL_MS      =  5 * 60 * 1000;   //  5 minutes
  var CALENDAR_INTERVAL_MS  =  5 * 60 * 1000;   //  5 minutes
  var FLASHCARD_INTERVAL_MS =  5 * 60 * 1000;   //  5 minutes
  var WAKE_HOUR             = 7;                 // show dashboard from 07:00
  var SLEEP_HOUR            = 23;                // blank screen from 23:00

  // _sleeping tracks the last known sleep state to detect transitions.
  var _sleeping = null;

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

  // fetchWeather — polls the weather API and passes data to the renderer.
  function fetchWeather() {
    xhrGet('/api/weather', function(data) {
      renderWeather(data);
    });
  }

  // fetchNews — polls the news categories API and passes data to the renderer.
  function fetchNews() {
    xhrGet('/api/news/categories', function(data) {
      renderNews(data);
    });
  }

  // fetchCalendar — polls the calendar API and passes data to the renderer.
  function fetchCalendar() {
    xhrGet('/api/calendar', function(data) {
      renderCalendar(data);
    });
  }

  // checkSleepMode — shows or hides the black overlay based on current hour.
  // Called every second; only acts when the state actually changes.
  function checkSleepMode() {
    var hour        = new Date().getHours();
    var shouldSleep = (hour >= SLEEP_HOUR || hour < WAKE_HOUR);

    if (shouldSleep === _sleeping) { return; }
    _sleeping = shouldSleep;

    var overlay   = document.getElementById('sleep-screen');
    var dashboard = document.getElementById('dashboard');

    if (shouldSleep) {
      overlay.style.display   = 'block';
      dashboard.style.display = 'none';
    } else {
      overlay.style.display   = 'none';
      dashboard.style.display = '';
      // Refresh data immediately on wake so the dashboard is never stale.
      fetchWeather();
      fetchNews();
      fetchCalendar();
    }
  }

  // tick — runs every second to switch sleep mode and weather mode on time.
  function tick() {
    checkSleepMode();
    checkWeatherMode();
  }

  // init — starts all polling loops after the DOM is ready.
  function init() {
    tick();
    setInterval(tick, 1000);

    fetchWeather();
    setInterval(fetchWeather, WEATHER_INTERVAL_MS);

    fetchNews();
    setInterval(fetchNews, NEWS_INTERVAL_MS);

    fetchCalendar();
    setInterval(fetchCalendar, CALENDAR_INTERVAL_MS);

    // Tapping the calendar header flips to "choose calendars"; reload events after saving.
    initCalendarSettings(fetchCalendar);

    renderFlashcard();
    setInterval(renderFlashcard, FLASHCARD_INTERVAL_MS);
  }

  // Wait for DOM to be ready (iOS 9 safe)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
