import { expect, test } from '@playwright/test';
import type { Browser, BrowserContext, Page } from '@playwright/test';

// Continuous software WebGL and per-action trace screenshots compete for the GPU.
// Explicit Playwright screenshots still cover each viewport and the death effect.
test.use({ trace: 'off' });

type Feedback = {
  requested: number;
  released: number;
  vibrations: number;
  audio: number;
};
declare global {
  interface Window {
    feedback: Feedback;
  }
}
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    // Software WebGL smoke tests exercise Low; the factory exports exercise High.
    localStorage.setItem('spud.graphics-quality', 'low');
    const feedback = { requested: 0, released: 0, vibrations: 0, audio: 0 };
    window.feedback = feedback;
    Object.defineProperty(navigator, 'wakeLock', {
      configurable: true,
      value: {
        request: async () => {
          feedback.requested++;
          return {
            released: false,
            release: async () => {
              feedback.released++;
            },
          };
        },
      },
    });
    Object.defineProperty(navigator, 'vibrate', {
      configurable: true,
      value: () => {
        feedback.vibrations++;
        return true;
      },
    });
    const Context = window.AudioContext;
    window.AudioContext = new Proxy(Context, {
      construct(target, args) {
        feedback.audio++;
        return Reflect.construct(target, args);
      },
    });
  });
});

async function create(page: Page, name = 'Alice'): Promise<string> {
  await page
    .context()
    .setExtraHTTPHeaders({ 'CF-Connecting-IP': `test-${crypto.randomUUID()}` });
  await page.goto('/');
  await page.getByLabel('Your nickname').fill(name);
  await page.getByRole('button', { name: 'Create a room' }).click();
  await expect(page.locator('[data-screen="lobby"]')).toBeVisible();
  return (await page.getByTestId('room-code').textContent())!;
}
async function partner(
  browser: Browser,
  code: string,
  name = 'Bob',
  viewport?: { width: number; height: number },
): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({
    extraHTTPHeaders: { 'CF-Connecting-IP': `test-${crypto.randomUUID()}` },
    ...(viewport ? { viewport, hasTouch: true, isMobile: true } : {}),
  });
  await context.addInitScript(() =>
    localStorage.setItem('spud.graphics-quality', 'low'),
  );
  const page = await context.newPage();
  await page.goto(`http://127.0.0.1:5173/r/${code}`);
  await page.getByLabel('Your nickname').fill(name);
  await page.getByRole('button', { name: 'Join room', exact: true }).click();
  await expect(page.locator('[data-screen="lobby"]')).toBeVisible();
  return { context, page };
}
async function start(host: Page, guest: Page, level = '1-1'): Promise<void> {
  if (level !== '1-1') await host.locator(`[data-level="${level}"]`).click();
  await host.getByRole('button', { name: 'I’m ready', exact: true }).click();
  await guest.getByRole('button', { name: 'I’m ready', exact: true }).click();
  await expect(host.getByRole('button', { name: 'Start level' })).toBeEnabled();
  await host.getByRole('button', { name: 'Start level' }).click();
  for (const page of [host, guest]) {
    await expect(page.locator('canvas')).toBeVisible();
    await expect(page.getByTestId('board')).toHaveAttribute(
      'data-renderer',
      'three',
    );
    await expect(page.getByTestId('board')).toHaveAttribute(
      'data-ready',
      'true',
    );
    await expect(page.locator('.game-button').first()).toBeEnabled();
  }
}
async function move(
  pages: Page[],
  button: 'UP' | 'DOWN' | 'LEFT' | 'RIGHT',
  position: string,
): Promise<void> {
  for (const page of pages) {
    const control = page.locator(`[data-button="${button}"]`);
    if (await control.count()) {
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
  }
  await expect(pages[0]!.getByTestId('board')).toHaveAttribute(
    'data-position',
    position,
  );
}

test('two players create, join, play, read awards, and continue to the next level', async ({
  page,
  browser,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const code = await create(page);
  const guest = await partner(browser, code);
  try {
    await start(page, guest.page);
    const bounds = await page.locator('.game-button').evaluateAll((nodes) =>
      nodes.map((node) => ({
        w: node.getBoundingClientRect().width,
        h: node.getBoundingClientRect().height,
      })),
    );
    expect(bounds.every((rect) => rect.w >= 44 && rect.h >= 44)).toBe(true);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('play.png') });
    if (testInfo.project.name.startsWith('phone')) {
      const top = await page.locator('.game-top').boundingBox();
      const controls = await page.locator('.controls').boundingBox();
      expect(top!.y + top!.height).toBeLessThan(controls!.y + 1);
      expect(top!.height / controls!.height).toBeGreaterThan(1.3);
      const viewport = page.viewportSize()!;
      await page.setViewportSize({
        width: viewport.height,
        height: viewport.width,
      });
      await expect
        .poll(async () => {
          const a = await page.locator('.game-top').boundingBox();
          const b = await page.locator('.controls').boundingBox();
          return a!.x + a!.width <= b!.x + 1;
        })
        .toBe(true);
      await page.screenshot({ path: testInfo.outputPath('landscape.png') });
      const rotatedControls = (await page.locator('.controls').boundingBox())!;
      expect(rotatedControls.y + rotatedControls.height).toBeLessThanOrEqual(
        viewport.width + 1,
      );
      await page.setViewportSize(viewport);
    }
    const pages = [page, guest.page];
    for (const [button, position] of [
      ['RIGHT', '2,1'],
      ['RIGHT', '3,1'],
      ['RIGHT', '4,1'],
      ['DOWN', '4,2'],
      ['DOWN', '4,3'],
      ['RIGHT', '5,3'],
      ['RIGHT', '6,3'],
    ] as const)
      await move(pages, button, position);
    const last = (await page.locator('[data-button="RIGHT"]').count())
      ? page
      : guest.page;
    await last.locator('[data-button="RIGHT"]').dispatchEvent('pointerdown', {
      pointerId: 1,
      pointerType: 'touch',
      button: 0,
    });
    await expect(page.locator('[data-screen="results"]')).toBeVisible();
    await expect(guest.page.locator('[data-screen="results"]')).toBeVisible();
    for (const title of [
      'Hero Press',
      'Fryer Feeder',
      'Button Masher',
      'Asleep at the Button',
      'Clean Hands',
    ])
      await expect(
        page.getByRole('heading', { name: title, exact: true }),
      ).toBeVisible();
    await expect(
      page.locator('.award-names').filter({ hasText: 'Alice' }).first(),
    ).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('results.png') });
    const feedback = await page.evaluate(() => window.feedback);
    expect(feedback.requested).toBeGreaterThan(0);
    expect(feedback.released).toBeGreaterThan(0);
    expect(feedback.audio).toBe(1);
    if (testInfo.project.name === 'phone-360')
      expect(feedback.vibrations).toBeGreaterThan(0);
    await page
      .getByRole('button', { name: 'Ready for more', exact: true })
      .click();
    await guest.page
      .getByRole('button', { name: 'Ready for more', exact: true })
      .click();
    await expect(
      page.getByRole('button', { name: 'Next level' }),
    ).toBeEnabled();
    await page.getByRole('button', { name: 'Next level' }).click();
    await expect(page.locator('.play-level')).toContainText('1-4');
    expect(errors).toEqual([]);
  } finally {
    await guest.context.close();
  }
});

test('refresh preserves buttons; multi-pointer feedback is immediate; keyboard rejects unowned controls', async ({
  page,
  browser,
}, testInfo) => {
  const code = await create(page);
  const guest = await partner(browser, code);
  try {
    await start(page, guest.page);
    const before = await page
      .locator('.game-button')
      .evaluateAll((nodes) =>
        nodes.map((node) => (node as HTMLElement).dataset.button),
      );
    await page.reload();
    await expect(page.locator('canvas')).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('.game-button').first()).toBeEnabled();
    expect(
      await page
        .locator('.game-button')
        .evaluateAll((nodes) =>
          nodes.map((node) => (node as HTMLElement).dataset.button),
        ),
    ).toEqual(before);
    const multi = before.length >= 2 ? page : guest.page;
    const one = multi.locator('.game-button').nth(0);
    const two = multi.locator('.game-button').nth(1);
    expect(
      await one.evaluate((node) => {
        node.dispatchEvent(
          new PointerEvent('pointerdown', {
            pointerId: 41,
            pointerType: 'touch',
            button: 0,
            bubbles: true,
          }),
        );
        return node.classList.contains('is-pressed');
      }),
    ).toBe(true);
    await two.dispatchEvent('pointerdown', {
      pointerId: 42,
      pointerType: 'touch',
      button: 0,
    });
    await expect(one).toHaveClass(/is-pressed/);
    await expect(two).toHaveClass(/is-pressed/);
    await one.dispatchEvent('pointercancel', {
      pointerId: 41,
      pointerType: 'touch',
    });
    await expect(one).not.toHaveClass(/is-pressed/);
    await expect(two).toHaveClass(/is-pressed/);
    await two.dispatchEvent('pointerup', {
      pointerId: 42,
      pointerType: 'touch',
    });
    await expect(two).not.toHaveClass(/is-pressed/);
    if (testInfo.project.name.startsWith('phone')) {
      await multi.bringToFront();
      const first = (await one.boundingBox())!;
      const second = (await two.boundingBox())!;
      const cdp = await multi.context().newCDPSession(multi);
      const points = [
        { x: first.x + first.width / 2, y: first.y + first.height / 2, id: 11 },
        {
          x: second.x + second.width / 2,
          y: second.y + second.height / 2,
          id: 12,
        },
      ];
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [points[0]!],
      });
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: points,
      });
      await expect(one).toHaveClass(/is-pressed/);
      await expect(two).toHaveClass(/is-pressed/);
      const zoom = await multi.evaluate(() => visualViewport?.scale ?? 1);
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: points.map((point, index) => ({
          ...point,
          x: point.x + (index ? 15 : -15),
        })),
      });
      expect(await multi.evaluate(() => visualViewport?.scale ?? 1)).toBe(zoom);
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchEnd',
        touchPoints: [],
      });
      await expect(one).not.toHaveClass(/is-pressed/);
      await cdp.detach();
    }
    const unowned = before.includes('UP') ? 'ArrowRight' : 'ArrowUp';
    await page.keyboard.press(unowned);
    await expect(page.locator('.control-status')).toContainText(
      'Not your button',
    );
    const own = page.locator('.game-button').first();
    expect(
      await own.evaluate((node) => getComputedStyle(node).touchAction),
    ).toBe('manipulation');
    expect(
      await page
        .locator('.play-screen')
        .evaluate((node) => getComputedStyle(node).touchAction),
    ).toBe('none');
    await page.getByRole('button', { name: 'Mute sound', exact: true }).click();
    await expect(
      page.getByRole('button', { name: 'Mute sound', exact: true }),
    ).toHaveAttribute('aria-pressed', 'true');
  } finally {
    await guest.context.close();
  }
});

test('a real slicer death becomes fries, then respawns at the checkpoint', async ({
  page,
  browser,
}, testInfo) => {
  const code = await create(page);
  const guest = await partner(browser, code);
  try {
    await start(page, guest.page, '2-1');
    for (const [button, position] of [
      ['RIGHT', '2,1'],
      ['RIGHT', '3,1'],
      ['RIGHT', '4,1'],
    ] as const)
      await move([page, guest.page], button, position);
    // Staying on the blade causes a real death within one full on/off cycle,
    // regardless of when the browser finishes compiling the drawing shaders.
    await move([page, guest.page], 'RIGHT', '5,1');
    await expect(page.getByTestId('board')).toHaveAttribute(
      'data-status',
      'dead',
    );
    await expect(page.locator('.death-counter')).toHaveText('1 death');
    await page.screenshot({ path: testInfo.outputPath('fries.png') });
    await expect(page.getByTestId('board')).toHaveAttribute(
      'data-status',
      'playing',
    );
    await expect(page.getByTestId('board')).toHaveAttribute(
      'data-position',
      '3,1',
    );
  } finally {
    await guest.context.close();
  }
});

test('one laptop and two phone contexts share all five jobs and escape together', async ({
  page,
  browser,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'laptop',
    'This scenario uses the laptop plus two explicitly sized phone contexts.',
  );
  const code = await create(page);
  const b = await partner(browser, code, 'Bea', { width: 360, height: 740 });
  const c = await partner(browser, code, 'Cy', { width: 390, height: 844 });
  try {
    const pages = [page, b.page, c.page];
    for (const member of pages)
      await member
        .getByRole('button', { name: 'I’m ready', exact: true })
        .click();
    await expect(
      page.getByRole('button', { name: 'Start level' }),
    ).toBeEnabled();
    await page.getByRole('button', { name: 'Start level' }).click();
    for (const member of pages) {
      await expect(member.locator('canvas')).toBeVisible();
      await expect(member.locator('.game-button').first()).toBeEnabled();
    }
    expect(
      (
        await Promise.all(
          pages.map((member) => member.locator('.game-button').count()),
        )
      ).sort(),
    ).toEqual([1, 2, 2]);
    for (const [button, position] of [
      ['RIGHT', '2,1'],
      ['RIGHT', '3,1'],
      ['RIGHT', '4,1'],
      ['DOWN', '4,2'],
      ['DOWN', '4,3'],
      ['RIGHT', '5,3'],
      ['RIGHT', '6,3'],
    ] as const)
      await move(pages, button, position);
    for (const member of pages)
      if (await member.locator('[data-button="RIGHT"]').count()) {
        await member
          .locator('[data-button="RIGHT"]')
          .dispatchEvent('pointerdown', {
            pointerId: 1,
            pointerType: 'touch',
            button: 0,
          });
        break;
      }
    for (const member of pages)
      await expect(member.locator('[data-screen="results"]')).toBeVisible();
  } finally {
    await b.context.close();
    await c.context.close();
  }
});
