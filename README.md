# Spud Squad

A browser party game where friends share the buttons controlling one potato.

Milestone 1 is playable: Home, Lobby, Play and Results, with four levels, shared controls, slicers, checkpoints, named hands, generated sound and blame awards. `pnpm dev` starts both the Vite client and authoritative Cloudflare room server.

## Windows setup

Use Node.js 24 or newer and pnpm 12.15.0. In PowerShell:

```powershell
Set-Location F:\Spud-Squad
npm install --global pnpm@12.15.0
pnpm install
pnpm test
pnpm typecheck
pnpm lint
pnpm format:check
pnpm build
pnpm validate:levels
pnpm test:coverage
```

Scripts use pnpm, Node and cross-platform CLIs. They require no Bash, Unix environment-variable syntax or Unix file commands. `pnpm format` formats source files. The design document and agent instructions retain their existing formatting.

## Play on a Windows laptop plus two phones

1. Connect the Windows PC and both phones to the same private Wi-Fi network. Avoid a guest network with device isolation.
2. In PowerShell, run `ipconfig`. Under the connected Wi-Fi adapter, find its IPv4 address, for example `192.168.1.42`.
3. In PowerShell, run the following. Wait for both Vite and Wrangler to print their ready addresses, then leave this terminal running:

   ```powershell
   Set-Location F:\Spud-Squad
   pnpm install
   pnpm dev
   ```

   Vite listens on `0.0.0.0:5173`; Wrangler listens on `0.0.0.0:8787`.

4. If Windows Defender Firewall prompts for Node.js or the Workers runtime, allow access on **Private networks**. On a trusted home Wi-Fi, use Windows Settings → Network & Internet → Wi-Fi → your network → Network profile type → Private. If no prompt appears and the phones cannot connect, run this in an elevated PowerShell window:

   ```powershell
   New-NetFirewallRule -DisplayName "Spud Squad local development" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 5173,8787 -Profile Private -RemoteAddress LocalSubnet
   ```

5. On the laptop, open `http://localhost:5173`. Enter your nickname and choose **Create a room**.
6. On **both phones**, open `http://192.168.1.42:5173`, substituting the PC's actual Wi-Fi IPv4 address. Enter different nicknames, type the laptop's five-character room code and tap **Join room**. The invite link also pre-fills the code. Use the PC's IP address on phones; `localhost` on a phone refers to that phone.
7. Confirm that the lobby shows three players. The laptop host selects **1-1 — Wake Up, Spud**. Everyone taps **I’m ready**; the host taps **Start level**. Each person sees only their own assigned buttons. The three-player jobs are LEFT+RIGHT, UP+DOWN and GRAB, shuffled each level.
8. Tap game buttons rather than holding them. Several fingers can press independently. On the laptop, use arrow keys and Space for GRAB. Shift is reserved for STOP/JUMP in later worlds; pressing an unowned key shows “Not your button!”.
9. At Results, read the names on all five awards. Everyone taps **Ready for more**, then the host taps **Next level**. The playlist is 1-1 → 1-4 → 1-6 → 2-1 → 1-1.

If a phone cannot connect, check that the PC terminal is still running, the IP is from the Wi-Fi adapter, the network is Private, and the router does not isolate Wi-Fi clients. VPNs can also put devices on different routes.

The browser uses the page host for room HTTP requests and WebSocket connections. Vite proxies `/rooms` and its WebSocket upgrades to Wrangler. A loopback proxy target inside Vite is local server configuration; phones never receive a hard-coded localhost WebSocket URL.

Sound unlocks on the first tap or key press; the Sound button mutes every effect. Android vibration is attempted when available. Screen Wake Lock is requested only during gameplay and released afterwards. Wake Lock generally requires HTTPS (localhost is also considered secure), so the plain HTTP phone test may use the phone's normal screen timeout. Unsupported or denied features fail silently. Keep the phone awake manually when testing over HTTP.

## Client checks

```powershell
pnpm --filter @spud-squad/client exec playwright install chromium --only-shell
pnpm test:client
pnpm typecheck
pnpm lint
pnpm format:check
pnpm build
```

Playwright checks 360×740, 390×844 and 1366×768, plus rotated phone layouts. It uses two browser contexts for create/join/play/results/reconnect and a separate laptop-plus-two-phones scenario. Tests include actual multi-touch input, immediate feedback, keyboard rejection, first-gesture audio, optional wake-lock lifecycle, slicer death/respawn, and Next Level. Results and board screenshots are saved under `apps/client/test-results/`; the HTML report is under `apps/client/playwright-report/`. They are ignored by Git.

The build checks the sum of **all** JavaScript chunks against 400 KiB gzipped, including the PixiJS chunks loaded on entry to a level. No art, font or sound files are downloaded from third parties. The development servers listen on the local network; `pnpm build` does not publish.

## Manual fun-test checklist

- Join from the laptop plus both phones with different nicknames. Check a wrong code and a filtered nickname, then successfully rejoin.
- Try all four levels. In 1-4, collect a card and open the door. In 1-6, let the belts push and try the side route for the Golden Chip. In 2-1, wait for the blade and deliberately die.
- Press two buttons with two fingers. Check instant pressed-state feedback and Android vibration. Lift just one finger; the other button should stay visually pressed. Long-press, double-tap, pinch and drag the game surface: there should be no selection, menu, zoom or pull-to-refresh. Menus retain ordinary browser zoom.
- Rotate each phone mid-level. The board stays above the buttons in portrait and moves to their left in landscape. Check safe-area/notch space and every tap target.
- Check the blob's hop, widened eyes near a slicer, red warning, spinning blade, fry pile, checkpoint respawn and coloured named hands on the push side.
- On Android Chrome and iPhone Safari, make the first tap, then listen for footsteps, blade whooshes, death, checkpoint and win. Toggle mute, refresh and confirm mute remains saved.
- On an HTTPS build, confirm the screen stays awake during a level and the lock is released at Results. On local HTTP, check that unsupported Wake Lock causes no error.
- Use only the laptop keyboard: arrows and Space work for owned buttons; other controls show “Not your button!”. Verify reduced-motion mode removes hop/stretch/spin/flash animation while keeping a static warning.
- Refresh one device mid-level, then briefly disconnect/reconnect its network. Identity/buttons should recover within 60 seconds while another player stays connected. Leave one player away for over 60 seconds; their buttons should be handed to survivors. If everyone leaves, the attempt returns to the lobby.
- Have the host leave. The longest-present connected player should become host. Finish and check time, deaths, stars and all five large awards, including departed-player names. Ready everyone and continue to the next level.
- Check the game on real mid-range Android hardware for smoothness; desktop emulation does not establish device frame rate. The approved four prototype maps emphasize movement, cards, belts and slicers; they contain no lever puzzle, so GRAB has limited use in this playlist.
- Run the M1 gate with at least five groups of 3–5 people. Record confusion, laughs, idle roles, and whether they ask for another level. At least four of five groups should ask to continue before expanding content.

To remove the firewall rule after testing:

```powershell
Remove-NetFirewallRule -DisplayName "Spud Squad local development"
```

## Shared simulation

`packages/shared` contains no DOM, network access, wall clock or unseeded randomness. Its production TypeScript build has only the ES2022 library, without browser or Node globals. All times are integer milliseconds elapsed from the level's start; the server will translate its clock into this time domain.

```typescript
import {
  loadLevel,
  createLevelState,
  applyPress,
  advance,
} from '@spud-squad/shared';

const level = loadLevel(importedLevelJson);
let state = createLevelState(level, 42, ['player-a']);
({ state } = applyPress(state, 'player-a', 'RIGHT', 0));
const { state: next, events } = advance(state, 150);
```

Both transition functions return `{ state, events }` and leave the input unchanged. See [the engine notes](docs/engine.md) for exact event ordering and edge cases. Tests play the actual JSON levels, including slicer deaths, checkpoint respawns and Fryer Feeder attribution.

The level validator checks schema and references. Playthrough tests prove the four prototype maps are completable; the general shortest-path solver and editor belong to M2. Par times are provisional values for playtesting.

## Run the server on its own

No Cloudflare login is needed for local development or tests. In PowerShell:

```powershell
Set-Location F:\Spud-Squad
pnpm install
pnpm --filter @spud-squad/server dev
```

Wrangler listens on all interfaces at port 8787 and keeps local SQLite data under `.wrangler/`. Leave this terminal running. In a second PowerShell window:

```powershell
Set-Location F:\Spud-Squad
Invoke-RestMethod -Method Post -Uri http://127.0.0.1:8787/rooms
node tools/server-smoke.mjs http://127.0.0.1:8787
```

The first command returns a five-character code. The smoke command creates another room, joins two real WebSocket clients, readies both players, plays 1-1 and checks the results. Use the PC's Wi-Fi IPv4 address instead of `127.0.0.1` when testing from another device, and allow port 8787 on the Windows Private firewall profile as described above. Use root `pnpm dev` for browser gameplay.

Run all tests, or just the server integration tests:

```powershell
pnpm test
pnpm test:server
```

Server tests use `@cloudflare/vitest-plugin` and the local Workers runtime, including SQLite, real hibernatable WebSockets, forced eviction and alarms. `pnpm build` compiles shared code and performs a Worker dry-run bundle; it does not publish. `pnpm deploy` publishes the server after you configure your Cloudflare account.

See [the server protocol and lifecycle](docs/server.md) for exact messages, reconnect behavior and storage boundaries.

## Room architecture

There is one independent SQLite-backed Durable Object per room and no global room directory. Room creation generates a code, resolves `idFromName(code)` and asks that object to claim it; collisions retry. Live game state stays in memory. Only room settings, players and reconnect tokens are persisted on infrequent changes, never on presses or ticks.

WebSockets use `ctx.acceptWebSocket` and per-socket attachments. The 10 Hz loop exists only during a live level and stops at results or when everyone disconnects. Lobby and results do not run idle timers. SQLite stores the small results report once at completion. Independent guards keyed by hashed IP enforce ten joins per rolling minute across all room codes; they do not track rooms.

While anyone remains connected, an away player's identity and buttons are reserved for 60 seconds. After that, their buttons go to connected survivors. If the last connected player leaves, the attempt ends and the room returns to the lobby. A deployment that discards a live instance likewise returns it to the lobby. Neither case resumes a lost in-memory attempt. Empty rooms expire 15 minutes after the last connected player leaves.

## Stage 1 commit

After reviewing the changes:

```powershell
Set-Location F:\Spud-Squad
git add .gitattributes .gitignore .prettierrc.json .prettierignore package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json eslint.config.js vitest.config.ts README.md docs/design.md docs/engine.md packages apps levels tools
git commit -m "Build M1 workspace and deterministic shared engine with slicers"
```

## Stage 2 commit

```powershell
Set-Location F:\Spud-Squad
git add README.md docs/design.md docs/server.md package.json pnpm-lock.yaml vitest.config.ts eslint.config.js apps/server packages/shared/src tools/server-smoke.mjs
git commit -m "Add authoritative hibernating room server and Workers integration tests"
```

## Stage 3 commit

```powershell
Set-Location F:\Spud-Squad
git add README.md docs/design.md docs/server.md package.json apps/client apps/server/src packages/shared/src tools/check-bundle.mjs
git commit -m "Build playable mobile client with Pixi art, touch controls, audio and browser tests"
```
