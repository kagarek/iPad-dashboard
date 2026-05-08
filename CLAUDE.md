# Home Dashboard — Claude Code Instructions

## Important: Working with a Non-Technical User

The user is a somewhat technical person with minor programming experience.
- Always explain what you are doing in simple, plain language
- Never ask the user to manually edit code or configuration files
- If something breaks, fix it yourself — do not ask the user to debug
- After each change, tell the user how to see the result (e.g., "open your browser")
- Prefer simple, working solutions over clever or complex ones
- When asking questions in planning mode, use non-technical language

## Project Goal
Build a local web dashboard served by a MacBook Pro 2014 (Node.js server) and
displayed full-screen in Safari on an iPad 2nd or 3rd generation connected to
the same Wi-Fi. The dashboard shows: current weather, top news headlines, and a
live clock. More widgets may be added later.

---

## Hardware Constraints — Read This First

### iPad 2 / 3 (iOS 9.3.5 max)
- Safari on iOS 9 does **not** support ES6 modules, Service Workers, or PWA features.
- **All frontend JS must be ES5-compatible:**
  - Use `var`, not `const` or `let`
  - Use regular `function` declarations, not arrow functions `() =>`
  - Use `XMLHttpRequest`, not `fetch()`
  - Use `-webkit-` prefixes for flexbox and transitions
  - No template literals (use string concatenation)
- The page will be kept open in Safari permanently (no install needed).
- Add `<meta http-equiv="refresh" content="3600">` as a fallback full-page reload hourly.
- Assume a landscape viewport of roughly **1024×768px**.

### MacBook Pro 2014
- Runs Node.js (v18+) on either macOS or Linux (Ubuntu).
- The server binds to `0.0.0.0` so it is reachable from the iPad on the LAN.
- Default port: **3000** (configurable via `.env`).

---

## Tech Stack

| Layer      | Technology                        |
|------------|-----------------------------------|
| Server     | Node.js + Express                 |
| Weather    | OpenWeatherMap API (free tier)    |
| News       | RSS feeds parsed with `rss-parser`|
| Frontend   | Vanilla HTML / CSS / ES5 JS       |
| Auto-start | `launchd` (macOS) + `systemd` (Linux) service files |

---

## Project Structure

```
home-dashboard/
├── CLAUDE.md                  ← you are here
├── README.md                  ← setup & run instructions for the human
├── .gitignore
│
├── server/
│   ├── index.js               ← Express entry point
│   ├── package.json
│   ├── .env.example           ← template; user copies to .env and fills in keys
│   ├── config/
│   │   └── settings.js        ← imports .env, exports typed config object
│   └── routes/
│       ├── weather.js         ← GET /api/weather
│       ├── news.js            ← GET /api/news
│       └── time.js            ← GET /api/time
│
└── public/                    ← served as static files
    ├── index.html
    ├── css/
    │   └── dashboard.css
    └── js/
        ├── dashboard.js       ← orchestrator: polling loops, DOM wiring
        ├── weather.js         ← renders weather widget
        └── news.js            ← renders news widget
```

---

## Implementation Order

Implement in this order. Finish and manually verify each step before moving on.

### Step 1 — Server scaffold
- `server/package.json` with dependencies: `express`, `rss-parser`, `dotenv`, `node-fetch`
- `server/.env.example` with variables listed below
- `server/config/settings.js` that reads `.env` and exports a frozen config object
- `server/index.js` that starts Express, mounts routes, serves `public/` as static

### Step 2 — Weather route (`GET /api/weather`)
- Call OpenWeatherMap **Current Weather** endpoint
- Return a simplified JSON: `{ city, temp, feels_like, description, icon, humidity, wind_speed, updated_at }`
- Cache the result in memory for 10 minutes to avoid hammering the API

### Step 3 — News route (`GET /api/news`)
- Accept optional query param `?source=0` (index into configured RSS list)
- Parse the RSS feed with `rss-parser`
- Return top N items: `[{ title, link, pubDate, source }]`
- Cache for 5 minutes per feed

### Step 4 — Time route (`GET /api/time`)
- Return `{ iso, timezone }` from the server
- Simple, no caching needed

### Step 5 — Frontend HTML/CSS
- Single `index.html` with three widget regions: clock, weather, news
- Dark background, light text — easy on the eyes in a dim room
- Responsive layout using **prefixed flexbox only** (no grid — iOS 9 support is incomplete)
- Large, legible font sizes (clock ≥ 80px, weather temp ≥ 48px, news ≥ 18px)

### Step 6 — Frontend JS
- `dashboard.js`: on DOM ready, start three `setInterval` loops:
  - Clock: update every **1 second** (client-side, no request)
  - Weather: poll `/api/weather` every **10 minutes**
  - News: poll `/api/news` every **5 minutes**
- `weather.js`: pure function `renderWeather(data)` that updates the DOM
- `news.js`: pure function `renderNews(items)` that updates the DOM
- On fetch error, show a subtle "⚠ updating…" badge — never crash the whole page

### Step 7 — Auto-start service files
- `server/launchd/com.dashboard.server.plist` for macOS
- `server/systemd/dashboard.service` for Linux
- Both should: restart on failure, pass the correct working directory, log to a file

### Step 8 — README
Write clear setup steps:
1. Clone repo
2. `cd server && npm install`
3. Copy `.env.example` to `.env`, fill in values
4. `node index.js` (dev) or install service file (production)
5. On iPad: open `http://<macbook-ip>:3000` in Safari
6. Enable Guided Access on iPad (`Settings → Accessibility → Guided Access`)

---

## Environment Variables (`.env`)

```
PORT=3000
OPENWEATHER_API_KEY=your_key_here
OPENWEATHER_CITY=Zagreb
OPENWEATHER_UNITS=metric          # metric | imperial
NEWS_RSS_URLS=https://feeds.bbci.co.uk/news/rss.xml,https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml
NEWS_MAX_ITEMS=8
CACHE_WEATHER_TTL_MS=600000       # 10 min
CACHE_NEWS_TTL_MS=300000          # 5 min
```

---

## Coding Rules

1. **No ES6+ in `public/js/`** — the linter for the project is your own review. After writing any frontend file, re-read it and replace every arrow function, const/let, template literal, or spread operator you find.
2. **No external CDN links** in `index.html` — the iPad may be offline from the internet; all assets must be local or served by the MacBook.
3. **Error handling on every route** — wrap all external API calls in try/catch and return `{ error: "message" }` with a non-500 status so the frontend can handle it gracefully.
4. **No database** — all state is in-memory cache on the server. If the server restarts, the cache rebuilds on the next request.
5. **Single HTML file** — do not split the dashboard into multiple pages.
6. **Comments** — every function must have a one-line comment explaining what it does.
7. **Config, never hardcode** — any value that might change (city, port, URLs, intervals) must come from `config/settings.js`, never be hardcoded in route or frontend files.

---

## Nice-to-Have (implement only after Steps 1–8 are complete)
- A simple `/admin` page (password-protected via HTTP Basic Auth) to change the city or RSS feeds without editing `.env`
- A "full refresh" button visible only when the iPad is tapped (toggle with a tap event)
- Sunrise/sunset times from the OpenWeatherMap response displayed below weather
- A second news column with a different RSS feed
- Ambient color theme that shifts from cool blue (night) to warm yellow (day) based on server time
