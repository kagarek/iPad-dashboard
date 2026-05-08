// news.js — renders the three-column news widget from API data.
// ES5-compatible. Called by dashboard.js after each API response.

// renderList — fills one category <ul> with linked news items and optional images.
function renderList(listId, items) {
  var ul = document.getElementById(listId);
  ul.innerHTML = '';
  for (var i = 0; i < items.length; i++) {
    var li     = document.createElement('li');
    var a      = document.createElement('a');
    var source = document.createElement('span');

    // Headline image on the left — background-image div (iOS 9 safe, no object-fit needed)
    if (items[i].image) {
      var imgDiv = document.createElement('div');
      imgDiv.className = 'news-img';
      imgDiv.style.backgroundImage = 'url(' + items[i].image.replace(/['"()]/g, '') + ')';
      li.appendChild(imgDiv);
    }

    // Text block on the right: title link + source label
    var textDiv = document.createElement('div');
    textDiv.className = 'news-text';

    a.href        = items[i].link;
    a.target      = '_blank';
    a.rel         = 'noopener noreferrer';
    a.textContent = items[i].title;

    source.className   = 'news-source';
    source.textContent = items[i].source;

    textDiv.appendChild(a);
    textDiv.appendChild(source);
    li.appendChild(textDiv);
    ul.appendChild(li);
  }
}

// renderNews — updates all three category columns from the /categories API response,
// or shows the error state if data is null or contains an error field.
function renderNews(data) {
  var content = document.getElementById('news-content');
  var loading = document.getElementById('news-loading');
  var error   = document.getElementById('news-error');

  if (!data || data.error) {
    loading.style.display  = 'none';
    content.style.display  = 'none';
    error.style.display    = 'block';
    return;
  }

  renderList('news-list-worldwide', data.worldwide || []);
  renderList('news-list-croatia',   data.croatia   || []);
  renderList('news-list-ukraine',   data.ukraine   || []);

  loading.style.display = 'none';
  error.style.display   = 'none';
  content.style.display = ''; // remove inline style, let CSS flex apply
}
