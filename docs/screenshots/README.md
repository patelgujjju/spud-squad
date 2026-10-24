# Floating diorama captures and visual review

These are full-page Playwright captures from real two-player rooms using High graphics. The fixed 62-degree camera fits the entire floating room on every viewport. The conveyor carries Spud to the saw corridor on 1-6; on 2-1 he waits beside the blade after activating the checkpoint.

| Level               | Phone, 390×844         | Laptop, 1366×768        |
| ------------------- | ---------------------- | ----------------------- |
| 1-1 · Wake Up, Spud | [PNG](1-1-390x844.png) | [PNG](1-1-1366x768.png) |
| 1-6 · Belt Up       | [PNG](1-6-390x844.png) | [PNG](1-6-1366x768.png) |
| 2-1 · Chop Chop     | [PNG](2-1-390x844.png) | [PNG](2-1-1366x768.png) |

Regenerate from Windows PowerShell in `F:\Spud-Squad`:

```powershell
pnpm --filter @spud-squad/client test --grep "factory screenshot" --project=phone-390 --project=laptop --trace=off
```

The test runner starts local Wrangler and Vite if they are not already running. These software WebGL captures verify appearance and layout; they do not measure physical phone performance.

## Review against the art bible

All six final PNGs were opened and inspected. The paths stay visible above the low counters; Spud, the Golden Chip and the arrow-only exit are distinct at a glance. Saws are visible on 1-6 and 2-1; 1-1 intentionally contains no saw. The full base fits with a small margin and no path decoration. The phone game view measures 68% of viewport height; the complete controls tray measures 32%. The laptop button grid stays below 720 px wide and players use floating chips.

Counter tops, bolt panels and bolts remain below 0.35 tile high (the highest bolt reaches 0.349). Exactly one bolt panel is added per six wall tiles, and no orange pipes remain. Baked dark counter feet keep edges readable with shadows disabled. Bloom is restricted to the exit, reward and warning layers and is skipped in Low or downgraded Auto quality.

The first two complete visual passes are retained in `pass-1/` and `pass-2/`. Reviewing pass 1 caught the edge-on chip, cramped phone title and inconsistent second-button alignment. Pass 2 keeps the chip face visible, adds reward stars, enlarges the exit arrow and corrects those UI issues. The final gallery adds the cream control tray, correct world captions, readable hand-name sizing and persistent press ripples.

Browser coverage includes portrait and landscape sizing, multi-pointer feedback, keyboard ownership, reconnect, graphics persistence, real slicer death/checkpoint respawn, Results confetti and three-device play. Software WebGL startup checks allow 30 seconds; physical Android frame rate and thermal behavior still need a device test.
