// news.js — renders the three-column news widget from API data.
// ES5-compatible. Called by dashboard.js after each API response.

// fmtAge — returns a human-readable age string for a pubDate value.
function fmtAge(pubDate) {
  if (!pubDate) { return ''; }
  var then = new Date(pubDate);
  if (isNaN(then.getTime())) { return ''; }
  var diffMin = Math.floor((Date.now() - then.getTime()) / 60000);
  if (diffMin < 1)  { return 'just now'; }
  if (diffMin < 60) { return diffMin + 'm ago'; }
  var diffH = Math.floor(diffMin / 60);
  if (diffH < 24)   { return diffH + 'h ago'; }
  var days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var h = then.getHours(), m = then.getMinutes();
  return days[then.getDay()] + ' ' + (h < 10 ? '0' + h : h) + ':' + (m < 10 ? '0' + m : m);
}

// renderList — fills one category <ul> with linked news items and optional images.
function renderList(listId, items) {
  var ul = document.getElementById(listId);
  ul.innerHTML = '';
  for (var i = 0; i < items.length; i++) {
    var li     = document.createElement('li');
    var a      = document.createElement('a');
    var source = document.createElement('span');
    var time   = document.createElement('span');

    // Headline image on the left — background-image div (iOS 9 safe, no object-fit needed)
    if (items[i].image) {
      var imgDiv = document.createElement('div');
      imgDiv.className = 'news-img';
      imgDiv.style.backgroundImage = 'url(' + items[i].image.replace(/['"()]/g, '') + ')';
      li.appendChild(imgDiv);
    }

    // Text block on the right: title link + meta row (source + timestamp)
    var textDiv = document.createElement('div');
    textDiv.className = 'news-text';

    a.href        = items[i].link;
    a.target      = '_blank';
    a.rel         = 'noopener noreferrer';
    a.textContent = items[i].title;

    source.className   = 'news-source';
    source.textContent = items[i].source;

    time.className   = 'news-time';
    time.textContent = fmtAge(items[i].pubDate);

    var metaDiv = document.createElement('div');
    metaDiv.className = 'news-meta';
    metaDiv.appendChild(source);
    metaDiv.appendChild(time);

    textDiv.appendChild(a);
    textDiv.appendChild(metaDiv);
    li.appendChild(textDiv);
    ul.appendChild(li);
  }
}

// renderNews — updates the Ukraine news panel from the /categories API response,
// or shows the error state if data is null or contains an error field.
function renderNews(data) {
  var uaLoading = document.getElementById('news-ua-loading');
  var uaContent = document.getElementById('news-ua-content');
  var uaError   = document.getElementById('news-ua-error');

  if (!data || data.error) {
    uaLoading.style.display = 'none';
    uaContent.style.display = 'none';
    uaError.style.display   = 'block';
    return;
  }

  renderList('news-list-ukraine', data.ukraine || []);

  uaLoading.style.display = 'none';
  uaError.style.display   = 'none';
  uaContent.style.display = '';
}
