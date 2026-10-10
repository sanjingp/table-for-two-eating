# PROGRESS

## Done
- [x] Project setup (CLAUDE.md, .claude settings, subagents)
- [x] Server (`server/server.js`): static files (gzip, ETag, CSP, no-referrer) + WebSocket relay `/ws?room=CODE`
  - strict schema validation via shared `public/js/schema.js`, unknown fields dropped, 4 KB cap,
    token-bucket rate limits + strike budget, 8 players/room, per-IP + global caps, hello timeout, heartbeat
- [x] 3D town: plaza, fountain, welcome arch, 12 original restaurant buildings with canvas-text signs,
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

## Next (ideas-v2.md)
- Phase 2: the other 8 restaurants (Noodle Ninja, Seoul Bites, Curry Castle, Pasta Porch, Sunny Café, Fish & Ships,
  Pita Picnic, Cozy BBQ), sushi conveyor belt, sticker passport + hats, bounce pads + working slide
- Phase 3: race to a restaurant, pets, scooter, ingredient hunt
- Phase 4: build-your-own pizza/sundae, friend as co-host
- Older ideas: background music toggle, pinch-to-zoom camera

## Known issues
- Emoji rendering depends on the device font (perfect on iPad; boxes in some headless Linux browsers).
- Free Render instances sleep when idle; first connection can take ~30 s.
- New menu emoji are kept to Unicode 11 or older. A few older ones are newer than that (🧃 juice, 🩳 shorts,
  🩴 sandals) and may show as boxes on iPads stuck on iOS 13 or earlier.
- The town is a longer walk now (about 5 s from the fountain to a door); the scooter is planned for Phase 3.
- With 20 buildings the ring is snug: two of the widest shells (diner, mission) side by side would nearly touch.

## Hosting attempt (Grok Bot, Oct 9 2026)
- Tried no-account Cloudflare quick tunnel: box network blocks Cloudflare edge (QUIC and TCP 7844). No ssh client for localhost.run.
- Needs a free host account Sonny creates (Render.com recommended; render.yaml included).
