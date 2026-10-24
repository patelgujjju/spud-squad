# Spud Squad

A browser party game where friends share the buttons controlling one potato.

Stage 1 provides the pnpm workspace, deterministic game engine, tests and four levels. The room server and playable browser screens arrive in stages 2 and 3. App folders currently contain their dependency/configuration scaffolding; `pnpm dev` and `pnpm deploy` become usable in those stages.

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

## Room architecture for stage 2

There is one independent SQLite-backed Durable Object per room and no global room directory. Room creation generates a code, resolves `idFromName(code)` and asks that object to claim it; collisions retry. Live game state stays in memory. Only room settings, players and reconnect tokens are persisted on infrequent changes, never on presses or ticks.

## Stage 1 commit

After reviewing the changes:

```powershell
Set-Location F:\Spud-Squad
git add .gitattributes .gitignore .prettierrc.json .prettierignore package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json eslint.config.js vitest.config.ts README.md docs/design.md docs/engine.md packages apps levels tools
git commit -m "Build M1 workspace and deterministic shared engine with slicers"
```
