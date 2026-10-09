# Table for Two Eating — project instructions

Kid-safe 3D browser game for a ~7-year-old (Mila), played on iPad Safari via a web link. Based on a real daddy-daughter restaurant review channel "Table for Two".

## Stack
- Client: plain ES modules + Three.js (vendored locally in `public/vendor/`, no CDN at runtime). No build step required; `public/` is served as-is.
- Server: Node.js (`server/server.js`) using `ws` — serves `public/` and a WebSocket relay at `/ws`. Rooms are keyed by `?room=CODE` in the URL.
- Run: `npm install && npm start` → http://localhost:8080
- Test: `npm test` (headless Playwright/Chromium: page loads w/o console errors, two clients see each other, touch joystick moves player).

## Rules
- Kid-safe: NO free text chat, no usernames typed by others shown unfiltered (pick from preset fun names only), emotes only. Rooms private by link.
- Original art only: restaurant names on signs as text, original buildings, NO copied logos/trademark imagery.
- iPad first: touch joystick + tap, big buttons (≥56px), 60fps target, cap pixelRatio at 2, low poly, no heavy shadows.
- Keep `PROGRESS.md` updated after each meaningful step (done / next / known issues).
- Commit with git after each working milestone.
- Validate server messages (size limits, types, rate limits); never trust client input.
