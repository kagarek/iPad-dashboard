## 2026-10-21 14:15 — claude-opus-5-5
Adding iCal parsing with `npm install node-ical` → latest (0.27) silently requires Node >=22, but project targets Node 18+ on an old MacBook. Pinned to `^0.25.6` (engines >=18). Check `npm view <pkg>@<ver> engines` before adding deps here.

## 2026-10-21 14:16 — claude-opus-5-5
Looking up iCloud calendar share links on the Mac → `~/Library/Calendars` is blocked by macOS privacy (TCC: "Operation not permitted"). Links must come from the user via the Calendar app's Share/Public Calendar option.

## 2026-10-21 17:45 — claude-opus-5-5
Starting the server → crashed with "Cannot find module node-ical" because the calendar commit added a dependency but npm install had not been re-run. Fix: run `npm install` in server/ after pulling.
