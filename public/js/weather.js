// weather.js — renders the weather widget from API data.
// ES5-compatible. Called by dashboard.js after each API response.

var _weatherData = null;

// fmtTime — converts a unix timestamp to a HH:MM string.
function fmtTime(ts) {
  var d = new Date(ts * 1000);
  var h = d.getHours();
  var m = d.getMinutes();
  return (h < 10 ? '0' + h : h) + ':' + (m < 10 ? '0' + m : m);
}

// uvLabel — returns a human-readable risk level for a UV index value.
function uvLabel(uv) {
  if (uv <= 2)  { return 'Low'; }
  if (uv <= 5)  { return 'Moderate'; }
  if (uv <= 7)  { return 'High'; }
  if (uv <= 10) { return 'Very High'; }
  return 'Extreme';
}

// getTempColor — maps a Celsius temperature to an interpolated RGB color string.
// Scale: deep blue (≤-10°) → blue (0°) → cyan (10°) → green (15°) →
//        yellow-green (20°) → yellow (25°) → orange (30°) → red (≥38°).
function getTempColor(temp) {
  var stops = [
    { t: -10, r:  56, g:  89, b: 230 },
    { t:   0, r:  59, g: 130, b: 246 },
    { t:  10, r:   6, g: 182, b: 212 },
    { t:  15, r:  34, g: 197, b:  94 },
    { t:  20, r: 163, g: 213, b:  30 },
    { t:  25, r: 234, g: 179, b:   8 },
    { t:  30, r: 249, g: 115, b:  22 },
    { t:  38, r: 239, g:  68, b:  68 },
  ];
  var lo = stops[0], hi = stops[stops.length - 1];
  if (temp <= lo.t) { return 'rgb(' + lo.r + ',' + lo.g + ',' + lo.b + ')'; }
  if (temp >= hi.t) { return 'rgb(' + hi.r + ',' + hi.g + ',' + hi.b + ')'; }
  for (var i = 0; i < stops.length - 1; i++) {
    var a = stops[i], b = stops[i + 1];
    if (temp >= a.t && temp <= b.t) {
      var ratio = (temp - a.t) / (b.t - a.t);
      return 'rgb(' +
        Math.round(a.r + ratio * (b.r - a.r)) + ',' +
        Math.round(a.g + ratio * (b.g - a.g)) + ',' +
        Math.round(a.b + ratio * (b.b - a.b)) + ')';
    }
  }
  return '#888';
}

// applyScaleColors — paints a scale bar with a min→max temperature gradient,
// tints the min/max labels, and optionally colors the indicator dot.
function applyScaleColors(bar, labelMax, labelMin, minTemp, maxTemp, indicator, currentTemp) {
  var minColor = getTempColor(minTemp);
  var maxColor = getTempColor(maxTemp);
  bar.style.background = 'linear-gradient(to bottom, ' + maxColor + ', ' + minColor + ')';
  labelMax.style.color = maxColor;
  labelMin.style.color = minColor;
  if (indicator) {
    indicator.style.background = getTempColor(currentTemp);
  }
}

// checkWeatherMode — shows the tomorrow card only between 17:00 and midnight.
// Called every second from dashboard.js so the transition happens at exactly 17:00.
function checkWeatherMode() {
  if (!_weatherData || !_weatherData.tomorrow) { return; }
  var hour        = new Date().getHours();
  var showTomorrow = (hour >= 17);
  var el = document.getElementById('widget-weather-tomorrow');
  if (el) {
    el.style.display = showTomorrow ? 'block' : 'none';
  }
}

// renderWeather — updates the weather widget DOM with the given data object,
// or shows the error state if data is null or contains an error field.
function renderWeather(data) {
  var content = document.getElementById('weather-content');
  var loading = document.getElementById('weather-loading');
  var error   = document.getElementById('weather-error');

  if (!data || data.error) {
    loading.style.display = 'none';
    content.style.display = 'none';
    error.style.display   = 'block';
    return;
  }

  _weatherData = data;

  // --- Today ---
  document.getElementById('weather-city').textContent = data.city;
  document.getElementById('weather-temp').textContent = data.temp + '°C';
  document.getElementById('weather-desc').textContent = data.description;

  if (data.temp_min != null && data.temp_max != null) {
    document.getElementById('weather-scale-max').textContent = data.temp_max + '°';
    document.getElementById('weather-scale-min').textContent = data.temp_min + '°';
    var range = data.temp_max - data.temp_min;
    var ratio = range > 0 ? (data.temp - data.temp_min) / range : 0.5;
    ratio = ratio < 0 ? 0 : (ratio > 1 ? 1 : ratio);
    document.getElementById('weather-scale-indicator').style.top = Math.round((1 - ratio) * 90) + 'px';
    applyScaleColors(
      document.getElementById('weather-scale-bar'),
      document.getElementById('weather-scale-max'),
      document.getElementById('weather-scale-min'),
      data.temp_min, data.temp_max,
      document.getElementById('weather-scale-indicator'),
      data.temp
    );
  }

  var lines = [
    'Feels like ' + data.feels_like + '°C',
    '💧 ' + data.humidity + '%  ·  💨 ' + data.wind_speed + ' m/s',
  ];
  if (data.uv_index != null) {
    lines.push('☀️ ' + data.uv_index + ' — ' + uvLabel(data.uv_index));
  }
  if (data.sunrise && data.sunset) {
    lines.push('🌅 ' + fmtTime(data.sunrise) + '  ·  🌇 ' + fmtTime(data.sunset));
  }
  document.getElementById('weather-details').innerHTML = lines.join('<br>');

  // --- Tomorrow card ---
  var tmr = data.tomorrow;
  if (tmr) {
    if (tmr.temp_max != null) {
      document.getElementById('tmr-temp').textContent = tmr.temp_max + '°C';
    }
    if (tmr.temp_min != null && tmr.temp_max != null) {
      document.getElementById('tmr-scale-max').textContent = tmr.temp_max + '°';
      document.getElementById('tmr-scale-min').textContent = tmr.temp_min + '°';
      applyScaleColors(
        document.getElementById('tmr-scale-bar'),
        document.getElementById('tmr-scale-max'),
        document.getElementById('tmr-scale-min'),
        tmr.temp_min, tmr.temp_max,
        null, null
      );
    }
    document.getElementById('tmr-desc').textContent = tmr.description || '';

    var tmrLines = [];
    if (tmr.temp_min != null) {
      tmrLines.push('Low  ' + tmr.temp_min + '°C');
    }
    if (tmr.uv_index != null) {
      tmrLines.push('☀️ ' + tmr.uv_index + ' — ' + uvLabel(tmr.uv_index));
    }
    if (tmr.sunrise && tmr.sunset) {
      tmrLines.push('🌅 ' + fmtTime(tmr.sunrise) + '  ·  🌇 ' + fmtTime(tmr.sunset));
    }
    document.getElementById('tmr-details').innerHTML = tmrLines.join('<br>');
  }

  checkWeatherMode();

  loading.style.display = 'none';
  error.style.display   = 'none';
  content.style.display = 'block';
}
