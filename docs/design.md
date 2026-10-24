# Spud Squad — Game Design Document

Oct 24, 2026 · @Jeet

## Overview

Spud Squad (working title) is a browser party game where 2 to 100 players share control of one panicking potato, and each player owns only one or two of its buttons. The team must steer Spud out of a chip factory before it gets sliced, frozen or fried.

**Pitch:** "One potato. Five friends. Everyone controls ONE button. Escape the chip factory."

| Item | Decision |
| --- | --- |
| Platforms | Phone browsers (primary) and laptop browsers; no install, no login |
| Players | 2 to 10 per room for normal play; up to 100 in Crowd Mode; 1 in Solo Practice |
| How people join | Host creates a room and shares a 5-character code, a link or a QR code |
| Session shape | Levels of 1 to 3 minutes; a typical session is 15 to 30 minutes |
| Audience | Teens and adults playing with friends, on calls, in college groups, remote teams and streamers; not designed or marketed for children |
| Revenue | Google AdSense, then H5 Games Ads interstitials and rewarded ads between levels |
| Online play | Private rooms only; no public matchmaking |

**Why it can spread:**

- It is understood in 5 seconds: you see your one big button and the potato.
- Funny failures happen on their own ("WHO PRESSED LEFT?"), which makes clips and screenshots people share.
- It works without voice chat, so strangers and big groups can play; friends on a call get even more out of it.
- Crowd Mode lets a streamer's viewers play together from their phones, which is how browser games reach large audiences fast.
- Every room is an invite: one host brings 3 to 9 new players.

## Character and world

Spud is a small, round potato with stubby legs, huge panicked eyes and a permanent nervous sweat drop. He is fleeing Crispy Co., a fictional chip factory, because every machine in it wants to turn him into fries.

**Spud's personality in animation:**

- Squash-and-stretch hop on every step; a tiny squeak per footstep.
- Panic face and arm-flail when a hazard is one tile away.
- On death he "poofs" into a neat pile of cartoon fries with a sad face, then respawns from a basket at the last checkpoint. No gore.
- Each press shows a small coloured hand from the edge of the screen with the presser's name, so everyone sees who pushed him.
- Idle animations: looks at the camera, checks a tiny watch, waves.

**The factory (one area per world):**

| World | Area | Look |
| --- | --- | --- |
| 1 | Wash and Sort | Blue tiles, water jets, sorting belts |
| 2 | Slicer Hall | Steel floors, spinning blades, warning stripes |
| 3 | The Freezer | Frost, icicles, frozen fry bags |
| 4 | Fryer Floor | Bubbling oil pits, salt shakers, heat haze |
| 5 | Night Shift | Dark packing warehouse, flashlight cones, delivery trucks |

**Art direction:** flat 2D vector art with thick outlines, top-down 3/4 view on a 64 px tile grid, warm yellow and orange palette, readable at phone size. Each hazard has a clear "about to fire" warning frame so players can react.

**Sound:** squeaky footsteps, Spud's scream, oil sizzles, blade whooshes, a happy jingle on escape. Music: one short upbeat loop per world, with a mute switch.

**Skins (unlocked, not bought):** Sweet Potato, Purple Potato, Baby Potato, Hash Brown, Golden Spud, plus seasonal skins (Halloween pumpkin hat, Diwali lamp hat).

**IP and naming checks before launch:**

- All art, sounds, music, names and levels must be made by us or properly licensed (with commercial rights for any AI-generated or stock assets).
- Spud must not resemble Mr. Potato Head (a Hasbro brand): no plug-in plastic face parts, no toy look.
- "Spud Squad" is a placeholder. Search the Indian trademark registry and the USPTO for the final name, and check that the .com domain is free. Backups: "Spud Panic", "Tater Trouble", "Fry Escape".

## Core gameplay

### Approved Milestone 1 scope update (24 October 2026)

- Milestone 1 also implements the slicer blade, its 400 ms warning, fixed level-time schedule and group-size safe-window factors. The prototype includes 2-1 "Chop Chop" and one slicer near the end of 1-6. This intentionally introduces a World 2 mechanic early for the fun test.
- Room creation generates a code and calls `idFromName(code)` on that room's Durable Object to claim it atomically. An active claim causes a retry with a new code. There is no global room directory object.
- Live simulation state stays in room memory. SQLite stores only small, infrequently changing room settings, players and reconnect tokens; presses and ticks never write to SQLite.
- Vite and Wrangler listen on all network interfaces for local testing. Browser WebSocket URLs derive from the page host; Vite proxies room HTTP/WebSocket traffic to local Wrangler.
- Package scripts support Windows PowerShell. Git uses `* text=auto eol=lf`.
- Each implementation stage ends with exact commands the user can run to commit that stage.
- Stage 2 uses the WebSocket Hibernation API and per-socket attachments. Lobby/results restore room/player information from SQLite on wake-up, with no recurring idle loop. Results are saved once on completion. All gameplay rules use the shared engine. Independent, hashed-IP guards enforce the rolling join-attempt limit across room codes without a room directory.
- The 10 Hz gameplay loop stops on completion or when no connected players remain. If everyone disconnects, or a deployment unexpectedly discards a live object, the in-memory attempt ends and the room returns to the lobby. Reconnect grace preserves identity; an attempt cannot resume after its live memory is discarded.

Every player sees the whole level on their own screen, but can press only the buttons assigned to them; the server moves Spud one tile per accepted press.

### Movement rules

1. The level is a grid. Spud stands on one tile and faces the direction he last moved.
2. A direction press moves Spud one tile that way, if the tile is walkable. The hop takes 150 ms.
3. Presses that arrive during a hop go into a one-slot buffer: the first press to arrive is kept, later ones are dropped. This keeps control snappy but still chaotic.
4. If two players own the same button and both press it within the same 100 ms server tick, it counts once.
5. GRAB acts on the tile Spud is facing: pull a lever, pick up a crate, or drop the carried crate.
6. Special buttons appear only in later worlds: STOP (World 3, halts a slide on ice) and JUMP (World 4, hops over one tile).

### Buttons by group size

A level uses up to 6 buttons. The server shuffles the player order each level, then splits buttons as below, so nobody keeps the same job forever.

| Players | Who gets what (5 basic buttons: UP, DOWN, LEFT, RIGHT, GRAB) | When a 6th button (STOP or JUMP) exists |
| --- | --- | --- |
| 1 (Solo Practice) | All buttons | Also gets it |
| 2 | A: LEFT, RIGHT, GRAB · B: UP, DOWN | B gets it |
| 3 | A: LEFT, RIGHT · B: UP, DOWN · C: GRAB | C gets it |
| 4 | A: LEFT · B: RIGHT · C: UP, DOWN · D: GRAB | D gets it |
| 5 | One basic button each | Goes to the player with GRAB |
| 6 to 10 | Every button has at least one owner; extra players share buttons, spread evenly | Same rule |
| 11 to 100 | Crowd Mode voting (see Game modes) | Same rule |

### Controls

- **Phone:** your buttons are huge, at the bottom of the screen, labelled with an arrow icon and a word. A press gives a short vibration on Android (iPhones do not support web vibration, so they get a sound and a flash instead).
- **Laptop:** click the on-screen buttons, or use the keyboard: arrow keys for directions, Space for GRAB, Shift for STOP or JUMP. Keys for buttons you do not own make your button panel shake with a buzz sound: "Not your button!"

### Death, checkpoints and finishing

- Touching a live hazard turns Spud into fries. He respawns at the last checkpoint after 1.5 seconds; crates and levers reset to their state at that checkpoint.
- There are no lives and no game over in the campaign, so groups never get locked out. Some boss levels have a timer; when it runs out, the level restarts from the start.
- The level ends when Spud enters the exit chute.

### Results screen and blame awards

After each level everyone sees the time, death count and stars, plus funny awards computed from the press log:

- **Fryer Feeder:** made the last press before the most deaths.
- **Hero Press:** made the press that reached the exit.
- **Button Masher:** most presses.
- **Asleep at the Button:** fewest presses.
- **Clean Hands:** zero presses that led to a death.

These awards are the main source of laughs and screenshots, so they must appear big and fast.

## Mechanics catalog

The game has 23 building blocks; every level is made only from these, introduced one or two at a time.

| Element | Map symbol | Exact rule | First world |
| --- | --- | --- | --- |
| Floor | `.` | Walkable | 1 |
| Wall or machine | `#` | Blocks movement | 1 |
| Exit chute | `E` | Entering it finishes the level | 1 |
| Checkpoint basket | `C` | Stepping on it sets the respawn point and saves crate and lever states | 1 |
| Key card and door | `k`, `D` | Stepping on a key collects it; a door opens when Spud walks into it holding a key; one key opens one door | 1 |
| Lever | `L` | GRAB while facing it toggles all linked doors, belts or hazards | 1 |
| Conveyor belt | `>` `<` `^` `v` | Moves Spud one tile in its direction every 400 ms while he stands on it; presses still work | 1 |
| Water jet | `w` | A belt that switches direction on a fixed timer | 1 |
| Slicer blade | `S` | Cycles on and off on a timer (for example 1.2 s on, 1.8 s off); flashes 0.4 s before turning on; touching it while on kills | 2 |
| Crate | `B` | GRAB to pick up, GRAB again to drop on the faced tile; Spud carrying a crate moves normally | 2 |
| Pressure plate | `P` | Holds its linked door open while Spud or a crate stands on it | 2 |
| Ice | `i` | Spud slides in his move direction until he hits a wall or leaves the ice; presses are ignored while sliding | 3 |
| STOP button | none | Stops a slide on the current tile | 3 |
| Icicle | `I` | Falls on a timer onto its tile; a shadow grows 0.6 s before it lands | 3 |
| Shuffle siren | `!` | Stepping on it (or a level timer) reshuffles everyone's buttons, with a loud siren and a 1 s on-screen warning | 3 |
| Oil pit | `~` | Instant death; a crate dropped into it becomes a floating raft tile | 4 |
| JUMP button | none | Moves Spud 2 tiles in his facing direction, passing over one tile (a gap, oil or a crate) | 4 |
| Gap | `_` | Instant death unless jumped | 4 |
| Crumble tile | `x` | Turns into a gap 0.6 s after Spud steps off it | 4 |
| Salt shaker | `s` | Patrols a fixed path one tile per 500 ms; touching it kills | 4 |
| Darkness | level setting | Tiles beyond 2 tiles of Spud are hidden for everyone except the Lantern player, who sees the full map; the Lantern role moves to another player at each checkpoint | 5 |
| Teleport pipe | `1`–`9` | Entering a pipe moves Spud to the matching numbered pipe | 5 |
| Golden Chip | `G` | Optional collectible, one per level; gives the third star | 1 |

All timed hazards run on a fixed schedule counted from the level's start time. Every device can therefore draw them in sync without extra network messages.

### Group-size balancing

More players means slower coordination, so all hazard "safe" windows are multiplied by a group factor: 1.0 for 1 to 2 players, 1.15 for 3 to 4, 1.3 for 5 to 6, and 1.4 for 7 or more. These are starting values to tune in playtests.

### Level file format

Each level is one JSON file, so new levels need no code changes:

```json
{
  "id": "2-4",
  "name": "Plate Mate",
  "world": 2,
  "buttons": ["UP", "DOWN", "LEFT", "RIGHT", "GRAB"],
  "map": [
    "##########",
    "#S..B..P.#",
    "#.##.##D##",
    "#C......E#",
    "##########"
  ],
  "start": [1, 3],
  "objects": [
    { "type": "slicer", "at": [1, 1], "onMs": 1200, "offMs": 1800, "phaseMs": 0 },
    { "type": "plate", "at": [7, 1], "opens": [[7, 2]] }
  ],
  "goldenChip": [4, 3],
  "parSeconds": 55,
  "darkness": false
}
```

## Campaign: 5 worlds, 50 levels

Each world teaches one or two new ideas in its first levels, mixes them with old ones in the middle, and ends with a boss level that combines everything. Level 1 of every world teaches the new idea with a picture, never a wall of text.

**Stars:** 1 star for finishing, 2 for beating the par time, 3 for also collecting the Golden Chip. Par time = the shortest solution path (computed by a solver script) × 0.3 s per step + hazard waiting time, then × the group factor. Tune it in playtests.

**Unlocking:** finishing a level unlocks the next one. Finishing a world's boss unlocks the next world. Stars unlock skins, not levels, so no group gets stuck.

### World 1: Wash and Sort (basics)

| Level | Name | New idea or test | Layout |
| --- | --- | --- | --- |
| 1-1 | Wake Up, Spud | Moving to the exit | Short corridor with one turn |
| 1-2 | Left, No, LEFT | Taking turns between button owners | Tight zigzag corridor |
| 1-3 | Rinse Cycle | Checkpoints | Open room, two routes, one checkpoint |
| 1-4 | Card Sharp | Key card and door | Key in a side room, door before exit |
| 1-5 | Pull It | GRAB on a lever | Lever opens a shutter |
| 1-6 | Belt Up | Conveyor belts | Belts carry Spud; step off at the right moment |
| 1-7 | Wrong Way Belt | Pressing against belts | Long belt running backwards |
| 1-8 | Lever Logic | Two linked levers | Each lever opens one door and closes another |
| 1-9 | Sorting Line | Keys, levers and belts together | Small maze of belts and doors |
| 1-10 | Boss: The Big Rinse | Water jets | Jets flip direction every 2 s, pushing Spud toward the drain |

### World 2: Slicer Hall (timing)

| Level | Name | New idea or test | Layout |
| --- | --- | --- | --- |
| 2-1 | Chop Chop | Slicer blades | One slow blade across a corridor |
| 2-2 | Rhythm Section | Blades in sequence | Three blades with offset timing |
| 2-3 | Heavy Lifting | Crates | Carry a crate across the room and drop it on a marked spot |
| 2-4 | Plate Mate | Pressure plates | Drop a crate on a plate to hold a door |
| 2-5 | Hold the Door | Plate plus key | Two doors, one crate, one key |
| 2-6 | Mandoline Run | Long timing run | Corridor of 6 blades with a checkpoint halfway |
| 2-7 | Crate Expectations | Carrying through danger | Crate must pass three blades |
| 2-8 | Lever Panic | Levers that pause blades | Lever stops all blades for 5 s |
| 2-9 | Julienne Junction | Route choice | Crossroads with 4 blades and 3 exits, one real |
| 2-10 | Boss: The Spiralizer | Everything in World 2 | Rings of blades around the exit; 3 levers each stop one ring |

### World 3: The Freezer (sliding and shuffles)

| Level | Name | New idea or test | Layout |
| --- | --- | --- | --- |
| 3-1 | Slip 'n' Spud | Ice | Open rink; slide wall to wall |
| 3-2 | Hit the Brakes | STOP button | Exit sits in the middle of the ice |
| 3-3 | Frozen Crates | Crates on ice | Drop crates to make stopping walls |
| 3-4 | Icicle Alley | Icicles | Corridor with falling icicles |
| 3-5 | Siren Song | Shuffle siren | Siren tile halfway; buttons swap |
| 3-6 | Cold Feet | Ice plus icicles | Thin ice paths under icicles |
| 3-7 | Shuffle Rink | Timed shuffles | Buttons reshuffle every 20 s on a big rink |
| 3-8 | Ice Plate | Sliding a crate onto a plate | Plate at the far edge of the rink |
| 3-9 | Freezer Burn | Belts on ice | Belts push Spud onto ice lanes |
| 3-10 | Boss: Deep Freeze | Everything in World 3 | Floor freezes row by row; reach the exit before it is all ice |

### World 4: Fryer Floor (jumping and danger)

| Level | Name | New idea or test | Layout |
| --- | --- | --- | --- |
| 4-1 | Hop To It | JUMP over gaps | Floor with single-tile gaps |
| 4-2 | Hot Oil | Oil pits | Jump over oil; a miss is fries |
| 4-3 | Crumbly | Crumble tiles | Path that falls away behind Spud |
| 4-4 | Raft Craft | Crate rafts | Drop crates into oil to build a bridge |
| 4-5 | Salt Patrol | Salt shakers | Two patrols crossing the room |
| 4-6 | Leap of Faith | Jump chains | Five jumps in a row with checkpoints |
| 4-7 | Batter Up | Belts into oil | Belts end at pits; jump off in time |
| 4-8 | Double Dip | Levers that cool oil | Lever turns an oil pit into floor for 6 s |
| 4-9 | Shaker Shuffle | Patrols plus shuffles | Shuffle siren in a patrol room |
| 4-10 | Boss: The Mega Fryer | Everything in World 4 | Oil rises one row every 3 s; climb to the exit |

### World 5: Night Shift (darkness and teleports)

| Level | Name | New idea or test | Layout |
| --- | --- | --- | --- |
| 5-1 | Lights Out | Darkness and the Lantern player | Simple maze in the dark |
| 5-2 | Follow My Voice | Lantern changes hands | Lantern moves at each of 3 checkpoints |
| 5-3 | Pipe Dream | Teleport pipes | Three pipe pairs, one correct route |
| 5-4 | Pipe Maze | Pipes in the dark | Pipes plus darkness |
| 5-5 | Dark Slicers | Hazards in the dark | Blades with sound cues |
| 5-6 | Black Ice | Ice in the dark | Rink lit only by the Lantern's map |
| 5-7 | Grease Fire | Jumps in flickering light | Oil pits; lights flicker on a timer |
| 5-8 | Shuffle in the Dark | Shuffles plus darkness | Buttons and the Lantern both reshuffle |
| 5-9 | Loading Dock | Everything so far | Long level with 3 checkpoints |
| 5-10 | Finale: The Great Escape | Every world's idea, one phase each | Five phases ending with Spud riding a delivery truck out of the factory |

After launch, add one new world of 10 levels every 6 to 8 weeks (ideas: Mash Lab, Seasoning Storm, Ketchup Caves).

## Game modes

Launch with four modes; add the level editor once the game has steady players.

| Mode | Players | What it is | Launch |
| --- | --- | --- | --- |
| Campaign | 2 to 10 | The 50 levels above, in order | v1 |
| Solo Practice | 1 | Any unlocked level with all buttons; for learning and for visitors who arrive alone | v1 |
| Daily Spud | 1 to 10 | One new level each day, the same worldwide; team leaderboard | v1 |
| Party Mode | 2 to 10 | A random 3-level playlist from unlocked levels and remixes; no level picking, no waiting | v1 |
| Crowd Mode | 11 to 100 | One big room, everyone votes with their button | v1.1 |
| Level Editor | Any | Build a level, share it by code, play friends' levels | v2 |

### Daily Spud

- A new level every day at 00:00 UTC, the same for every player in the world. Levels are made ahead in batches and checked by the solver.
- The leaderboard ranks team times, split by group size (solo, 2, 3 to 4, 5 or more) so it stays fair.
- Teams enter a team name; there are no accounts. The name passes a bad-word filter.
- A shareable result line is copied with one tap, for example: "Spud Squad Daily #42: escaped in 1:12, 3 deaths. Fryer Feeder: Rahul" plus the game link.

### Crowd Mode (up to 100 players)

Built for streamers, classrooms of adults, office events and big Discord servers.

1. The host opens Crowd Mode on a laptop, which shows the big game view, the room code and a QR code, ready to share on stream.
2. Players join on phones and are assigned to button teams (Team LEFT, Team JUMP and so on), spread evenly.
3. **Vote mode (default):** every 400 ms the server counts presses per button and executes the button with the most presses. Ties go to the button pressed first.
4. **Chaos mode (toggle):** every press counts, limited to one move per 150 ms.
5. Live bars on the host screen show how each team is voting, which is fun to watch on stream.
6. Crowd levels are bigger and more forgiving (group factor 1.6), with no instant-death boss timers.
7. The host can kick players and lock the room.

## Retention and progression (no login)

Progress lives in two places: each device keeps its own profile, and each friend group can save shared campaign progress under a crew code.

| What | Where it is stored | Details |
| --- | --- | --- |
| Nickname and chosen skin | Device (browser storage) | Random funny default name, such as "Soggy Mash 42" |
| Unlocked skins and Golden Chips | Device | Skins unlock at chip counts: 5, 15, 30, 50 |
| Stars per level | Device | Shown on the world map |
| Daily streak | Device | Days in a row with a Daily Spud finished |
| Crew progress | Server, under a 6-character crew code | Unlocked levels and best stars for that group; any member can host with it later; deleted after 90 days unused |

If a player clears their browser data, their device profile is lost; the crew code is the backup for shared progress.

**Reasons to come back:**

- Daily Spud and the streak counter.
- "Your crew stopped at level 2-6" on the home screen.
- Skins earned with Golden Chips.
- Seasonal skins and events (Halloween, Diwali, Christmas).
- A new world every 6 to 8 weeks, then shared player levels (v2).
- A one-tap share card: a PNG image drawn in the browser with the level, time, deaths and the funniest award.

## Screens and UX flows

A new player must go from opening a shared link to pressing their first button in under 20 seconds.

### Main flow

1. **Home:** big buttons for Create Room, Join Room (code box), Daily Spud, Solo Practice; small links to How to Play and Settings. The crew code box sits under Create Room.
2. **Create Room:** pick a mode, get the room code, a QR code and a share button (uses the phone's share sheet; on laptop it copies the link `site.com/r/ABCDE`).
3. **Join:** type the code or open the link. Nickname is prefilled; one tap to change skin; then the lobby.
4. **Lobby:** player list with skins and colours; the host picks a level on the world map; Start unlocks at 2 players. Up to 10 players (100 in Crowd Mode). Players can join between levels.
5. **Level intro (2 seconds):** "YOUR BUTTONS: LEFT + GRAB" in huge letters, plus a one-picture hint if the level has a new idea.
6. **Play:** see layouts below.
7. **Results:** time, deaths, stars, blame awards, share button. Everyone taps Ready; the host taps Next Level or Back to Map.
8. **Ad break (when due):** happens after Ready, on each device separately (see Monetization).

### In-game layouts

| Device | Layout |
| --- | --- |
| Phone, portrait (main target) | Top 60%: the level, auto-zoomed to fit the room around Spud. Bottom 40%: your buttons, as large as possible (1 button = full width; 2 = side by side; 3 = two on top, one below). Top strip: timer, deaths, pause menu |
| Phone, landscape | Level on the left 65%, buttons stacked on the right |
| Laptop | Level large in the centre; your buttons below it with keyboard hints on each (arrows, Space, Shift); player list on the right showing who pressed last |

Other players' presses appear as small coloured hands with names around Spud, so everyone can see who is doing what.

### Settings

Sound and music volume, vibration on or off, colour-blind mode (buttons and players also get shapes, not only colours), reduced motion, left-handed button layout, and language (English at launch; Hindi later).

### Problems and edge cases

- **Connection lost:** the game reconnects automatically for up to 60 seconds and keeps that player's buttons. If they do not return, their buttons are handed to the others with a short notice.
- **Host leaves:** the longest-present player becomes host.
- **Phone locked or app switched:** that player counts as away; the team keeps playing.
- **Room full or code wrong:** a clear message and a button back to Home.
- **Page refresh:** rejoins the same room with the same buttons.

## Monetization and AdSense compliance

Ads appear only between levels, never during play. Revenue grows with sessions and levels played, not with clicks.

### Order of steps

1. Launch the site with the game and original guide pages; apply for AdSense.
2. Once approved, apply for H5 Games Ads (full-screen ads inside games need that separate approval).
3. Until H5 approval: display ads only on guide and blog pages, never on game screens.

### Where ads go

| Placement | Ad type | Trigger | Rule |
| --- | --- | --- | --- |
| Between levels | Interstitial (`adBreak` type `next`) | After the player taps Ready on the results screen | Each device calls it for itself; Google decides if an ad shows. Frequency hint 150 s to start; test 120 s and 180 s |
| Entering a room | Interstitial (type `start`) | After the lobby has loaded and the player taps Join | Never before the page has loaded |
| Skip a level | Rewarded | Offered after 3 restarts or 5 minutes on one level | Any player can watch for the team; reward given only when the ad is fully viewed |
| Extra checkpoint | Rewarded | Offered on long and boss levels | Adds one checkpoint at Spud's current tile |
| Guide and blog pages | Display ads (Auto ads allowed) | Normal page views | At least 150 px from any game area; no ads on in-game screens |

### Keeping a multiplayer group in sync

1. When the host taps Next, each device runs its own ad break.
2. The server starts the next level when every player has reported Ready-after-ad, or after 35 seconds, whichever comes first.
3. Players still watching an ad see the level already running when they return; levels always start with a 3-second safe zone, so they lose nothing.
4. The lobby says "Waiting for players", never "X is watching an ad".

### Rules we never break

- No text, arrows or rewards that ask anyone to click ads. Rewarded ads reward watching, never clicking.
- No ads during play, no ads that appear unexpectedly, no ad right after another ad closes, no ad on every press.
- No banner or display ad on game screens or next to game buttons (accidental taps get accounts banned).
- Rewards are in-game only (a skip or a checkpoint), never money or anything tradeable; a player who says no loses nothing.
- Use the test-ad setting (`data-adbreak-test="on"`) in all development and testing. Never click our own live ads.
- Show Google's consent message (AdSense Privacy & messaging) to visitors from the EEA, UK and Switzerland.
- The game is not designed or marketed for children. Keep the cartoon fun, but aim the site, keywords and marketing at teens and adults.

## Technical architecture and scaling

Each room runs as its own small server object on Cloudflare, so 100 players and 100,000 players use the same design; only the bill changes.

&#91;embedded content: system architecture · 6 parts\]

Players load the game from the CDN, join through the Worker, then talk only to their room's server object; Google serves ads and analytics straight to each device.

### Stack

| Part | Choice | Why |
| --- | --- | --- |
| Game client | Vite + TypeScript; PixiJS for drawing the level; plain HTML and CSS for menus and buttons | Fast on cheap phones, small download, no install |
| Shared game logic | One TypeScript package used by both client and server | The same rules everywhere; Solo Practice runs fully offline |
| Hosting for the site | Cloudflare Pages (global CDN) | Free tier, fast in India and abroad |
| Room server | Cloudflare Workers + Durable Objects, one object per room, WebSockets | Rooms scale automatically; no servers to manage |
| Saved data | Cloudflare D1 (SQL database) for crew codes and Daily leaderboards | Same platform, small data |
| Analytics | Google Analytics 4 with custom game events | Free; tracks levels, deaths, sessions, ad results |

### How a level runs

1. The server holds the real game state. Players send only button presses; the server checks that the sender owns that button.
2. Timed hazards follow a fixed schedule from the level's start time, so every device draws them itself in sync. Devices sync their clocks with the server using ping messages.
3. The server sends small events only when something changes: Spud moved, died, reached a checkpoint, a lever flipped, buttons reshuffled.
4. Devices animate smoothly between events. Because Spud moves in steps, a delay of 100 to 200 ms feels like normal chaos, not lag.
5. The game logic is written as one function, `advance(state, untilTime)`, with no randomness except a seed. That makes it testable, lets the solver check every level, and allows a cheaper server mode later (see Costs).

### Messages (JSON in v1)

| Direction | Message | Contents |
| --- | --- | --- |
| Device → server | `join` | room code, nickname, skin, reconnect token |
| Device → server | `press` | button, sequence number |
| Device → server | `ready`, `emote`, `ping` | ready state, emote id, timestamp |
| Host → server | `host` | start level, pick level, kick player, lock room |
| Server → device | `welcome` | player id, reconnect token, room state |
| Server → device | `room` | players, host, mode, selected level |
| Server → device | `levelStart` | level id, seed, start time, button assignments |
| Server → device | `spud` | position, facing, state, server time, who pressed |
| Server → device | `event` | death, checkpoint, lever, shuffle, golden chip, finish |
| Server → device | `results`, `pong` | stats and awards; clock sync |

### Rooms, safety and limits

- Room codes: 5 characters from `ABCDEFGHJKMNPQRSTUVWXYZ23456789` (no 0/O or 1/I), about 28 million combinations. A new code is retried if taken.
- Join attempts are limited per IP address (for example 10 per minute) so codes cannot be guessed.
- Presses are limited to 15 per second per player; messages over 1 KB are dropped.
- Rooms hold 10 players (100 in Crowd Mode) and are deleted 15 minutes after the last player leaves.
- Reconnect tokens are kept in the browser for 60 seconds of grace.
- No free text chat; preset emotes only. Nicknames and team names pass a bad-word filter (English and Hindi).

### Scaling plan

| Stage | Concurrent players | What changes |
| --- | --- | --- |
| Prototype | Under 50 | Workers Free plan is enough |
| Launch | 100 (about 30 rooms) | Workers Paid plan; nothing else |
| Growing | 1,000 to 10,000 | Nothing in the design; watch the bill and errors; load-test before every big promotion |
| Viral | 10,000+ | Switch to the cheaper event-driven server mode; move messages from JSON to a compact binary format; add a status page |

Before launch, a bot script must load-test one Crowd room with 100 fake players and 300 normal rooms at once.

### Costs (Cloudflare prices as of October 2026)

- Durable Objects work on the Workers Free plan (daily limits) and the Workers Paid plan, which has a $5 monthly minimum and includes 1 million requests and 400,000 GB-s of compute each month. Beyond that, compute costs $12.50 per million GB-s. Incoming WebSocket messages are billed at 20 messages per request. [source](https://developers.cloudflare.com/durable-objects/platform/pricing/)
- A room kept active for one hour uses about 460 GB-s, roughly $0.006 per room-hour. With 4 players per room, that is about $0.0015 per player-hour.
- Example: 3,000 rooms active for 8 hours a day would cost roughly $4,000 a month. Ad income at that scale should be far higher with Tier-1 traffic, but with mostly low-paying traffic the server bill can eat a large share.
- The cheaper mode for that stage: Cloudflare does not charge compute time while a room is idle and allowed to hibernate. The room then stops running a constant timer, wakes on each press, and sets an alarm for the next scheduled event (for example a blade hitting a standing Spud). This needs the `advance(state, untilTime)` design above, so build it that way from day one.

## Website and SEO pages

The game alone will not pass AdSense review; the site also needs 15 to 25 original, useful pages that people search for. Target adult, high-value searches such as remote-team and party-game queries.

| Page | Purpose | Example search it targets |
| --- | --- | --- |
| Home (game + short intro) | Play instantly; explains the game in 3 lines | "funny multiplayer game in browser" |
| How to Play | Rules, buttons, modes, with pictures | "how to play spud squad" |
| World guides (5 pages) | Tips and tricks per world, without full spoilers | "slicer hall level 2-9 tips" |
| Daily Spud page and archive | Today's level plus past levels as pages | "daily co-op puzzle game" |
| Crowd Mode for streamers | Setup guide for streams and events | "games to play with twitch chat" |
| Blog: games for remote teams | Icebreakers for video calls | "online team building games for remote teams" |
| Blog: party games on phones | Games for parties and hostels | "party games to play on phone with friends" |
| Blog: games for Discord calls | Group games without downloads | "games to play on discord with friends no download" |
| Blog: browser games without login | List-style guide, honest, includes us | "multiplayer games no login" |
| About, Contact, Privacy Policy, Terms | Required for trust and AdSense | n/a |

**Page rules:**

- Real words written for people, 800 to 1,500 words per guide, with our own screenshots and GIFs. Claude can draft; we edit and add real playtest insights.
- Each page has a title, meta description, social preview image and structured data (FAQ on guides, VideoGame on the home page).
- Pages must load fast on phones (Lighthouse performance score of 90 or more).
- Privacy Policy covers cookies, Google ads, analytics, the consent message and data rights (GDPR for Europe and India's DPDP Act).
- Set up Google Search Console and a sitemap on launch day.

## Build plan and Codex prompts

Build in 7 milestones over about 12 weeks, and do not build content until the 3-level prototype has proven that groups laugh and ask for more.

&#91;embedded content: build roadmap · 7 milestones, 1 gate\]

M1 is the only milestone with a go or no-go test; everything after it assumes the core is fun.

### Setup before the first prompt

1. Export this document as Markdown and save it in the repo as `docs/design.md`.
2. Save the text below as `AGENTS.md` in the repo root. Codex reads it automatically before every task.
3. Give Codex one milestone prompt at a time. After each, run the review prompt, then play it yourself on a phone and a laptop.

### AGENTS.md (paste into the repo root)

```markdown
# Spud Squad: rules for coding agents

Product: a browser party game. 2-10 players (Crowd Mode: up to 100) share control of one potato, Spud, on a tile grid. Each player owns only some buttons (UP, DOWN, LEFT, RIGHT, GRAB, plus STOP or JUMP in later worlds). No login. Private rooms joined by a 5-character code. Phone (portrait first) and laptop browsers.

Source of truth: docs/design.md. If code and the doc disagree, stop and ask.

Repo (pnpm workspaces):
- packages/shared: pure TypeScript game logic. No DOM, no network, no Date.now(); time is always passed in. Deterministic given (level, seed, presses).
  API: createLevelState(level, seed, playerIds), applyPress(state, playerId, button, t), advance(state, untilT) -> { state, events }.
- apps/client: Vite + TypeScript + PixiJS for the level; HTML/CSS for menus and buttons.
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
```

### Milestone 1: playable prototype (weeks 1 to 2)

```text
Read AGENTS.md and docs/design.md. Build Milestone 1, a playable prototype:
1. Set up the pnpm monorepo exactly as AGENTS.md describes, with Vitest, ESLint, Prettier and Wrangler.
2. packages/shared: level JSON schema and loader; grid movement with the 150 ms hop and one-slot press buffer; tiles floor, wall, exit, checkpoint, key card + door, lever (GRAB on the faced tile), conveyor belt; death and respawn at checkpoint; button assignment for 1-5 players as in the design doc table. Unit tests for every rule.
3. apps/server: Worker routes POST /rooms (creates a room, returns a 5-character code from ABCDEFGHJKMNPQRSTUVWXYZ23456789) and GET /rooms/:code/ws (WebSocket into that room's Durable Object). The room implements the join, press, ready, host, ping messages and the welcome, room, levelStart, spud, event, results, pong messages from the design doc. Run a 10 Hz loop only while a level is running. Reconnect token with 60 s grace.
4. apps/client: Home (Create, Join), Lobby, Play, Results screens. Phone portrait layout: level on top 60%, own buttons on the bottom 40%. Laptop: arrow keys, Space, Shift. Coloured hands with names show who pressed. Placeholder art: a brown circle with eyes for Spud, flat coloured tiles.
5. Three levels in levels/: 1-1, 1-4 and 1-6 from the design doc.
6. README with how to run locally and test with two phones on the same Wi-Fi.
Deliver in steps: first the plan and file tree (wait for my OK), then shared logic + tests, then server, then client. At the end, list what I should test by hand.
```

**Gate:** at least 5 groups of 3 to 5 people play it; at least 4 of 5 groups ask to play another level. If not, change the core before building more.

### Milestone 2: all mechanics and the level pipeline (weeks 3 to 4)

```text
Read AGENTS.md and docs/design.md. Build Milestone 2:
1. Implement every element in the Mechanics catalog table (all 23), including timed schedules computed from level start time, the group-size factor, STOP, JUMP, crates as rafts, darkness with the rotating Lantern player, teleport pipes and shuffle sirens. Unit tests for each.
2. tools/solver: finds the shortest solution for a level (BFS over Spud position, held crate, keys and lever states, with hazard timing), reports if a level is unsolvable, and computes par time with the design-doc formula.
3. tools/validate: checks every JSON file against the schema and the solver; runs in CI.
4. tools/editor: a dev-only browser editor to paint tiles, place objects, set timers, test-play and export JSON.
5. Build all 20 levels of Worlds 1 and 2 from the design-doc tables. Every level must pass the validator.
```

### Milestone 3: full interface (weeks 5 to 6)

```text
Read AGENTS.md and docs/design.md. Build Milestone 3, the full interface from the Screens and UX flows section: Home, Create Room with QR code and share button, Join with nickname and skin, Lobby with world map and kick, 2-second level intro showing "YOUR BUTTONS", Play layouts for phone portrait, phone landscape and laptop, Results with stars and the five blame awards, Settings (sound, music, vibration, colour-blind shapes, reduced motion, left-handed layout), plus every edge case listed (reconnect, host leaves, phone locked, room full, wrong code, refresh). Add Solo Practice. Save the device profile in localStorage wrapped in try/catch. Write Playwright tests for create, join, play one level and results with two browser contexts.
```

### Milestone 4: content, art and sound (weeks 7 to 9)

```text
Read AGENTS.md and docs/design.md. Build Milestone 4:
1. Build the 30 levels of Worlds 3, 4 and 5 from the design-doc tables; all must pass the validator.
2. Replace placeholder art with the final art pack in assets/ (I will provide the files): Spud animations (idle, hop, panic, poof into fries, respawn), tiles and hazards per world with warning frames, skins.
3. Add sounds and one music loop per world with a mute switch; unlock audio on the first tap (iPhone requirement).
4. Add a balancing log: per level, record attempts, deaths by hazard, time and group size to analytics events so we can tune difficulty.
```

### Milestone 5: modes and saved data (weeks 9 to 10)

```text
Read AGENTS.md and docs/design.md. Build Milestone 5:
1. Daily Spud: a level per UTC day from a pre-made list; leaderboard in D1 split by group size; team names filtered; one-tap share text.
2. Party Mode: random 3-level playlists from unlocked levels.
3. Crowd Mode: host laptop view with room code, QR code and live vote bars; up to 100 players split into button teams; vote mode (400 ms windows, most presses wins, ties go to the earliest) and chaos mode; kick and lock.
4. Crew codes: 6-character code saving unlocked levels and best stars in D1; deleted after 90 days unused.
5. Skins unlocked by Golden Chips; seasonal skins switched on by date.
6. Share card: draw a PNG in the browser with level, time, deaths and top award.
7. tools/loadtest: bots that fill one Crowd room with 100 players and run 300 normal rooms; report message latency and errors.
```

### Milestone 6: website, analytics and ads (weeks 10 to 11)

```text
Read AGENTS.md and docs/design.md. Build Milestone 6:
1. Static pages from the Website and SEO section (How to Play, 5 world guides, Daily archive, Crowd Mode guide, blog page template, About, Contact, Privacy Policy, Terms) with titles, meta descriptions, social images, structured data and a sitemap. I will supply final text.
2. GA4 with events: room_created, room_joined, level_started, level_finished, death, ad_break_result, share_clicked.
3. ads.ts wrapper for H5 Games Ads exactly as the Monetization section describes: interstitial after Ready on results and on entering a room; rewarded Skip Level and Extra Checkpoint (button shown only when an ad is available, reward only after full view); server waits for all players or 35 s; frequency hint 150 s; test mode in development; safe no-op when ads are missing or blocked.
4. No display ads on any game screen; on content pages keep them at least 150 px from game areas.
```

### Milestone 7: hardening and launch (week 12)

```text
Read AGENTS.md and docs/design.md. Build Milestone 7: run the load test and fix bottlenecks; verify every rate limit and message validation with tests; add error reporting and a simple status page; check Lighthouse (performance 90+, accessibility 95+) on phone; test on Android Chrome, iPhone Safari, laptop Chrome, Firefox and Edge; write a launch checklist and a rollback plan.
```

### Review prompt (run after every milestone)

```text
Review the code from this milestone as four experts in turn:
1. Game designer: does it match docs/design.md exactly? Is anything confusing for a first-time player on a phone?
2. Multiplayer engineer: can a client cheat, desync, crash the room or flood messages? Are reconnects and host changes correct?
3. AdSense policy specialist: any ad during play, near buttons, unexpected, back-to-back, or any text asking for clicks?
4. Performance engineer: frame rate on a mid-range Android phone, bundle size, memory leaks, battery use.
List every issue with file and line and a fix, then apply the fixes and re-run all tests.
```

## Launch and growth plan

Growth comes from groups inviting groups and from short funny clips; paid ads are not part of the plan.

1. **Private playtests (during M1 to M4):** at least 20 groups: friends, college and hostel groups in Pune, office teams, Discord servers. Record screens (with permission) and note every moment people laugh, get confused or quit.
2. **Soft launch (week 12):** share with the playtest groups and 3 to 5 small online communities. Fix the top 10 problems before any big push.
3. **Clips:** post 3 short videos a week on YouTube Shorts, Instagram Reels and X: real fail moments, the blame awards, Crowd Mode chaos. Each clip ends with the site name.
4. **Streamers:** contact 30 to 50 small and mid-size streamers (Twitch, YouTube, and Indian gaming creators) with a 30-second Crowd Mode demo. Small streamers reply more often, and their viewers become hosts.
5. **Communities:** Reddit r/WebGames, r/playmygame and r/IndieGaming, following each group's self-promotion rules; Discord game-night servers; Product Hunt.
6. **Remote-team angle:** a LinkedIn post and a blog page on "5-minute icebreaker games for remote teams"; this audience is adult and in high-paying ad markets.
7. **Portals (optional, later):** a separate build for CrazyGames or similar, after checking each portal's multiplayer rules and revenue terms.
8. **Seasonal moments:** Halloween and Diwali skins, Christmas world, a Daily Spud tournament weekend.

### Numbers to watch every week

| Metric | What it tells us | Early target |
| --- | --- | --- |
| Rooms created per day | Reach | Growing week over week |
| Average players per room | Spread through invites | 3 or more |
| Levels played per room | Is it fun? | 5 or more |
| Day-7 return rate of hosts | Will they come back? | 15% or more |
| Share-button taps per 100 rooms | Viral pull | 10 or more |
| Ad revenue per 1,000 player-sessions, by country | Money | Track; compare with server cost |

These targets are starting guesses to judge against our own trend, not industry benchmarks.

## Risks and open decisions

The biggest risk is that shared control is less fun than it sounds; the M1 gate exists to find that out in 2 weeks, not 12.

| Risk | Impact | What we do |
| --- | --- | --- |
| Core is not fun enough | Everything else is wasted | M1 gate with 5 groups; change button rules or level pacing before building more |
| Name already trademarked | Forced rename after launch | Trademark and domain search before any branding work |
| AdSense or H5 Games Ads not approved | No income at launch | Original guide pages, policy-clean ads, reapply after fixes; game works without ads |
| Server bill grows faster than ad income | Losses if traffic is mostly low-paying | Watch revenue vs cost per 1,000 sessions; switch to the hibernating server mode; target Tier-1 audiences |
| Lag on slow mobile networks | Frustration | Step-based movement; hazards drawn locally; test on 4G in India and through a VPN abroad |
| Trolls in Crowd Mode | Ruined streams | Vote mode by default, kick and lock, no free text |
| iPhone browser limits | Missing sound or vibration | Unlock audio on first tap; flash instead of vibration |
| Copycats if it goes viral | Lost traffic | Ship new worlds and features fast; build the brand and community |

### Decisions still open

- [ ] Final game name, after trademark and domain checks
- [ ] Art style sample: approve one Spud drawing and one tile set before Milestone 4
- [ ] Who makes the art and sound (us with tools, or a freelancer), with commercial rights in writing
- [ ] Default room size limit: 10, or 8 for easier balancing
- [ ] Launch languages: English only, or English and Hindi
- [ ] Whether to offer the game to portals at launch or only after the site has traffic

### Sources

- [Cloudflare Durable Objects pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/) (page updated 18 October 2026)
- [Google AdSense Program policies](https://support.google.com/adsense/answer/48182)
- [Google Ad Placement API (H5 Games Ads) reference](https://developers.google.com/ad-placement/apis)
