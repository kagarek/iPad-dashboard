# Home Dashboard

A local web dashboard served by a MacBook Pro (Node.js) and displayed full-screen on an iPad 2/3 over Wi-Fi.

Shows a live clock, current weather, and top news headlines. No cloud account or paid API key required.

---

## What you need

- A MacBook (or any computer running Linux/macOS) with **Node.js v18 or newer**
- An iPad 2 or 3 (or any device with a browser) on the **same Wi-Fi network**
- An internet connection on the MacBook so it can fetch weather and news

---

## First-time setup

### 1. Clone the repository

```bash
git clone https://github.com/kagarek/iPad-dashboard.git
cd iPad-dashboard
```

### 2. Install dependencies

```bash
cd server
npm install
```

### 3. Create your configuration file

```bash
cp .env.example .env
```

Now open `server/.env` in any text editor. It looks like this:

```
PORT=3000
WEATHER_URL=https://api.open-meteo.com/v1/forecast?latitude=45.8144&longitude=15.9779&...
WEATHER_CITY=Zagreb
NEWS_RSS_URLS=https://feeds.bbci.co.uk/news/rss.xml,...
NEWS_MAX_ITEMS=8
```

**To set your city:**
1. Go to [open-meteo.com/en/docs](https://open-meteo.com/en/docs)
2. Type your city name in the location search box — it will fill in the latitude and longitude
3. Copy the generated API URL and paste it as the value of `WEATHER_URL`
4. Set `WEATHER_CITY` to your city name (this is just the display label)

No API key or account is needed — Open-Meteo is free.

**To change the news source**, replace the URL in `NEWS_RSS_URLS` with any RSS feed URL.
Multiple feeds are supported, separated by commas.

### 4. Start the server

```bash
node index.js
```

You should see:
```
Dashboard server running on http://0.0.0.0:3000
```

### 5. Find your MacBook's local IP address

Open a new terminal window and run:

```bash
# macOS
ipconfig getifaddr en0

# Linux
hostname -I | awk '{print $1}'
```

This gives you something like `192.168.1.42`.

### 6. Open the dashboard on your iPad

1. Make sure the iPad is on the same Wi-Fi as the MacBook
2. Open **Safari** on the iPad
3. Type `http://192.168.1.42:3000` (use your actual IP)
4. The dashboard should appear full-screen

### 7. Lock the iPad to the dashboard (optional but recommended)

To prevent the iPad from sleeping or leaving the browser:

1. Go to **Settings → Accessibility → Guided Access**
2. Turn on **Guided Access**
3. Set a passcode
4. Return to Safari with the dashboard open
5. Triple-click the Home button to start Guided Access

The iPad will stay on the dashboard until you triple-click again and enter the passcode.

---

## Running on boot (so the server starts automatically)

### macOS (launchd)

```bash
# 1. Open the file and replace YOUR_USERNAME and the node path
#    Run `which node` to find your node path
nano server/launchd/com.dashboard.server.plist

# 2. Install the service
cp server/launchd/com.dashboard.server.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.dashboard.server.plist
```

Check it's running:
```bash
launchctl list | grep dashboard
```

View logs:
```bash
tail -f /tmp/dashboard.stdout.log /tmp/dashboard.stderr.log
```

Stop the service:
```bash
launchctl unload ~/Library/LaunchAgents/com.dashboard.server.plist
```

### Linux (systemd)

```bash
# 1. Open the file and replace YOUR_USERNAME and verify the node path
nano server/systemd/dashboard.service

# 2. Install the service
sudo cp server/systemd/dashboard.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable dashboard
sudo systemctl start dashboard
```

Check it's running:
```bash
sudo systemctl status dashboard
```

View live logs:
```bash
sudo journalctl -u dashboard -f
```

---

## API endpoints

The server exposes three JSON endpoints that the dashboard uses:

| Endpoint | What it returns |
|---|---|
| `GET /api/weather` | Temperature, description, humidity, wind, sunrise/sunset — cached 10 min |
| `GET /api/news` | Top headlines from the configured RSS feed — cached 5 min |
| `GET /api/time` | Current server time and timezone |

You can open these in your browser to check they're working, e.g. `http://localhost:3000/api/weather`.

---

## Troubleshooting

**The page loads but weather shows "⚠ updating…"**
Open `http://localhost:3000/api/weather` in your browser. If it returns `{"error": "..."}`, the problem will be described there. Most likely the `WEATHER_URL` in `.env` is malformed — go back to the Open-Meteo docs page and copy a fresh URL.

**The iPad can't reach the server**
- Make sure both devices are on the same Wi-Fi network
- Confirm the server is running (`node index.js` shows no errors)
- Re-check your MacBook's IP address — it can change when you reconnect to Wi-Fi
- Try opening the URL in a browser on the MacBook first to confirm it works locally

**The server won't start — "Missing required environment variable: WEATHER_URL"**
You haven't created the `.env` file yet. Run `cp .env.example .env` inside the `server/` folder, then fill in the values.

**Clock shows the wrong time**
The clock runs in the browser using the iPad's system time, not the server's time. Check the iPad's date and time settings (`Settings → General → Date & Time → Set Automatically`).
