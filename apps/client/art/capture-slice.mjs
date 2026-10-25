import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
const require = createRequire(import.meta.url);
const channel =
  process.env.SPUD_CAPTURE_BROWSER ??
  (process.platform === 'win32' &&
  existsSync('C:/Program Files/Google/Chrome/Application/chrome.exe')
    ? 'chrome'
    : process.platform === 'win32' &&
        existsSync(
          'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
        )
      ? 'msedge'
      : 'chromium');
const result = spawnSync(
  process.execPath,
  [
    require.resolve('@playwright/test/cli'),
    'test',
    'vertical-slice.spec.ts',
    '--project=phone-390',
    '--project=laptop',
    ...process.argv.slice(2),
  ],
  {
    stdio: 'inherit',
    windowsHide: true,
    env: {
      ...process.env,
      CAPTURE_SLICE_VIDEO: '1',
      SPUD_CAPTURE_BROWSER: channel,
    },
  },
);
process.exitCode = result.status ?? 1;
