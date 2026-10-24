# Spud Squad

A browser party game where friends share the buttons controlling one potato.

Stages 1 and 2 provide the pnpm workspace, deterministic engine, four levels and authoritative Cloudflare room server. The playable browser screens arrive in stage 3. `pnpm dev` currently starts the server; the client folder contains its dependency/configuration scaffolding.

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

## Two phones on the same Wi-Fi (after stage 3)

1. Connect the Windows PC and both phones to the same private Wi-Fi network. Avoid a guest network with device isolation.
2. In PowerShell, run `ipconfig`. Under the connected Wi-Fi adapter, find its IPv4 address, for example `192.168.1.42`.
3. In the repository, run `pnpm dev`. Vite listens on `0.0.0.0:5173`; Wrangler listens on `0.0.0.0:8787`. Keep this terminal running.
4. If Windows Defender Firewall prompts, allow Node.js on **Private networks**. If it does not prompt and the phone cannot connect, run this in an elevated PowerShell window:

   ```powershell
   New-NetFirewallRule -DisplayName "Spud Squad local development" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 5173,8787 -Profile Private
   ```

5. On both phones, open `http://192.168.1.42:5173`, substituting the PC's actual IPv4 address. Create a room on the first device, then join using its five-character code on the second.
6. Ready both players, start a level and verify that each phone owns different buttons and sees the same Spud.

The browser uses the page host for room HTTP requests and WebSocket connections. Vite proxies `/rooms` and its WebSocket upgrades to Wrangler. A loopback proxy target inside Vite is local server configuration; phones never receive a hard-coded localhost WebSocket URL.

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

## Run the stage 2 server locally

No Cloudflare login is needed for local development or tests. In PowerShell:

```powershell
Set-Location F:\Spud-Squad
pnpm install
pnpm dev
```

Wrangler listens on all interfaces at port 8787 and keeps local SQLite data under `.wrangler/`. Leave this terminal running. In a second PowerShell window:

```powershell
Set-Location F:\Spud-Squad
Invoke-RestMethod -Method Post -Uri http://127.0.0.1:8787/rooms
node tools/server-smoke.mjs http://127.0.0.1:8787
```

The first command returns a five-character code. The smoke command creates another room, joins two real WebSocket clients, readies both players, plays 1-1 and checks the results. Use the PC's Wi-Fi IPv4 address instead of `127.0.0.1` when testing from another device, and allow port 8787 on the Windows Private firewall profile as described above. Browser gameplay on phones becomes available in stage 3.

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
