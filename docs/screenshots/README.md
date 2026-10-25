# Indoor factory slice: captures and visual review

These full-page Playwright captures use real two-player rooms and High graphics. Levels 1-1 and 2-1 use the enclosed factory renderer, a close following camera, dark glass HUD and 70% phone gameplay allocation. In 2-1 Spud waits beside the slicer after activating the checkpoint. The test also holds and releases the eye view to verify the whole-room camera.

| Level               | Phone, 390×844         | Laptop, 1366×768        |
| ------------------- | ---------------------- | ----------------------- |
| 1-1 · Wake Up, Spud | [PNG](1-1-390x844.png) | [PNG](1-1-1366x768.png) |
| 2-1 · Chop Chop     | [PNG](2-1-390x844.png) | [PNG](2-1-1366x768.png) |

Regenerate from Windows PowerShell in `F:\Spud-Squad`:

```powershell
pnpm --filter @spud-squad/client capture:slice
```

The runner starts local Wrangler and Vite if needed. Windows uses isolated installed Chrome, falling back to Edge; other platforms use Playwright's full Chromium. `$env:SPUD_CAPTURE_BROWSER` overrides the browser channel. FFmpeg is at `C:\ffmpeg\bin\ffmpeg.exe` on this laptop; set `$env:FFMPEG_PATH` to override. These captures verify appearance and layout, not physical phone frame rate.

## Gameplay videos

- [1-1 — ten seconds of gameplay](1-1-gameplay.webm): two players steer through the route, collect the Golden Chip and demonstrate the following camera and named hand feedback.
- [2-1 — ten seconds of gameplay](2-1-gameplay.webm): checkpoint, active blade, real authoritative death, fry animation and checkpoint respawn.

Playwright records the actual browser at 1366×768 after shader warmup. FFmpeg encodes the timestamped frames into exactly 10 seconds of WebM. The guest client's drawing pauses only after it is ready, saving capture GPU time while its normal controls and WebSocket processing stay active. No drawing fixture or alternate simulation drives these recordings.

## Visual checks

The PNGs are opened during review to check the enclosure, safety-lined path and visible Spud. The camera follows locally instead of fitting a floating board. Brick/paint walls, daylight window, CRISPY CO. sign, lamps and continuous floor establish the room. Ceramic and steel have distinct PBR surfaces. Interactive machines retain their silhouettes; foreground props, walls and their shadows dither away when they hide Spud or the local path. The phone game area is 70% of viewport height; controls occupy 30%. Desktop controls stay at most 720 px wide.

Earlier 1-6 PNGs and `pass-1/` / `pass-2/` are retained prototype references. They do not show the new indoor slice. Physical mid-range Android frame rate and thermal behaviour still need a device test.
