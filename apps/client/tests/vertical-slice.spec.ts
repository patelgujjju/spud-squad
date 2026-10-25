import { expect, test } from '@playwright/test';
import type { Browser, Page, BrowserContext } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { recordGameplay } from './recording.js';

test.use({ trace: 'off' });
const directory = fileURLToPath(
  new URL('../../../docs/screenshots/', import.meta.url),
);
async function start(
  page: Page,
  browser: Browser,
  level: string,
): Promise<{ page: Page; context: BrowserContext }> {
  await page.context().setExtraHTTPHeaders({
    'CF-Connecting-IP': 'slice-' + crypto.randomUUID(),
  });
  await page.addInitScript(() =>
    localStorage.setItem('spud.graphics-quality', 'high'),
  );
  await page.goto('http://127.0.0.1:5173/');
  await page.getByLabel('Your nickname').fill('Morgan');
  await page.getByRole('button', { name: 'Create a room' }).click();
  const code = await page.getByTestId('room-code').textContent();
  const context = await browser.newContext({
    extraHTTPHeaders: { 'CF-Connecting-IP': 'slice-' + crypto.randomUUID() },
  });
  await context.addInitScript(() =>
    localStorage.setItem('spud.graphics-quality', 'low'),
  );
  const guest = await context.newPage();
  await guest.goto('http://127.0.0.1:5173/r/' + code);
  await guest.getByLabel('Your nickname').fill('Casey');
  await guest.getByRole('button', { name: 'Join room', exact: true }).click();
  await page.locator('[data-level="' + level + '"]').click();
  for (const member of [page, guest])
    await member
      .getByRole('button', { name: 'I’m ready', exact: true })
      .click();
  await page.getByRole('button', { name: 'Start level' }).click();
  await expect(page.getByTestId('board')).toHaveAttribute(
    'data-renderer',
    'factory',
    { timeout: 30_000 },
  );
  await expect(page.getByTestId('board')).toHaveAttribute(
    'data-ready',
    'true',
    { timeout: 90_000 },
  );
  await expect(page.getByTestId('board')).toHaveAttribute(
    'data-camera',
    'follow',
    { timeout: 20_000 },
  );
  return { page: guest, context };
}
async function press(
  pages: Page[],
  button: string,
  position?: string,
): Promise<void> {
  for (const page of pages) {
    const control = page.locator('[data-button="' + button + '"]');
    if (!(await control.count())) continue;
    await expect(control).toBeEnabled({ timeout: 90_000 });
    await control.dispatchEvent('pointerdown', {
      pointerId: 3,
      pointerType: 'touch',
      button: 0,
    });
    await control.dispatchEvent('pointerup', {
      pointerId: 3,
      pointerType: 'touch',
    });
    break;
  }
  if (position)
    await expect(pages[0]!.getByTestId('board')).toHaveAttribute(
      'data-position',
      position,
    );
  await expect(pages[0]!.getByTestId('board')).toHaveAttribute(
    'data-hero-visible',
    'true',
  );
  await pages[0]!.waitForTimeout(400);
}
for (const level of ['1-1', '2-1']) {
  test('factory slice ' + level, async ({ page, browser }, info) => {
    test.skip(
      info.project.name === 'phone-360',
      'Exports requested at 390×844 and 1366×768.',
    );
    test.setTimeout(150_000);
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    const guest = await start(page, browser, level);
    try {
      if (level === '2-1')
        for (const x of [2, 3, 4])
          await press([page, guest.page], 'RIGHT', x + ',1');
      if (level === '2-1')
        await expect(page.getByTestId('board')).toHaveAttribute(
          'data-saw-raised',
          'true',
          { timeout: 15_000 },
        );
      const size = page.viewportSize()!;
      const game = (await page.locator('.game-top').boundingBox())!;
      if (size.width < 760)
        expect(game.height).toBeGreaterThanOrEqual(size.height * 0.68);
      await expect(page.getByTestId('board')).toHaveAttribute(
        'data-hero-visible',
        'true',
      );
      await expect(page.locator('.play-hud')).not.toBeVisible();
      await expect(
        page.getByRole('button', { name: 'Hold to see whole room' }),
      ).toBeVisible();
      await page.bringToFront();
      await page.waitForTimeout(500);
      await mkdir(directory, { recursive: true });
      await page.screenshot({
        path:
          directory +
          '/' +
          level +
          '-' +
          size.width +
          'x' +
          size.height +
          '.png',
      });
      const eye = page.getByRole('button', { name: 'Hold to see whole room' });
      await eye.dispatchEvent('pointerdown', {
        pointerId: 8,
        pointerType: 'touch',
        button: 0,
      });
      await expect(page.getByTestId('board')).toHaveAttribute(
        'data-camera',
        'overview',
      );
      await page.waitForTimeout(700);
      await page.screenshot({ path: info.outputPath('room-overview.png') });
      await eye.dispatchEvent('pointerup', {
        pointerId: 8,
        pointerType: 'touch',
      });
      await expect(page.getByTestId('board')).toHaveAttribute(
        'data-camera',
        'follow',
      );
      expect(errors).toEqual([]);
    } finally {
      await guest.context.close();
    }
  });
}

test.describe('factory gameplay recordings', () => {
  for (const level of ['1-1', '2-1']) {
    test('record ten seconds ' + level, async ({ browser }, info) => {
      test.skip(
        process.env.CAPTURE_SLICE_VIDEO !== '1' ||
          info.project.name !== 'laptop',
        'Run pnpm --filter @spud-squad/client capture:slice to export review videos.',
      );
      test.setTimeout(150_000);
      const context = await browser.newContext({
        viewport: { width: 1366, height: 768 },
      });
      const page = await context.newPage();
      const guest = await start(page, browser, level);
      await expect(guest.page.getByTestId('board')).toHaveAttribute(
        'data-ready',
        'true',
        { timeout: 90_000 },
      );
      // Only the recorded viewport needs continuous drawing. Guest inputs and
      // WebSocket processing stay live; pausing its RAF saves the software GPU.
      await guest.page.evaluate(() => {
        window.requestAnimationFrame = () => 0;
      });
      const finishRecording = await recordGameplay(page, info);
      const began = Date.now();
      try {
        await page.bringToFront();
        const pages = [page, guest.page];
        if (level === '1-1') {
          for (const [button, position] of [
            ['RIGHT', '2,1'],
            ['RIGHT', '3,1'],
            ['RIGHT', '4,1'],
            ['DOWN', '4,2'],
            ['DOWN', '4,3'],
            ['RIGHT', '5,3'],
            ['RIGHT', '6,3'],
            ['LEFT', '5,3'],
            ['LEFT', '4,3'],
          ])
            await press(pages, button!, position);
        } else {
          for (const x of [2, 3, 4]) await press(pages, 'RIGHT', x + ',1');
          // A real hazard collision demonstrates the authoritative death and checkpoint respawn.
          await press(pages, 'RIGHT');
          await expect(page.locator('.death-counter')).toHaveAttribute(
            'data-count',
            '1',
            { timeout: 10_000 },
          );
          await expect(page.getByTestId('board')).toHaveAttribute(
            'data-position',
            '3,1',
            { timeout: 10_000 },
          );
          await press(pages, 'RIGHT', '4,1');
          await page.screenshot({ path: info.outputPath('after-respawn.png') });
        }
        await page.waitForTimeout(Math.max(0, 10_500 - (Date.now() - began)));
        await mkdir(directory, { recursive: true });
        await finishRecording(directory + '/' + level + '-gameplay.webm');
      } finally {
        await context.close();
        await guest.context.close();
      }
    });
  }
});
