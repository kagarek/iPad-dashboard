# Home Dashboard

A local web dashboard served by a MacBook Pro and displayed on an iPad 2/3.

## Requirements

- Node.js v18+ on the MacBook
- Free API key from [openweathermap.org](https://openweathermap.org/api)
- Both devices on the same Wi-Fi network

## Setup

```bash
# 1. Install dependencies
cd server
npm install

# 2. Configure environment
cp .env.example .env
# Open .env and fill in your OpenWeatherMap API key, city, etc.

# 3. Run (development)
node index.js

# 4. Find your MacBook's local IP
#    macOS:  ipconfig getifaddr en0
#    Linux:  ip addr show | grep 'inet '
```

## iPad Setup

1. Open Safari on the iPad.
2. Navigate to `http://<macbook-ip>:3000`
3. Keep it open — the page auto-refreshes every hour as a fallback.
4. Enable **Guided Access** (`Settings → Accessibility → Guided Access`) to lock the iPad to Safari and prevent it from sleeping.

## Run on Boot

**macOS (launchd):**
```bash
# Edit paths in the file first!
cp server/launchd/com.dashboard.server.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.dashboard.server.plist
```

**Linux (systemd):**
```bash
# Edit User and paths in the file first!
sudo cp server/systemd/dashboard.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable dashboard
sudo systemctl start dashboard
```

## Adding Widgets

See `CLAUDE.md` for full implementation instructions and the "Nice-to-Have" section for ideas.
