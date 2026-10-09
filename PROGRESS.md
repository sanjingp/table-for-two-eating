# PROGRESS

## Done
- [x] Project setup (CLAUDE.md, .claude settings, subagents)
- [x] Server (`server/server.js`): static files (gzip, ETag, CSP, no-referrer) + WebSocket relay `/ws?room=CODE`
  - strict schema validation via shared `public/js/schema.js`, unknown fields dropped, 4 KB cap,
    token-bucket rate limits + strike budget, 8 players/room, per-IP + global caps, hello timeout, heartbeat
- [x] 3D town: plaza, fountain, welcome arch, 7 original restaurant buildings with canvas-text signs,
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

## Next (ideas)
- Optional background music toggle
- More foods / restaurants; "visited all 7" badge animation
- Pinch-to-zoom camera on iPad

## Known issues
- Emoji rendering depends on the device font (perfect on iPad; boxes in some headless Linux browsers).
- Free Render instances sleep when idle; first connection can take ~30 s.

## Hosting attempt (Grok Bot, Oct 9 2026)
- Tried no-account Cloudflare quick tunnel: box network blocks Cloudflare edge (QUIC and TCP 7844). No ssh client for localhost.run.
- Needs a free host account Sonny creates (Render.com recommended; render.yaml included).
