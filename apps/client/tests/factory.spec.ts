import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import type { Browser, Page } from '@playwright/test';
import { AdaptiveQuality } from '../src/game/three/performance.js';

test.use({ trace: 'off' });

// Real room traffic drives screenshots; no alternate simulation or drawing fixture.
async function factory(page: Page, browser: Browser, level: string) {
  await page
    .context()
    .setExtraHTTPHeaders({ 'CF-Connecting-IP': `art-${crypto.randomUUID()}` });
  await page.addInitScript(() => {
    if (!localStorage.getItem('spud.graphics-quality'))
      localStorage.setItem('spud.graphics-quality', 'high');
  });
  await page.goto('/');
  await page.getByLabel('Your nickname').fill('Milo');
  await page.getByRole('button', { name: 'Create a room' }).click();
  const code = await page.getByTestId('room-code').textContent();
  const context = await browser.newContext({
    extraHTTPHeaders: { 'CF-Connecting-IP': `art-${crypto.randomUUID()}` },
  });
  await context.addInitScript(() =>
    localStorage.setItem('spud.graphics-quality', 'low'),
  );
  const guest = await context.newPage();
  await guest.goto(`http://127.0.0.1:5173/r/${code}`);
  await guest.getByLabel('Your nickname').fill('Fern');
  await guest.getByRole('button', { name: 'Join room', exact: true }).click();
  await expect(guest.locator('[data-screen="lobby"]')).toBeVisible();
  await page.locator(`[data-level="${level}"]`).click();
  for (const member of [page, guest])
    await member
      .getByRole('button', { name: 'I’m ready', exact: true })
      .click();
  await expect(page.getByRole('button', { name: 'Start level' })).toBeEnabled();
  await page.getByRole('button', { name: 'Start level' }).click();
  await expect(page.getByTestId('board')).toHaveAttribute(
    'data-renderer',
    'three',
    { timeout: 30_000 },
  );
  await expect(page.getByTestId('board')).toHaveAttribute('data-ready', 'true');
  return { context, guest };
}

async function right(pages: Page[], position: string): Promise<void> {
  for (const page of pages) {
    const control = page.locator('[data-button="RIGHT"]');
    if (!(await control.count())) continue;
    await control.dispatchEvent('pointerdown', {
      pointerId: 1,
      pointerType: 'touch',
      button: 0,
    });
    await control.dispatchEvent('pointerup', {
      pointerId: 1,
      pointerType: 'touch',
    });
    break;
  }
  await expect(pages[0]!.getByTestId('board')).toHaveAttribute(
    'data-position',
    position,
  );
}

for (const level of ['1-1', '1-6', '2-1']) {
  test(`factory screenshot ${level}`, async ({ page, browser }, info) => {
    test.skip(
      info.project.name === 'phone-360',
      'The requested exports are 390×844 and 1366×768.',
    );
    test.setTimeout(90_000);
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    const partner = await factory(page, browser, level);
    try {
      if (level === '2-1') {
        for (const x of [2, 3, 4]) await right([page, partner.guest], `${x},1`);
      }
      if (level === '1-6') {
        await right([page, partner.guest], '2,1');
        await right([page, partner.guest], '3,1');
        // The shared engine carries Spud across the belt. Stop safely before the saw.
        await expect(page.getByTestId('board')).toHaveAttribute(
          'data-position',
          '7,1',
        );
        await right([page, partner.guest], '8,1');
      }
      await page.bringToFront();
      // Observe the actual drawn blade, with no narrow remote HUD polling window.
      await page.waitForTimeout(900);
      if (level !== '1-1') {
        await page.waitForFunction(
          () =>
            document
              .querySelector('[data-testid="board"]')
              ?.getAttribute('data-saw-raised') === 'true',
          undefined,
          { timeout: 15_000 },
        );
      }
      const size = page.viewportSize()!;
      const directory = fileURLToPath(
        new URL('../../../docs/screenshots/', import.meta.url),
      );
      await mkdir(directory, { recursive: true });
      const game = (await page.locator('.game-top').boundingBox())!;
      const controls = (await page.locator('.controls').boundingBox())!;
      if (size.width < 760) {
        expect(game.height).toBeGreaterThanOrEqual(size.height * 0.66);
        expect(controls.height).toBeLessThanOrEqual(size.height * 0.34);
      } else {
        expect(
          (await page.locator('.button-grid').boundingBox())!.width,
        ).toBeLessThanOrEqual(720);
      }
      const framing = JSON.parse(
        (await page.getByTestId('board').getAttribute('data-room-bounds'))!,
      ) as number[];
      expect(framing.every((edge) => Math.abs(edge) < 0.95)).toBe(true);
      await page.screenshot({
        path: `${directory}/${level}-${size.width}x${size.height}.png`,
      });
      await expect(page.getByTestId('board')).toHaveAttribute(
        'data-quality',
        'high',
      );
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      expect(errors).toEqual([]);
    } finally {
      await partner.context.close();
    }
  });
}

test('quality settings switch immediately and persist through reconnect', async ({
  page,
  browser,
}) => {
  test.setTimeout(90_000);
  const partner = await factory(page, browser, '1-1');
  try {
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await page.getByRole('radio', { name: /^Low/ }).check();
    await expect(page.getByTestId('board')).toHaveAttribute(
      'data-quality',
      'low',
    );
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    await page.reload();
    await expect(page.getByTestId('board')).toHaveAttribute(
      'data-ready',
      'true',
      { timeout: 30_000 },
    );
    await expect(page.getByTestId('board')).toHaveAttribute(
      'data-quality',
      'low',
    );
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await expect(page.getByRole('radio', { name: /^Low/ })).toBeChecked();
    await page.getByRole('radio', { name: /^High/ }).check();
    await expect(page.getByTestId('board')).toHaveAttribute(
      'data-quality',
      'high',
    );
  } finally {
    await partner.context.close();
  }
});

test('auto quality requires sustained slow frames, resets after pauses, and respects manual quality', () => {
  const quality = new AdaptiveQuality();
  for (let frame = 0; frame < 75; frame++) quality.frame(1 / 30);
  expect(quality.detailed).toBe(true);
  for (let frame = 0; frame < 100; frame++) quality.frame(1 / 60);
  for (let frame = 0; frame < 75; frame++) quality.frame(1 / 30);
  expect(quality.detailed).toBe(true);
  quality.resetSample(); // Visibility changes reset observation, not selected quality.
  for (let frame = 0; frame < 95; frame++) quality.frame(1 / 30);
  expect(quality.detailed).toBe(false);
  quality.setMode('high');
  for (let frame = 0; frame < 120; frame++) quality.frame(1 / 20);
  expect(quality.detailed).toBe(true);
  quality.setMode('low');
  expect(quality.detailed).toBe(false);
  quality.setMode('auto');
  expect(quality.detailed).toBe(true);
  for (let frame = 0; frame < 3; frame++) quality.frame(1);
  expect(quality.detailed).toBe(false); // Very slow frames must also trigger the fallback.
});
