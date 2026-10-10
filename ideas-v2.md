# Table for Two Eating — Ideas v2 (PLANNING ONLY, nothing built yet; Sonny decides)

Kids' feedback (ages 8-10, including a boy): add sushi, add a lot more restaurants and foods, add new fun stuff.

## 1. Merged restaurant list (keep the 7, add 13 = 20)
Real chain names go on signs as plain text only, with original buildings (CLAUDE.md rule).
| # | Restaurant | Foods |
|---|---|---|
| 1 | **Sakura Sushi (FIRST)** | California roll, cucumber roll, cooked shrimp roll, edamame, mochi |
| 2 | Pizza place (Pizza Hut / "Slice Squad") | Cheese, pepperoni, garlic knots/breadsticks |
| 3 | Noodle Ninja (ramen) | Chicken ramen, gyoza, rice ball |
| 4 | Seoul Bites (Korean) | Korean corn dog, kimbap, mandu, shaved ice |
| 5 | Curry Castle (Indian) | Mild butter chicken, naan, samosa, mango lassi |
| 6 | Pasta place (Olive Garden / "Pasta Porch") | Spaghetti & meatballs, ravioli, garlic bread |
| 7 | Breakfast (IHOP / "Sunny Café") | Pancakes, waffles, eggs & bacon, OJ |
| 8 | Donuts (Dunkin' / "Donut Workshop") | Sprinkle donut, donut holes, cinnamon roll, hot cocoa |
| 9 | Bubble Tea Bay | Boba milk tea, fruit smoothie, egg waffle |
| 10 | Sundae Funday (ice cream) | Sundae, banana split, strawberry cone |
| 11 | Fish & Ships (seafood, boat-shaped) | Fish & chips, popcorn shrimp, corn on the cob |
| 12 | Pita Picnic (Mediterranean) | Chicken pita, falafel bites, hummus |
| 13 | Cozy BBQ | Pulled-chicken slider, cornbread, mac & cheese |
Optional: Pho & Roll (pho, spring rolls, mini bánh mì), Starbucks (cake pop, pink drink).

Groundwork both AIs flagged: the radius-27 ring can't fit ~20 buildings (ring ~39, WORLD_RADIUS ~48, still under server WORLD_LIMIT 60); hard-coded "7" in world.js / ui.js; RESTAURANT_IDS duplicated in schema.js; unknown foods render as a cookie, so every new food needs a model in food.js; avoid newer emoji (🧋) that show as boxes on older iPads.

## 2. New fun elements, ranked by fun vs effort
| Rank | Idea | Fun | Effort | Who suggested |
|---|---|---|---|---|
| 1 | Mystery Plate "🎲 Surprise me" (silly combos like pickle ice cream, 🤢 reaction) | 5 | S | Claude |
| 2 | Food reactions (spicy steam face, sour pucker, brain freeze, wasabi!) | 4 | S | Claude |
| 3 | Sticker passport + badges, unlock hats (chef hat, crown, sunglasses) | 5 | S-M | Both |
| 4 | Bounce pads + working slide | 4 | S | Claude |
| 5 | Sushi conveyor belt, tap the plate to grab it | 5 | M | Both |
| 6 | Race to a restaurant (🏁 countdown, confetti; "Wanna race?" preset already exists) | 5 | M | Claude |
| 7 | Hidden ingredient hunt around town | 5 | M | ChatGPT |
| 8 | Pet sidekick (puppy, kitten, dino, dragon) | 5 | M | Claude |
| 9 | Scooter for the bigger town | 4 | M | Claude |
| 10 | Reviewer missions ("try 3 cuisines", "find something crunchy") | 4 | M | ChatGPT |
| 11 | Build-your-own pizza/sundae with preset toppings | 5 | M-L | Both |
| 12 | Review director: "CRUNCH!" comic overlays and frames on the camera | 3 | S | ChatGPT |
| 13 | Plaza rhythm dance party | 4 | M | ChatGPT |
| 14 | Friend as co-host in the review | 5 | L | Both |
All of these stay kid-safe: presets and emotes only, no text chat, ≥56px buttons, low poly.

## Suggested build order
1. Resize the town, add sushi, pizza, donuts, boba, and ice cream, plus Mystery Plate and food reactions.
2. Add the remaining restaurants, the conveyor belt, stickers and hats, and bounce pads.
3. Race, pets, scooter, ingredient hunt.
4. Big ones: build-your-own, friend co-host.

---
## Appendix A: Claude's raw answer (claude -p, effort max)
No files were changed. Adding restaurants needs no server work, but 19 buildings will not fit the current ring, so the town layout has to change first.

## A) Restaurants: keep the 7, add 12 (19 total)

| Sign text | Shell to reuse + rooftop prop | Foods |
|---|---|---|
| **Sakura Sushi** | pagoda, giant maki roll | California Roll, Cucumber Roll, Edamame, Mochi |
| Pizza Hut | cottage, pizza slice | Pepperoni Pizza, Cheese Pizza, Breadsticks |
| Noodle Ninja | pagoda, ramen bowl | Ramen, Gyoza, Rice Ball |
| Seoul Bites | deli, corn dog | Korean Corn Dog, Kimbap, Shaved Ice |
| Curry Castle | mission, naan stack | Butter Chicken, Naan, Samosa, Mango Lassi |
| Olive Garden | adobe, meatball | Spaghetti & Meatballs, Ravioli, Garlic Bread |
| IHOP | diner, pancake stack | Pancakes, Waffle, Eggs & Bacon, Orange Juice |
| Dunkin' | deli, donut | Sprinkle Donut, Donut Holes, Hot Cocoa |
| Starbucks | cottage, cake pop | Cake Pop, Pink Drink, Croissant |
| Bubble Tea Bay | train, boba cup | Boba Milk Tea, Fruit Smoothie, Egg Waffle |
| Sundae Funday | diner, sundae | Sundae, Banana Split, Popsicle |
| Fish & Ships | train (as a boat), fish | Fish & Chips, Popcorn Shrimp, Corn on the Cob |

Real chain names stay text-only with off-brand palettes, as with the existing seven.

What the code needs:
- **Layout (`world.js`):** at `RING_RADIUS = 27`, 19 buildings sit about 9 units apart, which is narrower than the 8–11-unit buildings. A ring of about 39 fits them, so `WORLD_RADIUS` (41) rises to about 48 and the hedge and outer trees move out. That still fits the server's `WORLD_LIMIT` of 60.
- **Hard-coded 7s:** lamps and gap trees (`world.js:401`, `:475`), the scrapbook text and tilts (`ui.js:237-239`), and `RESTAURANT_IDS` (`schema.js:35`), which duplicates `data.js`. Reviews for ids missing from that list are silently dropped on load.
- **Rooftop props:** each shell builder hard-codes its own, so reuse means pulling them out into a per-restaurant option.
- **Food (`food.js`):** unknown ids silently render as a cookie, so all 39 items need a builder. Roughly 15 can tint existing ones (gyoza from `dumplings`, boba from `shake`); about 25 are new.
- **Emoji:** newer ones such as 🧋 and 🫛 show as boxes on older iPads, so pick older emoji for menus.

## B) Fun elements

All use presets or enums only, so nothing adds text between players.

| # | Idea | Fun | Effort | Files |
|---|---|---|---|---|
| 1 | **Sushi conveyor belt.** At Sakura Sushi, plates glide past and you tap one to grab it. Needs the game's first tap-to-pick on the 3D canvas. | 5 | M | `world.js`, `main.js`, `food.js`, `ui.js` |
| 2 | **Food reactions.** Items tagged spicy, sour or cold trigger a steamy red face, a pucker or a brain-freeze shiver on a bite (wasabi!). | 4 | S | `data.js`, `character.js`, `schema.js`, `main.js`, `audio.js` |
| 3 | **Mystery Plate.** A "🎲 Surprise me!" button on every menu, sometimes serving a silly combo (pickle ice cream) made by re-tinting existing models, with a 🤢 reaction. | 5 | S | `data.js`, `food.js`, `ui.js`, `main.js` |
| 4 | **Sticker badges and unlockable hats.** Badges for visiting everywhere, trying every food at one place, or ten 5-star reviews; each unlocks a chef hat, crown or sunglasses. | 5 | M | `schema.js`, `character.js`, `data.js`, `ui.js`, `storage.js`, `style.css` |
| 5 | **Pet sidekick.** A puppy, kitten, dino or dragon follows you; it syncs through the existing appearance message. | 5 | M | `schema.js`, `character.js` (or new `pet.js`), `data.js`, `ui.js`, `main.js` |
| 6 | **Race to a restaurant.** "Wanna race?" is already a preset line with nothing behind it. Tap 🏁 and everyone gets a countdown and a door; first there gets confetti. One new validated, rate-limited message; each client can judge the winner from positions it already receives. | 5 | M | `schema.js`, `server.js`, `net.js`, `main.js`, `ui.js`, `index.html`, `tests/e2e.mjs` |
| 7 | **Scooter.** A toggle for faster riding, which the bigger town will need. Adds a `ride` animation the server validates through the shared schema. | 4 | M | `schema.js`, `character.js`, `main.js`, `index.html` |
| 8 | **Bounce pads and a working slide.** The diner already has a decorative slide; pads trigger a super-jump. | 4 | S | `world.js`, `main.js`, `character.js` |
| 9 | **Build-your-own.** Pick toppings from preset chips (pizza, donut sprinkles, sundae) and the 3D food shows them. | 5 | L | `food.js`, `data.js`, `ui.js`, `main.js`, `style.css` |
| 10 | **Friend as co-host.** A friend at the same door takes the co-host seat instead of the grown-up. Needs a new message carrying a restaurant id. | 5 | L | `schema.js`, `server.js`, `net.js`, `main.js`, `tests/e2e.mjs` |

For iPad performance, hats and pets should be merged per part the way characters already are, so each adds only a draw call or two per player.

## Suggested order

1. Resize the ring, then add Sakura Sushi, Pizza Hut, Dunkin', Bubble Tea Bay and Sundae Funday, with ideas 2 and 3 (small, and they pay off on every menu).
2. Add the other seven restaurants with the conveyor belt, scooter and badges.
3. Race and pets, then the two large ones.

## Appendix B: ChatGPT's raw answer (codex exec, xhigh)
Planning only; files unchanged. I read both instruction files, README, and the game/server code.

**A) Expand to 20 restaurants**

Keep the existing seven and add thirteen. Use original buildings, decorations, and palettes; restaurant names appear as plain sign text only.

| Restaurant | Foods to review |
|---|---|
| China Garden | Dumplings, orange chicken, lo mein, fried rice |
| Jimmy John’s | Turkey sandwich, ham-and-cheese sub, giant cookie, chips |
| Chick-fil-A | Nuggets, waffle fries, mac and cheese, milkshake |
| McDonald’s | Cheeseburger, fries, apple slices, ice cream cone |
| Chipotle | Burrito, burrito bowl, chips and guacamole, quesadilla |
| Subway | Veggie sub, turkey sub, cookie, apple juice |
| Taco Bell | Crunchy taco, quesadilla, nachos, cinnamon twists |
| **Sushi Station — first addition** | Cucumber roll, avocado roll, cooked shrimp roll, egg nigiri |
| Slice Squad | Cheese pizza, pepperoni pizza, veggie pizza, garlic knots |
| Pasta Porch | Spaghetti and meatballs, butter noodles, cheese ravioli, breadsticks |
| Sunny Breakfast Café | Pancakes, waffles, scrambled eggs, fruit cup |
| Noodle Nest | Chicken ramen, vegetable ramen, udon, steamed buns |
| Mango Curry Kitchen | Mild butter chicken, paneer rice bowl, naan, mango lassi |
| Seoul Snack House | Chicken rice bowl, vegetable kimbap, mandu dumplings, sweet potato fries |
| Pita Picnic | Chicken pita, falafel bites, hummus with pita, cucumber salad |
| Pho & Roll | Chicken pho, vegetable pho, fresh spring rolls, mini bánh mì |
| Cozy BBQ | Pulled chicken slider, cornbread, sweet corn, mashed potatoes |
| Dockside Bites | Fish fingers, popcorn shrimp, baked potato, corn on the cob |
| Donut Workshop | Glazed donut, sprinkle donut, cinnamon roll, blueberry muffin |
| Scoop & Sip | Vanilla sundae, chocolate sundae, strawberry cone, mango smoothie |

**Expansion groundwork:** update [data.js](/workspace/table-for-two-eating/public/js/data.js), [food.js](/workspace/table-for-two-eating/public/js/food.js), and [schema.js](/workspace/table-for-two-eating/public/js/schema.js). Unknown food IDs currently render as cookies. Re-space buildings, paths, trees, and flower exclusions in [world.js](/workspace/table-for-two-eating/public/js/world.js); twenty buildings would crowd the current radius-27 ring. In [ui.js](/workspace/table-for-two-eating/public/js/ui.js), replace the hard-coded seven-restaurant total and cycle scrapbook page tilts.

**B) Eight new fun elements**

Fun scores are estimates for the next playtest: **1–5**. Effort: **S** = extend an existing flow; **M** = new activity; **L** = multiplayer coordination.

File names below refer to `public/js/`; **HTML** means `public/index.html`, **CSS** means `public/style.css`.

| Idea and how it plays | Fun | Effort | Files touched |
|---|---:|:---:|---|
| **Food passport stickers.** Earn an original sticker for each restaurant reviewed and milestone badges. Every star rating earns progress. Extend the existing scrapbook. | 4 | S | `data.js`, `main.js`, `ui.js`, `storage.js`, CSS |
| **Reviewer missions.** Choose picture-based challenges: “Try three cuisines,” “Find something crunchy,” or “Review a food you haven’t tried.” Add cuisine/texture tags to menu data. | 4 | M | `data.js`, `main.js`, `ui.js`, `storage.js`, HTML, CSS |
| **Hidden ingredient hunt.** Find six oversized ingredients around town, then assemble a silly recipe sticker. Each child has personal collectibles, so friends can explore together. | 5 | M | `world.js`, `main.js`, `ui.js`, `storage.js`, HTML, CSS |
| **Sushi conveyor challenge.** At Sushi Station, tap the pictured roll from a short conveyor of moving emoji plates before reviewing it. Offer relaxed and faster speeds, plus a skip button. | 5 | M | `main.js`, `ui.js`, CSS |
| **Build your pizza.** Tap three preset toppings, see them appear on a low-poly pizza, then review your creation. Use existing order and bite animations. | 5 | M | `data.js`, `food.js`, `main.js`, `ui.js`, CSS |
| **Review director.** Decorate the pretend viewfinder with comic “CRUNCH!” overlays, rainbow frames, and preset episode titles. Save the selected decoration with the review. | 3 | S | `data.js`, `main.js`, `ui.js`, `storage.js`, CSS |
| **Plaza rhythm party.** Match large dance/jump/heart prompts to a short synthesized beat. Friends see existing emotes; scoring stays personal. Space prompts to respect current emote limits. | 4 | M | `world.js`, `main.js`, `ui.js`, `audio.js`, HTML, CSS |
| **Review with a friend.** Invite a room friend through preset buttons to take the NPC co-host’s seat. Share food selection and reactions; each child saves their own rating. Requires restaurant/session IDs, seat assignment, and disconnect handling. | 5 | L | `main.js`, `world.js`, `ui.js`, `net.js`, `schema.js`, `server/server.js`, HTML, CSS |

Across these additions, retain preset names and speech, private rooms, ≥56px buttons, pixel ratio ≤2, and original low-poly art. Reuse merged scenery, limit animated objects, and keep camera effects in DOM/CSS. New multiplayer messages need strict field validation, size limits, and rate limits.

I’d build **sushi, pizza, and passport stickers first**, then test the ingredient hunt with the same children.
tokens used
100,077
Planning only; files unchanged. I read both instruction files, README, and the game/server code.

**A) Expand to 20 restaurants**

Keep the existing seven and add thirteen. Use original buildings, decorations, and palettes; restaurant names appear as plain sign text only.

| Restaurant | Foods to review |
|---|---|
| China Garden | Dumplings, orange chicken, lo mein, fried rice |
| Jimmy John’s | Turkey sandwich, ham-and-cheese sub, giant cookie, chips |
| Chick-fil-A | Nuggets, waffle fries, mac and cheese, milkshake |
| McDonald’s | Cheeseburger, fries, apple slices, ice cream cone |
| Chipotle | Burrito, burrito bowl, chips and guacamole, quesadilla |
| Subway | Veggie sub, turkey sub, cookie, apple juice |
| Taco Bell | Crunchy taco, quesadilla, nachos, cinnamon twists |
| **Sushi Station — first addition** | Cucumber roll, avocado roll, cooked shrimp roll, egg nigiri |
| Slice Squad | Cheese pizza, pepperoni pizza, veggie pizza, garlic knots |
| Pasta Porch | Spaghetti and meatballs, butter noodles, cheese ravioli, breadsticks |
| Sunny Breakfast Café | Pancakes, waffles, scrambled eggs, fruit cup |
| Noodle Nest | Chicken ramen, vegetable ramen, udon, steamed buns |
| Mango Curry Kitchen | Mild butter chicken, paneer rice bowl, naan, mango lassi |
| Seoul Snack House | Chicken rice bowl, vegetable kimbap, mandu dumplings, sweet potato fries |
| Pita Picnic | Chicken pita, falafel bites, hummus with pita, cucumber salad |
| Pho & Roll | Chicken pho, vegetable pho, fresh spring rolls, mini bánh mì |
| Cozy BBQ | Pulled chicken slider, cornbread, sweet corn, mashed potatoes |
| Dockside Bites | Fish fingers, popcorn shrimp, baked potato, corn on the cob |
| Donut Workshop | Glazed donut, sprinkle donut, cinnamon roll, blueberry muffin |
| Scoop & Sip | Vanilla sundae, chocolate sundae, strawberry cone, mango smoothie |

**Expansion groundwork:** update [data.js](/workspace/table-for-two-eating/public/js/data.js), [food.js](/workspace/table-for-two-eating/public/js/food.js), and [schema.js](/workspace/table-for-two-eating/public/js/schema.js). Unknown food IDs currently render as cookies. Re-space buildings, paths, trees, and flower exclusions in [world.js](/workspace/table-for-two-eating/public/js/world.js); twenty buildings would crowd the current radius-27 ring. In [ui.js](/workspace/table-for-two-eating/public/js/ui.js), replace the hard-coded seven-restaurant total and cycle scrapbook page tilts.

**B) Eight new fun elements**

Fun scores are estimates for the next playtest: **1–5**. Effort: **S** = extend an existing flow; **M** = new activity; **L** = multiplayer coordination.

File names below refer to `public/js/`; **HTML** means `public/index.html`, **CSS** means `public/style.css`.

| Idea and how it plays | Fun | Effort | Files touched |
|---|---:|:---:|---|
| **Food passport stickers.** Earn an original sticker for each restaurant reviewed and milestone badges. Every star rating earns progress. Extend the existing scrapbook. | 4 | S | `data.js`, `main.js`, `ui.js`, `storage.js`, CSS |
| **Reviewer missions.** Choose picture-based challenges: “Try three cuisines,” “Find something crunchy,” or “Review a food you haven’t tried.” Add cuisine/texture tags to menu data. | 4 | M | `data.js`, `main.js`, `ui.js`, `storage.js`, HTML, CSS |
| **Hidden ingredient hunt.** Find six oversized ingredients around town, then assemble a silly recipe sticker. Each child has personal collectibles, so friends can explore together. | 5 | M | `world.js`, `main.js`, `ui.js`, `storage.js`, HTML, CSS |
| **Sushi conveyor challenge.** At Sushi Station, tap the pictured roll from a short conveyor of moving emoji plates before reviewing it. Offer relaxed and faster speeds, plus a skip button. | 5 | M | `main.js`, `ui.js`, CSS |
| **Build your pizza.** Tap three preset toppings, see them appear on a low-poly pizza, then review your creation. Use existing order and bite animations. | 5 | M | `data.js`, `food.js`, `main.js`, `ui.js`, CSS |
| **Review director.** Decorate the pretend viewfinder with comic “CRUNCH!” overlays, rainbow frames, and preset episode titles. Save the selected decoration with the review. | 3 | S | `data.js`, `main.js`, `ui.js`, `storage.js`, CSS |
| **Plaza rhythm party.** Match large dance/jump/heart prompts to a short synthesized beat. Friends see existing emotes; scoring stays personal. Space prompts to respect current emote limits. | 4 | M | `world.js`, `main.js`, `ui.js`, `audio.js`, HTML, CSS |
| **Review with a friend.** Invite a room friend through preset buttons to take the NPC co-host’s seat. Share food selection and reactions; each child saves their own rating. Requires restaurant/session IDs, seat assignment, and disconnect handling. | 5 | L | `main.js`, `world.js`, `ui.js`, `net.js`, `schema.js`, `server/server.js`, HTML, CSS |

Across these additions, retain preset names and speech, private rooms, ≥56px buttons, pixel ratio ≤2, and original low-poly art. Reuse merged scenery, limit animated objects, and keep camera effects in DOM/CSS. New multiplayer messages need strict field validation, size limits, and rate limits.

I’d build **sushi, pizza, and passport stickers first**, then test the ingredient hunt with the same children.
