import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: {
      args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl'],
    },
  },
  reporter: [['list'], ['html', { open: 'never' }]],
  webServer: [
    {
      command: 'pnpm --filter @spud-squad/server dev',
      url: 'http://127.0.0.1:8787/health',
      cwd: '../..',
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    {
      command: 'pnpm dev',
      url: 'http://127.0.0.1:5173',
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
  projects: [
    {
      name: 'phone-360',
      use: {
        browserName: 'chromium',
        viewport: { width: 360, height: 740 },
        hasTouch: true,
        isMobile: true,
        userAgent:
          'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36',
      },
    },
    {
      name: 'phone-390',
      use: {
        browserName: 'chromium',
        viewport: { width: 390, height: 844 },
        hasTouch: true,
        isMobile: true,
      },
    },
    {
      name: 'laptop',
      use: { browserName: 'chromium', viewport: { width: 1366, height: 768 } },
    },
  ],
});
