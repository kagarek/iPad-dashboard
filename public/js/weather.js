// weather.js — renders the weather widget from API data.
// ES5-compatible. Called by dashboard.js after each API response.

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

  // fmtTime — converts a unix timestamp to a HH:MM string.
  function fmtTime(ts) {
    var d = new Date(ts * 1000);
    var h = d.getHours();
    var m = d.getMinutes();
    return (h < 10 ? '0' + h : h) + ':' + (m < 10 ? '0' + m : m);
  }

  document.getElementById('weather-city').textContent = data.city;
  document.getElementById('weather-temp').textContent = data.temp + '°C';
  document.getElementById('weather-desc').textContent = data.description;

  // Build details lines — values are all numbers so innerHTML is safe here.
  var lines = [
    'Feels like ' + data.feels_like + '°C',
    'Humidity ' + data.humidity + '%  ·  Wind ' + data.wind_speed + ' m/s',
  ];
  if (data.sunrise && data.sunset) {
    lines.push('Sunrise ' + fmtTime(data.sunrise) + '  ·  Sunset ' + fmtTime(data.sunset));
  }
  document.getElementById('weather-details').innerHTML = lines.join('<br>');

  loading.style.display = 'none';
  error.style.display   = 'none';
  content.style.display = 'block';
}
