# Spud Squad: rules for coding agents

Product: a browser party game. 2-10 players (Crowd Mode: up to 100) share control of one potato, Spud, on a tile grid. Each player owns only some buttons (UP, DOWN, LEFT, RIGHT, GRAB, plus STOP or JUMP in later worlds). No login. Private rooms joined by a 5-character code. Phone (portrait first) and laptop browsers.

Source of truth: docs/design.md. If code and the doc disagree, stop and ask.

Repo (pnpm workspaces):
- packages/shared: pure TypeScript game logic. No DOM, no network, no Date.now(); time is always passed in. Deterministic given (level, seed, presses).
  API: createLevelState(level, seed, playerIds), applyPress(state, playerId, button, t), advance(state, untilT) -> { state, events }.
- apps/client: Vite + TypeScript + Three.js for the level; HTML/CSS for menus and buttons. Drawing lives behind the GameRenderer interface; shared logic and server messages stay independent of rendering.
- apps/server: Cloudflare Worker + one SQLite-backed Durable Object per room; authoritative; uses packages/shared.
- levels/: one JSON file per level; schema in packages/shared/src/levelSchema.ts (zod).
- tools/: solver, level validator, dev-only level editor, load-test bots.

Rules:
- The server is authoritative. Validate every incoming message with zod. Never trust a client's position or state.
- Limits: 15 presses/s per player, 10 join attempts/min per IP, messages up to 1 KB, 10 players per room (100 in Crowd Mode).
- No free-text chat. Nicknames and team names go through the bad-word filter.
- Ads only through apps/client/src/ads/ads.ts (Google H5 Games Ads adBreak). Never during gameplay. data-adbreak-test="on" in development.
- Accessibility: tap targets at least 44 px, full keyboard play, shapes as well as colours, prefers-reduced-motion respected.
- TypeScript strict mode, no `any`. Small modules, clear names.
- Tests: Vitest for every mechanic in packages/shared and for server message handling; Playwright smoke test for the client.
- Performance: initial client JS under 400 KB gzipped; 60 fps on a mid-range Android phone.
- Commands: pnpm dev, pnpm test, pnpm build, pnpm deploy.
