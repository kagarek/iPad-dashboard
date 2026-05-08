// news.js — renders the news widget from API data.
// ES5-compatible. Called by dashboard.js after each API response.

// renderNews — updates the news list DOM with the given array of items,
// or shows the error state if items is null or contains an error field.
function renderNews(items) {
  var list    = document.getElementById('news-list');
  var loading = document.getElementById('news-loading');
  var error   = document.getElementById('news-error');

  if (!items || items.error || !items.length) {
    loading.style.display = 'none';
    list.style.display    = 'none';
    error.style.display   = 'block';
    return;
  }

  list.innerHTML = '';

  for (var i = 0; i < items.length; i++) {
    var li     = document.createElement('li');
    var title  = document.createElement('span');
    var source = document.createElement('span');

    title.className       = 'news-title';
    title.textContent     = items[i].title;

    source.className      = 'news-source';
    source.textContent    = items[i].source;

    li.appendChild(title);
    li.appendChild(source);
    list.appendChild(li);
  }

  loading.style.display = 'none';
  error.style.display   = 'none';
  list.style.display    = 'block';
}
