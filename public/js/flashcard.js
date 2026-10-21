// flashcard.js — Croatian flashcard widget.
// Picks a random word from FLASHCARD_VOCAB, shows it with an example phrase.
// Tap the panel to reveal the Ukrainian translation; auto-flips back after 10 s.
// A new word is shown every 5 minutes (timer driven by dashboard.js).
// ES5-compatible: no const/let/arrow functions/template literals.

/* global FLASHCARD_VOCAB, FLASHCARD_PHRASES */

// _flipTimer — handle for the auto-flip-back countdown.
var _flipTimer = null;

// pickRandom — returns a random entry from the vocabulary array.
function pickRandom() {
  return FLASHCARD_VOCAB[Math.floor(Math.random() * FLASHCARD_VOCAB.length)];
}

// renderFlashcard — fills the flashcard panel with a new random word and phrase.
function renderFlashcard() {
  var entry = pickRandom();
  var phraseData = FLASHCARD_PHRASES && FLASHCARD_PHRASES[entry.hr];

  if (_flipTimer) { clearTimeout(_flipTimer); _flipTimer = null; }

  document.getElementById('flashcard-theme').textContent = entry.theme;
  document.getElementById('flashcard-word').textContent  = entry.hr;
  document.getElementById('flashcard-translation').textContent = entry.tr;

  var phraseEl   = document.getElementById('flashcard-phrase');
  var phraseTrEl = document.getElementById('flashcard-phrase-tr');

  if (phraseData) {
    phraseEl.textContent   = phraseData.phrase;
    phraseEl.style.display = '';
    phraseTrEl.textContent   = phraseData.tr;
    phraseTrEl.style.display = '';
  } else if (entry.note) {
    phraseEl.textContent   = entry.note;
    phraseEl.style.display = '';
    phraseTrEl.style.display = 'none';
  } else {
    phraseEl.style.display   = 'none';
    phraseTrEl.style.display = 'none';
  }

  document.getElementById('flashcard-countdown').textContent = '';
  showFront();
}

// showFront — reveals the Croatian side, hides the translation side.
function showFront() {
  document.getElementById('flashcard-front').style.display = '';
  document.getElementById('flashcard-back').style.display  = 'none';
}

// showBack — reveals the Ukrainian translation and starts the 10-second countdown.
function showBack() {
  document.getElementById('flashcard-front').style.display = 'none';
  document.getElementById('flashcard-back').style.display  = '';

  var remaining   = 10;
  var countdownEl = document.getElementById('flashcard-countdown');

  function tick() {
    if (remaining <= 0) {
      showFront();
      _flipTimer = null;
      return;
    }
    countdownEl.textContent = remaining + 's';
    remaining--;
    _flipTimer = setTimeout(tick, 1000);
  }
  tick();
}

// toggleFlashcard — called when the user taps the panel; flips between sides.
function toggleFlashcard() {
  var backVisible = document.getElementById('flashcard-back').style.display !== 'none';
  if (_flipTimer) { clearTimeout(_flipTimer); _flipTimer = null; }
  if (backVisible) {
    showFront();
  } else {
    showBack();
  }
}
