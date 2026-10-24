# Room server protocol and lifecycle

## Local commands

Run `pnpm dev` from the root in Windows PowerShell to build shared code and start Wrangler on `0.0.0.0:8787`. `pnpm test:server` builds shared code and runs the Cloudflare Workers Vitest integration. `pnpm build` bundles without publishing. The browser UI will be added in stage 3.

## HTTP and room allocation

- `POST /rooms`, with no body or `{ "mode": "campaign" }`, returns HTTP 201 and `{ "code": "ABCDE" }`.
- Codes use exactly `ABCDEFGHJKMNPQRSTUVWXYZ23456789`. Crypto rejection sampling avoids bias. The Worker calls `ROOMS.idFromName(code)` and asks that independent object to claim its code. Active claims retry, up to ten candidates. There is no directory object.
- `GET /rooms/:code/ws` with a WebSocket upgrade connects to the claimed room. Unknown codes return 404, malformed codes 400, missing upgrades 426 and throttled joins 429.
- An independent `JoinGate` object per SHA-256-hashed IP enforces ten upgrades per rolling 60 seconds, including attempts against unknown codes. Cloudflare supplies `CF-Connecting-IP`; local requests without it share the local guard. Guards store at most ten timestamps, expire after inactivity, and know no room codes.
- Create bodies and incoming WebSocket frames are limited to 1024 UTF-8 bytes. Binary and oversized WebSocket frames are dropped. Malformed JSON or schema failures return an error. All supported client message shapes are defined by Zod in `packages/shared/src/protocol.ts`.

## Client messages

Send `join` first, then other messages. Only the placeholder skin `spud` is currently supported.

```json
{ "type": "join", "code": "ABCDE", "nickname": "Soggy Mash", "skin": "spud" }
{ "type": "press", "button": "RIGHT", "seq": 0 }
{ "type": "ready", "ready": true }
{ "type": "host", "action": "pickLevel", "levelId": "2-1" }
{ "type": "host", "action": "start" }
{ "type": "host", "action": "next" }
{ "type": "host", "action": "lock", "locked": true }
{ "type": "host", "action": "kick", "playerId": "player-uuid" }
{ "type": "ping", "timestamp": 1234567890 }
```

For reconnect, include the `reconnectToken` returned by `welcome` in a new `join`. The nickname must still be valid; the saved player profile is retained. Tokens are UUIDs and are stored only as SHA-256 hashes in SQLite. A new socket replaces an old socket for the same token without adding a seat or changing ownership. Reconnect works in a full or locked room.

Sequence numbers must increase per player. `welcome.nextSeq` tells a reconnected client its next number. Sequence and rolling press-limit state are kept in socket attachments and in live memory, never written to SQLite per press. At most fifteen press attempts per rolling second are accepted, including unowned attempts. Overflows and stale sequence numbers return errors. Button ownership and every movement/hazard rule are enforced using the shared engine.

## Server messages

- `welcome`: player ID, reconnect token, next sequence number, full room view and server time.
- `room`: player list, current host, campaign mode, selected level, lock state, phase, latest results and any lifecycle notice. Each player includes connected/ready state, color index, nickname, reconnect deadline and assigned buttons.
- `levelStart`: level ID, seed, epoch start time, assignments and the group factor. Clients use the same level JSON and compute slicer phases from elapsed level time.
- `spud`: authoritative public state, server time and most recent presser. Includes the hop timing, inventory, door/device states, checkpoint, death count and respawn deadline. No client position is accepted.
- `event`: shared engine event and server time, including presses/hops, death, respawn, checkpoints, pickups, lever changes and finish.
- `results`: elapsed time, deaths, stars and awards computed by the shared engine, plus the original participant names/colors so awards can identify players whose reconnect grace expired.
- `pong`: the original timestamp and server time for clock synchronization.
- `error`: a machine-readable code and display message. Expected failures do not crash the room.

Times in `levelStart.startTime`, `serverTime` and reconnect deadlines are epoch milliseconds. Hop, event and simulation times are elapsed milliseconds from level start. Only changed state/events are broadcast; ordinary floor landings also send their settled position even without a separate engine event. A quiet running level still advances at 10 Hz.

## Readiness and membership

The first joined player is host. Start requires at least two connected players and everyone ready; disconnected seats must reconnect or expire before another attempt starts. Level selection clears readiness. On Results, `next` checks those same ready votes and starts the next prototype level (wrapping after 2-1). New players join only between levels. The host can lock or kick; kicking invalidates the target's token.

On disconnect, the longest-present connected player becomes host immediately. The departed player's seat and buttons stay reserved for exactly 60 seconds. A deadline alarm removes expired players; shared `releaseButtons` preserves survivors' current jobs and assigns orphaned buttons to the least-loaded connected survivor. Completed-player statistics remain in the live engine for awards.

## Hibernation, persistence and interruption

Room WebSockets use `ctx.acceptWebSocket` and `serializeAttachment`. On wake-up the constructor loads room/player records from SQLite and matches them to socket attachments; a stale saved connection becomes disconnected instead of remaining a phantom player.

The only recurring timer is the live-level 100 ms interval. `applyPress` and `advance` are the sole simulation path. Presses and ticks do not write SQLite or schedule alarms. At finish, the interval stops, live state is discarded, and the small results report is saved once. Idle lobby/results rooms have no recurring timer. Readiness, membership and room-setting changes write small records.

One-shot alarms handle unauthenticated sockets (10 seconds), reconnect expiry (60 seconds) and empty-room expiry (15 minutes). Connected lobby/results rooms with no pending deadlines have no alarm. Expiry deletes room/player data and makes the code claimable again.

If everyone disconnects, gameplay stops immediately and the room returns to the lobby. If a deployment or unexpected eviction destroys a live instance, the next constructor also returns it to the lobby with an interruption notice. Identity reconnects still work; discarded live state cannot be resumed. Ordinary lobby/results hibernation preserves all relevant information and healthy WebSockets.

## Validation

The Workers integration suite exercises real WebSocket upgrades, per-socket attachments, SQLite persistence, forced hibernation and alarms. It covers the requested join, wrong-code, full-room, ownership, flood, reconnect, expiry, host-change and cleanup scenarios; it also checks malformed/oversized messages, lock/kick controls, async join races, shared-engine slicer deaths and results recovery. A `total_changes()` assertion proves that ongoing presses and ticks perform no SQL writes.
