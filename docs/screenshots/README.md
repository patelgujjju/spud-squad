# Three.js factory captures

These are full-page Playwright captures from real two-player rooms, using High graphics. Portrait cameras follow the local section of long boards to keep tiles readable. The conveyor carries Spud to the saw corridor on 1-6; on 2-1 he waits beside the blade after activating the checkpoint.

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
