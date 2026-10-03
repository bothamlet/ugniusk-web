import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('**/_vercel/**', route => route.fulfill({ status: 204 }));
});

for (const width of [320, 390, 430]) {
  for (const slug of ['chap', 'todays-brief', 'jukdata', 'surface-runoff', 'this-site']) {
    test(`${slug}: readable, unclipped layout at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await page.goto(`/projects/${slug}/`);
      await page.evaluate(() => document.fonts.ready);
      const nav = await page.locator('.site-nav').boundingBox();
      const back = await page.locator('.project-back').boundingBox();
      expect(back!.y).toBeGreaterThanOrEqual(nav!.y + nav!.height);
      const bounds = await page.locator('.project-meta-item').evaluateAll(items =>
        items.map(item => ({ left: item.getBoundingClientRect().left, right: item.getBoundingClientRect().right, clipped: item.scrollWidth > item.clientWidth + 1 })));
      for (const item of bounds) {
        expect(item.left).toBeGreaterThanOrEqual(0);
        expect(item.right).toBeLessThanOrEqual(width);
        expect(item.clipped).toBe(false);
      }
      const year = (await page.locator('.project-meta-item').nth(1).boundingBox())!;
      const status = (await page.locator('.project-meta-item').nth(3).boundingBox())!;
      expect(status.x - year.x - year.width).toBeLessThan(50);
      for (const content of await page.locator('.project-editorial-content').all()) {
        expect((await content.boundingBox())!.width).toBeGreaterThan(width - 80);
      }
      const cards = await page.locator('.project-more__card').all();
      const first = (await cards[0].boundingBox())!;
      const second = (await cards[1].boundingBox())!;
      expect(second.y).toBeGreaterThan(first.y + first.height);
    });
  }
  test(`home: hero and author remain inside ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 640 });
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    const social = (await page.locator('.hero-socials').boundingBox())!;
    expect(social.y + social.height).toBeLessThanOrEqual(640);
    const caption = await page.locator('.how-i-work__caption').evaluate(element => {
      const range = document.createRange();
      range.selectNodeContents(element);
      return [...range.getClientRects()].map(rect => ({ left: rect.left, right: rect.right }));
    });
    for (const rect of caption) {
      expect(rect.left).toBeGreaterThanOrEqual(0);
      expect(rect.right).toBeLessThanOrEqual(width);
    }
    expect((await page.locator('.how-i-work__photo').boundingBox())!.height).toBeLessThan(640);
  });
  test(`home: matching bio type and centered footer links at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    for (const pair of [['.behind-work__copy', '.how-i-work__copy'], ['.behind-work__eyebrow', '.how-i-work__eyebrow']]) {
      const styles = await Promise.all(pair.map(selector => page.locator(selector).first().evaluate(element => {
        const css = getComputedStyle(element);
        return [css.fontFamily, css.fontSize, css.fontWeight, css.lineHeight];
      })));
      expect(styles[0]).toEqual(styles[1]);
    }
    const rows = new Map<number, { left: number; right: number }[]>();
    for (const link of await page.locator('.site-footer__social-link').all()) {
      const rect = (await link.boundingBox())!;
      const y = Math.round(rect.y);
      rows.set(y, [...(rows.get(y) || []), { left: rect.x, right: rect.x + rect.width }]);
    }
    for (const row of rows.values()) {
      const center = (Math.min(...row.map(rect => rect.left)) + Math.max(...row.map(rect => rect.right))) / 2;
      expect(Math.abs(center - width / 2)).toBeLessThan(1);
    }
  });
}

test('enlarged text keeps navigation and back link accessible', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/projects/chap/');
  await page.evaluate(() => { document.documentElement.style.fontSize = '150%'; });
  await page.waitForTimeout(100);
  const nav = (await page.locator('.site-nav').boundingBox())!;
  const back = (await page.locator('.project-back').boundingBox())!;
  expect(back.y).toBeGreaterThanOrEqual(nav.y + nav.height);
  for (const link of await page.locator('.site-nav a').all()) {
    const rect = (await link.boundingBox())!;
    expect(rect.x).toBeGreaterThanOrEqual(0);
    expect(rect.x + rect.width).toBeLessThanOrEqual(390);
    expect(rect.height).toBeGreaterThanOrEqual(44);
  }
});

test('gallery opens the original image without covering the project', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/projects/surface-runoff/');
  const opener = page.locator('.project-visual-image').first();
  const source = await opener.getAttribute('href');
  const [original] = await Promise.all([page.waitForEvent('popup'), opener.press('Enter')]);
  await original.waitForLoadState();
  expect(new URL(original.url()).pathname).toBe(source);
  expect(await original.locator('img').evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(390);
  await expect(page.locator('dialog')).toHaveCount(0);
  await expect(page).toHaveURL(/projects\/surface-runoff/);
});

test('mobile anchor navigation clears the fixed header', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.evaluate(() => window.scrollTo(0, 1000));
  await page.getByRole('link', { name: 'Author', exact: true }).click();
  await expect(page).toHaveURL(/#author$/);
  const nav = (await page.locator('.site-nav').boundingBox())!;
  const author = (await page.locator('#author').boundingBox())!;
  expect(author.y).toBeGreaterThanOrEqual(nav.y + nav.height - 1);
});

test('desktop retains two editorial columns and related cards', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/projects/chap/');
  const section = (await page.locator('.project-editorial').first().boundingBox())!;
  const content = (await page.locator('.project-editorial-content').first().boundingBox())!;
  expect(content.width).toBeLessThan(section.width * 0.6);
  const cards = await page.locator('.project-more__card').all();
  expect((await cards[1].boundingBox())!.y).toBeCloseTo((await cards[0].boundingBox())!.y, 0);
});

test.describe('motion enabled on touch devices', () => {
  test.use({ reducedMotion: 'no-preference', isMobile: true, hasTouch: true });
  test('native scroll reveals navigation and tapping clears the header', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await page.evaluate(() => window.scrollTo(0, 1000));
    const authorLink = page.getByRole('link', { name: 'Author', exact: true });
    await authorLink.tap();
    await expect(page).toHaveURL(/#author$/);
    const nav = (await page.locator('.site-nav').boundingBox())!;
    await expect.poll(async () => (await page.locator('#author').boundingBox())!.y).toBeCloseTo(nav.height + 16, 0);
  });
  test('footer ticker pauses off-screen and advances when visible', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    const track = page.locator('.site-footer__brand-track');
    await expect(track).toHaveCSS('animation-play-state', 'paused');
    await page.locator('.site-footer__brand').scrollIntoViewIfNeeded();
    await expect(track).toHaveCSS('animation-play-state', 'running');
    const initial = await track.evaluate(element => getComputedStyle(element).transform);
    await expect.poll(() => track.evaluate(element => getComputedStyle(element).transform)).not.toBe(initial);
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(track).toHaveCSS('animation-play-state', 'paused');
  });
});
