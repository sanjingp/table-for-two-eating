# PROGRESS

## Done
- [x] Project setup (CLAUDE.md, .claude settings, subagents)
- [x] Server (`server/server.js`): static files (gzip, ETag, CSP, no-referrer) + WebSocket relay `/ws?room=CODE`
  - strict schema validation via shared `public/js/schema.js`, unknown fields dropped, 4 KB cap,
    token-bucket rate limits + strike budget, 8 players/room, per-IP + global caps, hello timeout, heartbeat
- [x] 3D town: plaza, fountain, welcome arch, 20 original restaurant buildings with canvas-text signs,
      floating star badges, trees/flowers/hedges/clouds; static scenery merged per material (few draw calls)
- [x] Character: 7 hair styles, eye color, skin slider (realistic gradient), tops/jackets/bottoms/shoes
      (incl. light-up), per-limb mesh merging; creator + closet "studio" with live 3D preview
- [x] Restaurant visit: Go in! → order (3–4 items, 3D food) → review viewfinder (REC, timer, corners,
      emotes, preset lines + speechSynthesis, bites, co-host) → rate (stars + mood) → confetti → scrapbook
- [x] Multiplayer: 10 Hz state, snapshot interpolation, emotes/lines/appearance sync, solo fallback,
      invite (share sheet / clipboard), room code in URL
- [x] `npm test` (Playwright, 2 iPad touch pages): no console errors, see each other, joystick moves,
      full review flow, server validation checks — all passing
- [x] README (run, iPad on wifi, update, deploy to Render/Fly/Node hosts, split static hosting)
- [x] Kid-safety review pass; fixes applied (dispose on leave, 56px targets, off-brand colors, longer room codes)

- [x] **Phase 1 of `ideas-v2.md` (Oct 10 2026)**
  - Bigger town: `RING_RADIUS` 27 → 39, `WORLD_RADIUS` 41 → 48 (server `WORLD_LIMIT` is 60). Lamps, benches,
    trees, hedge, flowers, paths and the arch are all placed from `RESTAURANTS.length`; nothing counts to 7 any more.
    Gap trees are skipped automatically when buildings get too close together, so ~20 buildings fit.
  - `RESTAURANT_IDS` in `schema.js` is derived from `data.js` (the server now loads `data.js` too, so keep it import-free).
    Scrapbook total and page tilts follow the data.
  - 5 new made-up restaurants: Sakura Sushi (first, straight ahead of the spawn), Slice Squad, Donut Workshop,
    Bubble Tea Bay, Sundae Funday. They reuse the pagoda / cottage / deli / train / diner shells with new palettes;
    rooftop props are now a per-restaurant `prop` (new: maki, pizza slice, donut, boba cup, sundae).
  - 18 new foods, each with its own 3D model (44 in total). Food models are now merged per material (≤11 draw calls each).
  - Mystery Plate: "🎲 Surprise me!" on every menu → random item, 2 times in 3 with a twist from `MYSTERY_TWISTS`
    (Pickle, Bubblegum, Broccoli, Ketchup, Mustard, Fishy, Fiery, Frozen, Super Sour, Rainbow). The model is re-tinted
    and the name is built from preset words only.
  - Food reactions after each bite: `spicy` (red face, steam from the ears), `sour` (pucker), `cold` (shiver),
    `yuck` (Mystery Plate). Tagged with `react` in `data.js`, shown as a badge on the menu tile, and sent to friends
    as ordinary emotes (4 new values in `EMOTES`, validated and rate-limited by the server like the rest).
  - `npm test` extended: town layout, every food has a model, perf budget, spicy reaction on both pages,
    Mystery Plate flow, scrapbook counts, reaction emote relay.
  - Spawn view: 94 → 106 draw calls, 45k → 63k triangles.

- [x] **Phase 1 reviewer pass (Oct 10 2026)**
  - Prevent overlapping bites when an emote replaces the bite pose: keep the bite blocked until its held food is cleared,
    so an earlier timer cannot remove a newer bite's food or interrupt it with a reaction.
  - Added an end-to-end regression for bite → emote → bite; it failed before the fix. Full `npm test` now passes,
    including multiplayer reaction relay, server message validation, Mystery Plate and the iPad draw-call budget.

- [x] **Phase 2 of `ideas-v2.md` (Oct 10 2026)**
  - 8 more made-up restaurants, 20 in all: Noodle Ninja (pagoda), Seoul Bites (deli), Curry Castle, Pasta Porch (cottage),
    Sunny Breakfast Cafe (diner), Fish & Ships, Pita Picnic, Cozy BBQ. Four new original shells: `castle` (towers and flags),
    `boat` (hull, cabin, funnel, mast, waves), `dome` (white walls, round dome) and `barn` (gambrel roof, rooster weathervane).
    Seven new rooftop props (ramen, corn dog, curry pot, meatballs, pancakes, fish, pita).
  - 27 new foods, each with its own 3D model (71 in total). New reactions: shaved ice and mango lassi are `cold`, orange juice is `sour`.
  - Town: `RING_RADIUS` 39 → 42 and `WORLD_RADIUS` 48 → 51 so 20 buildings fit without touching (the test checks footprints);
    walk speed 6.5 → 7 to make up for it. The diner's decorative side slide is gone (the real slide replaced it).
  - Sushi conveyor belt at Sakura Sushi (`belt: true` in `data.js`, code in `belt.js`): going in opens on the belt instead of the menu.
    Plates glide past and a touch on the 3D canvas grabs the one under the finger (ray pick with a generous radius), it hops to
    the table and the review starts. 🐢 Relaxed / 🐇 Fast speeds (remembered in settings), "Skip to the menu" and, on the menu,
    "Back to the belt". One plate is a silver dome = Mystery Plate. The counter sinks into the floor while a review is filmed.
  - Sticker passport (`passport.js`, first tab of 📖 My Reviews): a sticker for the first review at each restaurant, and 3 badges
    that each unlock a hat: Taste Tester (3 stickers → chef hat), Menu Master (every food at one restaurant → sunglasses),
    Town Tour (10 stickers → crown). A new badge pops up back in the plaza with "Wear it!". Hats live in a new closet tab,
    locked ones say how to earn them. Reviews now store the food id (`fid`); older ones are matched by name.
  - Hats are part of the appearance (`hat` enum in `schema.js`), so they sync through the existing validated `app` message.
    A page from before the update that sends no `hat` still connects (it counts as `none`).
  - Playground: 7 bounce pads (2 by the fountain, 5 in the grass) launch you about two reviewers high, and keep bouncing while
    you stand on them. A slide stands right of the path to Sakura Sushi: walk to its glowing mat, tap "🎢 Slide!", climb, whee.
  - Friends see bounces and slide rides: `st` messages carry a height `y` (server clamps it to 0–`HEIGHT_LIMIT`, optional so
    older pages still work) and two new `ANIMS`, `air` and `slide`.
  - Fewer draw calls: door mats are one instanced ring plus one highlight (was a mesh per door); each cloud is merged.
  - `npm test` extended: 20 restaurants and no overlapping footprints, playground (both pages), belt speeds / skip / tapping a
    plate / the dome, passport rules, locked hats, badge → hat → friend sees it, server checks for `hat` and `y`.
  - Test view with two players: 136 → 152 draw calls, 68k → 85k triangles (budget 160 / 110k). Belt view: 89 draw calls.

- [x] **Phase 2 reviewer pass (Oct 10 2026)** — kid-safety-reviewer found no safety, brand or server-validation problems.
  - Fixed: the passport is worked out from saved reviews, which are capped at 300, so a very keen reviewer could have lost a
    sticker (and the hat it unlocked). The cap now drops the oldest repeats and always keeps the newest review of every
    restaurant + food.
  - Fixed: if the device cannot save (storage full or switched off), reviews, stickers and badges still count for the session.
  - The new rooftop props, slide and pads reuse colors the town already has. Each color is one merged mesh, so this saves
    7–15 draw calls when looking across the whole town (and costs about 4k triangles at the spawn point).
  - Closet tabs have a 56px minimum width.

- [x] **Phase 2 follow-up review (Oct 10 2026)**
  - Fixed: saving a rating in a tab opened earlier could overwrite reviews and passport progress saved by another tab.
    Saves now merge the latest stored history with the session's reviews, retain reviews from failed saves, and count shared
    entries once while preserving separate identical ratings and chronological order.
  - Added regression checks for stale tabs, failed saves followed by storage recovery, and repeated identical ratings.
  - Validation: `npm test` passes, including the new regressions, iPad-style touch flows, rendering budgets and server
    message validation; no console or page errors. Focused storage checks also preserve the Menu Master badge at the cap.

## Next (ideas-v2.md)
- Phase 3: race to a restaurant, pets, scooter, ingredient hunt
- Phase 4: build-your-own pizza/sundae, friend as co-host
- Older ideas: background music toggle, pinch-to-zoom camera

## Known issues
- Emoji rendering depends on the device font (perfect on iPad; boxes in some headless Linux browsers).
- Free Render instances sleep when idle; first connection can take ~30 s.
- New menu emoji are kept to Unicode 11 or older. A few older ones are newer than that (🧃 juice, 🩳 shorts,
  🩴 sandals) and may show as boxes on iPads stuck on iOS 13 or earlier.
- The town is a longer walk now (about 5 s from the fountain to a door); the scooter is planned for Phase 3.
- The ring is full at 20 buildings: a 21st would need a bigger `RING_RADIUS` (the footprint test will say so).
- Hats are only checked on the player's own device (badges come from reviews in localStorage); the server just checks the
  enum. A tinkerer could wear a crown early, which is harmless.
- Software-rendered test runs are several times slower than an iPad, so the playground checks use long timeouts.
- Draw calls in the two-player test view (152) are close to the 160 budget, and the test only measures that view. Standing
  at the town edge looking across all 20 buildings draws 158–172 with one player. Each static color is one merged mesh;
  if this ever needs to come down a lot, merge the whole town into one vertex-colored mesh.
- 🟢 🟡 in the online chip (Unicode 12) and 🤌 on the Chef's kiss emote (Unicode 13) are newer than the Unicode 11 rule
  for menus; they predate Phase 2 and may show as boxes on iPads stuck on old iOS.
- Scrapbook lines show the food name, emoji and mood exactly as saved on this device (length-capped, inserted as text).
  They never leave the device.

## Hosting attempt (Grok Bot, Oct 9 2026)
- Tried no-account Cloudflare quick tunnel: box network blocks Cloudflare edge (QUIC and TCP 7844). No ssh client for localhost.run.
- Needs a free host account Sonny creates (Render.com recommended; render.yaml included).
