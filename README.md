# 🍽️ Table for Two Eating

A cute, kid-safe 3D restaurant-review game for the browser, made for iPad Safari. It's inspired by the daddy-daughter review channel *Table for Two*.

Walk around **Yummy Town** and visit 20 restaurants. Thirteen are made-up places (Sakura Sushi, Slice Squad, Donut Workshop, Bubble Tea Bay, Sundae Funday, Noodle Ninja, Seoul Bites, Curry Castle, Pasta Porch, Sunny Breakfast Cafe, Fish & Ships, Pita Picnic, Cozy BBQ); the other seven are China Garden, Jimmy John's, Chick-fil-A, McDonald's, Chipotle, Subway and Taco Bell. At each one you order a food, **film a review** in a pretend camera viewfinder (REC dot, timer, emotes, preset lines that can be spoken out loud), then **rate it** with stars and an emoji. Ratings are saved in your scrapbook and float above each restaurant as stars. Friends who open the same link show up in the same town.

- 🎲 **Mystery Plate.** "Surprise me!" on every menu serves a random food, usually with a silly twist such as Pickle Sundae or Rainbow Dumplings.
- 🥵 **Food reactions.** Spicy, sour and ice-cold foods get a reaction after every bite: steam out of the ears, a pucker, or a brain-freeze shiver.
- 🍣 **Sushi conveyor belt.** At Sakura Sushi the plates glide past: tap one to grab it. Pick 🐢 Relaxed or 🐇 Fast, or skip to the menu.
- 🎫 **Sticker passport.** Every restaurant you review gives you a sticker. Badges unlock hats for your closet: a chef hat, sunglasses and a crown.
- 🎢 **Playground.** Bounce pads send you flying, and there is a slide to climb and ride. Friends see you do both.
- 🏁 **Race to a restaurant.** Say "Wanna race?" and everyone in town gets a 3-2-1 countdown, a flag over one door and an arrow pointing the way. First one there wins, with confetti.
- 🐶 **Pet sidekick.** Pick a puppy, kitten, dino or dragon in the closet. It follows you around town, sits by the table while you film, and friends see it too.
- 🛴 **Scooter.** Tap the scooter button to zoom around the bigger town.
- 🔍 **Hidden ingredient hunt.** Six giant ingredients hide around town (in the grass, between buildings, behind them). Find all six to cook a silly recipe sticker such as "Upside-Down Banana & Strawberry Sundae", then a new hunt starts.
- 🎯 **Reviewer missions.** Three picture challenges at a time ("Find something crunchy", "Get a brain freeze"). Foods that count get a 🎯 on the menu, and finished missions add up to a reviewer rank.
- 💥 **Comic camera.** Comic words burst onto the viewfinder as you film (CRUNCH! SLURP! BRRR!). Pick a preset frame and show title; they are saved with the review.
- 💃 **Dance party.** Step onto the dance floor by the fountain and tap the pictured move on the beat. Friends see you dance; your score is your own.

- 🎨 **Character creator.** Pick a fun preset name, 7 hair styles, any hair or eye color, and a realistic skin-tone slider.
- 👗 **Closet.** Tops, jackets, bottoms and shoes (yes, light-up ones ✨), each in many colors or any color you like.
- 👯 **Multiplayer.** Up to 8 players per private room link. There's no chat at all, only emotes and preset lines.
- 📴 **Works solo.** If the server can't be reached, everything except multiplayer still works.

All buildings, food and characters are original low-poly art built in code. Restaurant names appear only as plain text on signs, with no logos.

---

## Run it locally

You need **Node.js 18+**.

```bash
npm install     # also copies three.js into public/vendor/
npm start       # → http://localhost:8080
```

Use `PORT=3000 npm start` to pick a different port.

### Play on an iPad on the same Wi-Fi

1. Run `npm start` on your computer. It prints a line like
   `On iPad (same wifi): http://192.168.1.23:8080`
2. Open that address in **Safari** on the iPad.
3. Optional: tap **Share → Add to Home Screen** for a full-screen app icon.

Tips:
- If you hear no sound, check that the iPad's silent switch / Control Center mute is off. Sounds start after the first tap.
- If the iPad can't connect, allow Node through your computer's firewall, and make sure both devices are on the same network (not a "guest" network).

### Controls

| | iPad | Keyboard |
|---|---|---|
| Walk | Drag the joystick (bottom-left) | WASD / arrow keys |
| Look around | Drag anywhere on the 3D world | Drag with the mouse |
| Jump / Go in / Slide / Dance | Big yellow button | Space (E / Enter at a door, the slide or the dance floor) |
| Grab a sushi plate | Tap the plate | Click the plate |
| Emotes & sayings, start a race | 😊 Emote button | — |
| Scooter on / off | 🛴 Scooter button | — |
| Hunt and missions pages | 🔍 and 🎯 buttons | — |

## Rooms & inviting friends

- Every town is a **room**, named in the link: `https://your-host/?room=pink-taco-k7q2m9`.
- If you open the game without `?room=`, it reuses your last room or makes a new random one, and puts it in the address bar.
- Tap **💌 Invite Friends** to share or copy the link. Anyone with the link can join, so only send it to people you know.
- **✨ Make a new town** in the invite box starts a fresh room.
- A room holds up to **8 players**. If it's full, you play solo.

## Tests

```bash
npm test
```

This runs `tests/e2e.mjs` with Playwright and headless Chromium (it installs Chromium if it's missing). The test:
1. starts the server on a free port;
2. opens two iPad-sized touch pages in the same room;
3. checks there are no console or page errors;
4. checks each page sees the other player (via `window.__t42.remotePlayerCount()`);
5. drags the touch joystick and checks the player moved, and that the other page saw it;
6. checks the town layout (all 20 restaurants are on the ring without touching, inside the walkable edge and the server's position limit), that every food has its own 3D model, and that draw calls stay low;
7. bounces on a bounce pad and rides the slide, and checks the other page sees both;
8. walks to Sakura Sushi, tries the conveyor belt speeds, skips to the menu, orders, takes a bite and checks the spicy reaction plays for both players, then films, rates, and checks the review was saved;
9. goes back and taps a plate (and then the Mystery Plate dome) on the 3D belt, and checks that plate is the one served;
10. orders a Mystery Plate at a second restaurant and checks the silly combo and its reaction;
11. reviews a third restaurant, and checks the sticker passport, the badge it earns, the chef hat it unlocks, and that the other page sees the hat;
12. rides the scooter, picks a pet, and checks the other page sees both;
13. starts a race with "Wanna race?", checks both pages get the same door and countdown, that nobody can move before GO, and that the first to the door wins on both pages;
14. collects all six hidden ingredients (checking the other page's hunt is untouched) and checks the silly recipe sticker;
15. checks the mission rules and pages, the 🎯 menu tags, the comic words, frames and titles (saved with the review), and that odd saved data falls back to defaults;
16. plays a whole dance party round and checks every move reached the other page without tripping the emote rate limit;
17. sends bad messages straight to the server (chat, unknown fields, bad names, unknown hats and pets, sky-high heights, >4 KB, 9 players) and checks they're rejected, and checks the race rules there too: the server picks the door, there are no false starts, one race at a time, and a rate limit on starting them.

## Updating

```bash
git pull
npm install        # refreshes three.js in public/vendor if the version changed
npm start
```

Static files are served with `Cache-Control: no-cache`, so iPads pick up new versions on the next reload.

## Deploying

The game is one small Node server (`server/server.js`). It serves `public/` and runs the WebSocket relay at `/ws`, so any Node host that supports WebSockets works.

### Render.com (free web service)
1. Push this repo to GitHub.
2. On Render: **New → Web Service** and pick the repo. You can also use **New → Blueprint**, which reads `render.yaml`.
3. Set Build command `npm install`, Start command `npm start`, Instance type *Free*.
4. Open `https://<your-app>.onrender.com`. Free instances sleep when idle, so the first load can take ~30 s.

### Fly.io
```bash
fly launch        # detects Node; internal port 8080
fly deploy
```

### Glitch-style / other Node hosts (Railway, Replit, a VPS…)
Anything that runs `npm install && npm start` and sets `PORT` works. HTTPS hosts automatically use `wss://`.

### Static-only hosts (GitHub Pages, Netlify static, etc.)
Static hosts **can't run the WebSocket server**. You can still host `public/` there, and the game runs in solo mode. For multiplayer, run `server/server.js` somewhere else (e.g. Render) and point the client at it in `public/config.js`:

```js
window.T42_WS_URL = 'wss://your-game-server.onrender.com/ws';
```

On the server you can restrict which sites may connect with `ALLOWED_ORIGINS=https://you.github.io`.

### Server environment variables
| Variable | Default | Meaning |
|---|---|---|
| `PORT` | `8080` | HTTP port |
| `HOST` | `0.0.0.0` | Bind address |
| `ALLOWED_ORIGINS` | *(any)* | Comma-separated list of allowed WebSocket `Origin`s |
| `TRUST_PROXY` | auto on Render/Fly | Use `X-Forwarded-For` for per-IP limits |

## Kid-safety & privacy

- **No text chat and no typing** of any kind. Names are built from two preset word lists, and "speech" is a preset line sent as a number.
- The server **validates every message**: 4 KB size cap, per-connection rate limits, strict schema (hex colors, enums, clamped numbers). Unknown fields are dropped and messages are rebuilt before relaying. It also limits rooms to 8 players, caps connections per IP, and times out idle sockets. The client validates incoming data too.
- **Races** send nothing a player typed or chose: the message is just "start a race". The server picks the door, runs the countdown and names the winner from the positions it already relays. Nobody can pick the target, start early, or win sooner than the run could take. Starting races is rate limited per player and per town.
- The ingredient hunt, missions, dance scores and camera decorations are **personal**: they stay in the browser and are never sent to anyone. Pets are a preset choice (no pet names).
- Rooms are only reachable by link. No accounts and no analytics. Reviews and outfits are stored only in the browser (`localStorage`). `Referrer-Policy: no-referrer` and a strict Content-Security-Policy are set, and nothing is loaded from third-party sites (three.js is vendored).

## Project layout

```
server/server.js      static files + WebSocket relay (validation, rate limits)
public/index.html     UI markup
public/style.css      big, friendly, touch-first styles
public/config.js      optional WebSocket URL override
public/js/schema.js   shared enums + validation, race rules (used by client AND server)
public/js/data.js     restaurants, menus, food reactions, Mystery Plate twists, missions, hunt and camera presets (add a restaurant here)
public/js/main.js     game loop, modes, multiplayer glue
public/js/world.js    town, restaurants, dance floor, interior set, collisions
public/js/character.js  low-poly character, outfits, emotes, scooter
public/js/pet.js      pet sidekicks
public/js/hunt.js     ingredient hunt: hiding places and silly recipes (no 3D)
public/js/ingredients.js  the giant ingredients' 3D models
public/js/missions.js reviewer mission rules (no 3D)
public/js/dance.js    dance party round: prompts and scoring (no 3D)
public/js/belt.js     sushi conveyor belt
public/js/passport.js sticker passport and badges
public/js/food.js     3D food models
public/js/ui.js       creator / closet / order / rate / scrapbook screens
public/vendor/        three.js (copied from node_modules)
tests/e2e.mjs         Playwright end-to-end test
```
