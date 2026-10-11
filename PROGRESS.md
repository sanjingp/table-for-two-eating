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

- [x] **Phase 3 of `ideas-v2.md` (Oct 10 2026)** — seven features, no new restaurants
  - **Race to a restaurant.** "Wanna race?" in the emote panel (the preset line that already existed) now starts a race. The
    client sends a bare `{ t: 'race' }`; the server picks a door at least 18 units from every player, tells the whole room,
    and names the winner from the positions it already relays (no false starts before GO, players inside a restaurant don't
    count, 60 s time limit). One race per room at a time, and one start per player every 10 s (its own token bucket).
    Everyone gets a big 3-2-1-GO, a banner with an arrow and the steps left, and a checkered flag over the door. The winner
    gets confetti and a fanfare; the others are told who won. Nobody can walk during the countdown. Solo (offline) it races the clock.
    `RING_RADIUS` moved to `schema.js` so the server can work out where the doors are without the 3D code (a test compares them).
  - **Pet sidekick** (`pet.js`): puppy, kitten, dino or dragon, picked in a new closet tab. `pet` is a preset enum in the
    appearance, so it syncs through the existing validated `app` message; a page from before the update still connects. Each
    device walks the pet itself (nothing extra on the network). It heels behind its reviewer, cheers when they dance or jump,
    and sits by the table during a review. One draw call per pet plus a blob shadow (the dragon's wings are one more).
  - **Scooter.** A 🛴 button next to Emote: 11.5 instead of 7 units a second, with a glide. New `scoot` value in `ANIMS`
    (validated by the server like the others) so friends see the scooter and the kicking pose.
  - **Hidden ingredient hunt** (`hunt.js`, `ingredients.js`): six of eight giant ingredients hide around town, two in the grass,
    two between buildings and two behind them. Walk into one to collect it. All six cook a silly recipe sticker named from
    preset words, then a new hunt starts in new places. The layout comes from the hunt number alone, so a reload hides them
    in the same places. Personal: saved in `localStorage` (`t42.quests`), never sent. A 🔍 button shows the count and opens the
    hunt page with picture hints. The very first ingredient is in plain sight by the path to Sakura Sushi.
  - **Reviewer missions** (`missions.js`): 12 picture missions, three at a time, ticked off by saving reviews. Foods that would
    move a mission along get a 🎯 on the menu. Finished missions are cheered in the plaza (toast and confetti, no pop-up to
    dismiss) and add up to a rank. Foods are tagged crunchy / sweet / drink / cheesy / noodles in `FOOD_TAGS`.
  - **Comic camera.** Comic words burst onto the viewfinder for bites (CRUNCH! for crunchy food, SLURP! for drinks and noodles),
    food reactions and emotes. Two new buttons pick one of 6 preset frames and 7 preset show titles; the choice is remembered and
    saved with each review (`frame`, `title`), and shown in the scrapbook. All DOM and CSS, nothing in the 3D scene.
  - **Plaza dance party** (`dance.js`): a dance floor by the fountain. One picture prompt at a time with a closing ring; tap the
    matching move on the beat (12 prompts, synthesized beat). Each hit is an ordinary emote, so friends see it. Prompts are
    1.2 s apart, inside the server's emote limit of 1.5 a second (`EMOTE_LIMIT` is now shared by the server and the dance).
    Score, stars and best score are personal.
  - **Fewer draw calls.** The town's plain colors are now baked into one vertex-colored mesh (`mergeStatic(..., { bake: true })`).
    Two-player test view: 152 → 89 draw calls (93k triangles). Looking across the whole town from the edge: 158–172 → about 85.
    The new props reuse the same trick (`bakeColored`): one draw call each for a pet, the scooter, an ingredient, the race flag.
    Food models are baked the same way (at most 3 draw calls each, was 11) and the restaurant interior is merged per
    material: the sushi belt view went from 129 to 92 draw calls.
  - Fixed along the way: scrapbook pages on the Reviews tab were squashed to their headers since the town grew to 20
    restaurants, so the review lines could not be read. The grid now keeps each page's height and scrolls.
  - The prize card (`#screen-reward`) is shared: badge → hat, silly recipe, dance score.
  - `npm test` extended (about 90 new checks, 212 in all): scooter speed and sync, pets, the full race on both pages, the
    whole hunt, mission rules and pages, 🎯 tags, comic words / frames / titles, a full dance round with every emote relayed,
    the "everything on" draw-call budget (now 120, was 160), and raw-socket checks for pets, `scoot` and the race rules.

- [x] **Phase 3 reviewer pass (Oct 10 2026)** — kid-safety-reviewer found no kid-safety, brand, tap-target or rendering-rule
  problems. It did find gaps in the race rules and a few bugs, all fixed:
  - A modified page could report being at the door the instant GO sounded. The server now remembers how far each racer has
    to run and ignores a finish that comes sooner than a scooter could cover it (`RACE.topSpeed`).
  - The race rate limit was per connection only, so reconnecting skipped it. There is now also a 6 s rest per town after every race.
  - Someone who joined (or reconnected) mid-race was judged but saw no race. The `welcome` message now carries the race
    (door and time to GO) and the page joins in.
  - Quest progress (hunt, missions, best dance score) could be undone by a tab opened earlier, the same kind of bug fixed for
    reviews before. Changes now fold in what is in storage first (`mergeQuests`).
  - A hand-edited mission id such as "constructor" got through the load check and froze the game on a white screen. The check
    uses a `Map` now, and a fade can no longer stay white if something goes wrong inside it.
  - A prize card could pop up in the middle of a race. It waits for the race to end.
  - 🧃 (too new for old iPads) showed up in a mission's picture hints; Apple Juice is 🍏 now.
  - Tests added for each of these.

## Next (ideas-v2.md)
- Phase 4: build-your-own pizza/sundae, friend as co-host
- Older ideas: background music toggle, pinch-to-zoom camera

## Known issues
- Emoji rendering depends on the device font (perfect on iPad; boxes in some headless Linux browsers).
- Free Render instances sleep when idle; first connection can take ~30 s.
- New menu emoji are kept to Unicode 11 or older. A few older ones in the closet are newer than that (🩳 shorts,
  🩴 sandals) and may show as boxes on iPads stuck on iOS 13 or earlier.
- In portrait on an iPad the top-right buttons overlap "My Reviews" (this predates Phase 3). The 🔍 and 🎯 buttons below
  it also open the scrapbook. Landscape is fine.
- A race is judged by the server from positions the players report, like everything else players see of each other. The
  server rules out choosing the door, false starts, and arriving sooner than a scooter could (it remembers how far each
  racer had to go). A tinkerer could still report being at the door the moment that becomes believable.
- A page left open from before this update does not know the `scoot` move, so a friend on a scooter stands still on it
  until it is reloaded. From now on an unknown move is shown as walking instead.
- The sushi belt view draws about 75k triangles (the eight food models on the plates are detailed); other restaurants about 14k.
- Each device decides for itself where a friend's pet walks, so two screens can show it a step apart.
- The dance party's beat is not synced between friends: each child plays their own round.
- The ring is full at 20 buildings: a 21st would need a bigger `RING_RADIUS` (the footprint test will say so).
- Hats are only checked on the player's own device (badges come from reviews in localStorage); the server just checks the
  enum. A tinkerer could wear a crown early, which is harmless.
- Software-rendered test runs are several times slower than an iPad, so the playground checks use long timeouts.
- The town is one big mesh now, so all of it is drawn every frame (about 87k triangles) even when most is off screen.
  That is well within an iPad's reach and saves about 70 draw calls, which were the scarcer thing.
- 🟢 🟡 in the online chip (Unicode 12) and 🤌 on the Chef's kiss emote (Unicode 13) are newer than the Unicode 11 rule
  for menus; they predate Phase 2 and may show as boxes on iPads stuck on old iOS.
- Scrapbook lines show the food name, emoji and mood exactly as saved on this device (length-capped, inserted as text).
  They never leave the device.

## Hosting attempt (Grok Bot, Oct 9 2026)
- Tried no-account Cloudflare quick tunnel: box network blocks Cloudflare edge (QUIC and TCP 7844). No ssh client for localhost.run.
- Needs a free host account Sonny creates (Render.com recommended; render.yaml included).
