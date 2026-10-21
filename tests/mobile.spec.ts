import { test, expect, type Locator } from '@playwright/test';

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
  test(`home: hero remains inside ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 640 });
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    const social = (await page.locator('.hero-socials').boundingBox())!;
    expect(social.y + social.height).toBeLessThanOrEqual(640);
  });
  test(`home: footer links stay centered at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
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
  await page.getByRole('link', { name: 'About', exact: true }).click();
  await expect(page).toHaveURL(/#about$/);
  const nav = (await page.locator('.site-nav').boundingBox())!;
  const about = (await page.locator('#about').boundingBox())!;
  expect(about.y).toBeGreaterThanOrEqual(nav.y + nav.height - 1);
});

const clamp = (min: number, value: number, max: number) => Math.min(Math.max(value, min), max);

for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 1000 }]) {
  test(`home: projects run straight into the unchanged site ender at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    await expect(page.locator('.how-i-work')).toHaveCount(0);
    await expect(page.locator('#author')).toHaveCount(0);
    await expect(page.getByText('Portrait', { exact: true })).toHaveCount(0);
    await expect(page.locator('.site-nav').getByRole('link', { name: 'Author', exact: true })).toHaveCount(0);

    const ender = page.locator('.site-ender');
    const preceding = await ender.evaluate(element => {
      const sibling = element.previousElementSibling!;
      return { id: sibling.id, classes: [...sibling.classList] };
    });
    expect(preceding.id).toBe('work');
    expect(preceding.classes).toContain('selected-work');
    const work = (await page.locator('#work').boundingBox())!;
    expect((await ender.boundingBox())!.y).toBeCloseTo(work.y + work.height, 0);
    await expect(ender.locator('.site-ender__text')).toHaveText('Based on the original works of Ugnius Liberman');

    const padding = await ender.evaluate(element => {
      const css = getComputedStyle(element);
      return { top: parseFloat(css.paddingTop), bottom: parseFloat(css.paddingBottom) };
    });
    const rem = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize));
    // Same declarations as index.astro: the base rule, then its max-width 767px override; both add 112px to the top.
    const expected = viewport.width <= 767
      ? { top: clamp(10 * rem, viewport.height * 0.24, 16 * rem) + 112, bottom: clamp(14 * rem, viewport.height * 0.34, 22 * rem) }
      : { top: clamp(5 * rem, viewport.width * 0.1, 8 * rem) + 112, bottom: clamp(8 * rem, viewport.width * 0.16, 14 * rem) };
    expect(padding.top).toBeCloseTo(expected.top, 0);
    expect(padding.bottom).toBeCloseTo(expected.bottom, 0);
  });
}

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
    const aboutLink = page.getByRole('link', { name: 'About', exact: true });
    await aboutLink.tap();
    await expect(page).toHaveURL(/#about$/);
    const nav = (await page.locator('.site-nav').boundingBox())!;
    // Scroll positions may round to a fractional CSS pixel.
    await expect.poll(async () => Math.abs((await page.locator('#about').boundingBox())!.y - nav.height - 16)).toBeLessThanOrEqual(1);
  });
  test('mobile footer stays stationary as a cropped repeating strip', async ({ page }) => {
    for (const width of [320, 390, 430, 844]) {
      await page.setViewportSize({ width, height: 844 });
      await page.goto('/');
      await page.evaluate(() => document.fonts.ready);
      await page.locator('.site-footer__brand').scrollIntoViewIfNeeded();
      const track = page.locator('.site-footer__brand-track');
      await expect(track).toHaveCSS('animation-name', 'none');
      expect(await track.evaluate(element => element.getAnimations().length)).toBe(0);
      const names = page.locator('.site-footer__brand-name:visible');
      await expect(names).toHaveCount(2);
      const first = (await names.nth(0).boundingBox())!;
      const second = (await names.nth(1).boundingBox())!;
      expect(first.x).toBeLessThan(0);
      expect(first.y).toBeCloseTo(second.y, 0);
      expect(second.x + second.width).toBeGreaterThan(width);
      const white = (await names.first().locator('span').nth(0).boundingBox())!;
      const pink = (await names.first().locator('span').nth(1).boundingBox())!;
      expect(white.y).toBeCloseTo(pink.y, 0);
      expect(pink.x).toBeGreaterThan(white.x);

    }
  });
});

test.describe('desktop footer motion', () => {
  test.use({ reducedMotion: 'no-preference', isMobile: false, hasTouch: false });
  test('footer ticker pauses off-screen and advances when visible', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
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

for (const viewport of [{ width: 320, height: 640 }, { width: 390, height: 844 }, { width: 667, height: 375 }]) {
  test(`mobile hero preserves the three-line composition at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    await expect(page.getByRole('heading', { name: 'Ugnius Liberman', exact: true })).toBeVisible();
    const words = page.locator('.hero-name__word');
    await expect(words).toHaveCount(3);
    const boxes = await Promise.all((await words.all()).map(word => word.boundingBox()));
    const socials = (await page.locator('.hero-socials nav').boundingBox())!;
    for (let index = 0; index < boxes.length; index++) {
      const box = boxes[index]!;
      expect(box.x).toBeCloseTo(viewport.width * 0.095, 0);
      expect(box.x + box.width).toBeLessThan(viewport.width);
      expect(box.y).toBeGreaterThan(0);
      if (index) {
        const previous = boxes[index - 1]!;
        expect(box.y).toBeGreaterThan(previous.y + previous.height);
        expect(box.width).toBeLessThan(previous.width);
      }
    }
    const final = boxes[2]!;
    expect(final.y + final.height).toBeLessThan(socials.y);
  });
}

test('desktop hero retains its original two-line treatment', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator('.hero-name__mobile')).toBeHidden();
  await expect(page.locator('.hero-name__line--first')).toBeVisible();
  await expect(page.locator('.hero-name__line--last')).toBeVisible();
});

const socialProfiles = {
  GitHub: 'https://github.com/bothamlet',
  LinkedIn: 'https://www.linkedin.com/in/ugniusk/',
  Instagram: 'https://www.instagram.com/lieputis_berzas?vrfl=amtkYmlmNDNvOGxn',
};

test('hero, footer and project footer link to the supplied profiles', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  for (const [label, href] of Object.entries(socialProfiles)) {
    await expect(page.locator('.hero-socials').getByRole('link', { name: label, exact: true })).toHaveAttribute('href', href);
    await expect(page.locator('.site-footer').getByRole('link', { name: label, exact: true })).toHaveAttribute('href', href);
  }

  await page.goto('/projects/chap/');
  for (const [label, href] of Object.entries(socialProfiles)) {
    await expect(page.locator('.site-footer').getByRole('link', { name: label, exact: true })).toHaveAttribute('href', href);
  }
});

test('JSON-LD Person.sameAs lists the supplied profiles', async ({ page }) => {
  await page.goto('/');
  const sameAs = await page.locator('script[type="application/ld+json"]').evaluate((script) => {
    const graph = JSON.parse(script.textContent ?? '{}')['@graph'] as { '@type': string; sameAs?: string[] }[];
    return graph.find((node) => node['@type'] === 'Person')?.sameAs ?? [];
  });
  expect([...sameAs].sort()).toEqual(Object.values(socialProfiles).sort());
});

test('project pages carry the corrected factual claims', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });

  await page.goto('/projects/this-site/');
  const thisSite = page.locator('.project-page');
  await expect(page.locator('.project-meta-item__value').nth(2)).toHaveText('Astro · Anime.js · Lenis');
  await expect(thisSite).toContainText('Hand-written CSS with custom properties handles the design system');
  await expect(thisSite).not.toContainText('Tailwind');

  await page.goto('/projects/chap/');
  const chap = page.locator('.project-page');
  const chapLead = page.locator('.project-editorial-heading').first();
  await expect(chapLead).toContainText('Chap is a native Android envelope-budgeting app');
  await expect(chapLead).toContainText('CSV imports and categorization rules reduce repetitive manual entry');
  await expect(chapLead).toContainText('only genuinely ambiguous cases surface for a decision');
  await expect(chap).toContainText("encrypted backups tied to the original installation's Keystore key. These backups cannot restore data after uninstalling the app or on another device.");
  await expect(chap).toContainText("Every budgeting app I'd used added friction");
  await expect(page.getByRole('heading', { name: 'Friction is the enemy', exact: true })).toBeVisible();
  for (const claim of ['bank connections', 'receipts', 'full export', 'lives in the repo']) {
    await expect(chap).not.toContainText(claim);
  }

  await page.goto('/projects/jukdata/');
  const jukdata = page.locator('.project-page');
  await expect(jukdata).toContainText('Hero entrance and project-tab transitions run on Motion.');
  await expect(jukdata).toContainText('Reduced-motion users get a static treatment.');
  await expect(jukdata).toContainText('Cookie consent is managed through Silktide, with Google Consent Mode defaults.');
  await expect(jukdata).toContainText('Complete product - services, case studies, technology breakdowns, and a contact flow, built out fully.');
  await expect(jukdata).not.toContainText('Google Tag Manager');
  await expect(jukdata).not.toContainText('Scroll reveals run on Motion.');
});

interface ProjectMeta {
  title: string;
  type: string;
  year: string;
  stack: string;
  status: string;
  url: string;
}

const repositories: Record<string, ProjectMeta> = {
  'todays-brief': {
    title: "Today's Brief",
    type: 'Information Systems & Automation',
    year: '2026',
    stack: 'Python · SQLite · Telegram Bot API',
    status: 'Finished',
    url: 'https://github.com/bothamlet/todays-brief',
  },
  'this-site': {
    title: 'This Site',
    type: 'Web Design & Engineering',
    year: '2026',
    stack: 'Astro · Anime.js · Lenis',
    status: 'Active',
    url: 'https://github.com/bothamlet/ugniusk-web',
  },
  chap: {
    title: 'Chap',
    type: 'Mobile Development',
    year: '2026',
    stack: 'Kotlin · Jetpack Compose · Room · SQLCipher',
    status: 'Paused',
    url: 'https://github.com/bothamlet/chap-android',
  },
  jukdata: {
    title: 'JUKdata',
    type: 'Web Design & Engineering',
    year: '2026',
    stack: 'Next.js · React · TypeScript · Tailwind CSS',
    status: 'Completed',
    url: 'https://github.com/bothamlet/jukdata-site',
  },
};

const repoLinkName = (title: string) => `View ${title} repository on GitHub`;

interface Box { x: number; y: number; width: number; height: number }

// The title flows inline, so its bounding box spans every line fragment. The
// repository mark follows the final rendered line, so measure that line's text.
const lastTextLine = (heading: Locator): Promise<Box> =>
  heading.evaluate((element) => {
    const range = document.createRange();
    range.selectNodeContents(element);
    const rects = [...range.getClientRects()];
    const last = rects.reduce((bottomMost, rect) =>
      rect.bottom > bottomMost.bottom ? rect : bottomMost, rects[0]);
    return { x: last.x, y: last.y, width: last.width, height: last.height };
  });

for (const [slug, project] of Object.entries(repositories)) {
  test(`${slug}: the title row carries the repository link`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/projects/${slug}/`);

    const row = page.locator('.project-title-row');
    await expect(row).toHaveCount(1);
    const heading = row.locator('h1');
    await expect(heading).toHaveText(project.title);

    // Adjacent sibling selector: the link follows the h1 itself, not a wrapper.
    const link = row.locator('h1 + .project-repo');
    await expect(link).toHaveCount(1);
    await expect(link).toHaveAccessibleName(repoLinkName(project.title));
    await expect(link).toHaveAttribute('href', project.url);
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    await expect(link).toHaveAttribute('title', repoLinkName(project.title));
    await expect(link).toHaveAttribute('aria-label', repoLinkName(project.title));

    const icon = await link.locator('svg').boundingBox();
    expect(icon!.width).toBeGreaterThanOrEqual(18);
    expect(icon!.width).toBeLessThanOrEqual(19);
    expect(icon!.height).toBeGreaterThanOrEqual(18);
    expect(icon!.height).toBeLessThanOrEqual(19);

    // The 44px target hugs the last word: 8px of margin to the target's edge.
    const [lineBox, linkBox] = [await lastTextLine(heading), await link.boundingBox()];
    expect(linkBox!.width).toBeGreaterThanOrEqual(44);
    expect(linkBox!.height).toBeGreaterThanOrEqual(44);
    const gap = linkBox!.x - (lineBox.x + lineBox.width);
    expect(gap).toBeGreaterThanOrEqual(0);
    expect(gap).toBeLessThanOrEqual(12);
    const sharesLastLine =
      linkBox!.y < lineBox.y + lineBox.height && lineBox.y < linkBox!.y + linkBox!.height;
    expect(sharesLastLine, 'mark stays on the last title line').toBe(true);

    // The fourth field is still Status: four meta items, same value, no link.
    await expect(page.locator('.project-meta-item')).toHaveCount(4);
    const status = page.locator('.project-meta-item').nth(3);
    await expect(status.locator('.project-meta-item__label')).toHaveText('Status');
    await expect(status.locator('.project-meta-item__value')).toHaveText(project.status);
    await expect(status.getByRole('link')).toHaveCount(0);

    // The server-rendered HTML carries the link in the header, not the meta row.
    const html = await (await page.request.get(`/projects/${slug}/`)).text();
    const rowStart = html.indexOf('class="project-title-row');
    const linkStart = html.indexOf('class="project-repo cursor-hover"');
    const metaStart = html.indexOf('class="project-meta-row"');
    expect(rowStart).toBeGreaterThan(-1);
    expect(linkStart).toBeGreaterThan(rowStart);
    expect(linkStart).toBeLessThan(metaStart);
    expect(html).toMatch(/<\/h1><a class="project-repo cursor-hover"/);
    expect(html).toContain(`href="${project.url}"`);
  });
}

test('repository link is keyboard reachable with a visible focus ring', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/projects/jukdata/');
  // The back link is the last tab stop before the title row, so one Tab lands
  // on the repository link.
  await page.locator('.project-back').focus();
  await page.keyboard.press('Tab');
  const link = page.locator('.project-repo');
  await expect(link).toBeFocused();
  expect(await link.evaluate((element) => element.matches(':focus-visible'))).toBe(true);
  expect(await link.evaluate((element) => getComputedStyle(element).outlineWidth)).toBe('2px');
  expect(await link.evaluate((element) => getComputedStyle(element).outlineStyle)).toBe('solid');
});

for (const width of [320, 390, 430, 600, 900, 901, 1000, 1440]) {
  test(`repository link stays beside the title without clipping at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const [slug, project] of Object.entries(repositories)) {
      await page.goto(`/projects/${slug}/`);
      await page.evaluate(() => document.fonts.ready);
      const row = page.locator('.project-title-row');
      const heading = row.locator('h1');
      const link = row.getByRole('link', { name: repoLinkName(project.title) });
      const [cardBox, rowBox, lineBox, linkBox, iconBox] = [
        (await page.locator('.project-detail').boundingBox())!,
        (await row.boundingBox())!,
        await lastTextLine(heading),
        (await link.boundingBox())!,
        (await link.locator('svg').boundingBox())!,
      ];
      const where = `${slug} at ${width}px`;

      await expect(heading, where).toHaveText(project.title);

      // 44px touch target around an 18px mark.
      expect(linkBox.width, where).toBeGreaterThanOrEqual(44);
      expect(linkBox.height, where).toBeGreaterThanOrEqual(44);
      expect(iconBox.width, where).toBeGreaterThanOrEqual(18);
      expect(iconBox.width, where).toBeLessThanOrEqual(19);
      expect(iconBox.height, where).toBeGreaterThanOrEqual(18);
      expect(iconBox.height, where).toBeLessThanOrEqual(19);

      // Immediately right of the last rendered title word, never floated to the
      // column edge and never pushed onto a line of its own.
      expect(linkBox.x - (lineBox.x + lineBox.width), where).toBeGreaterThanOrEqual(0);
      expect(linkBox.x - (lineBox.x + lineBox.width), where).toBeLessThanOrEqual(12);
      const sharesLastLine =
        linkBox.y < lineBox.y + lineBox.height && lineBox.y < linkBox.y + linkBox.height;
      expect(sharesLastLine, `${where} mark shares the last title line`).toBe(true);

      // Inside the viewport and the card. `.project-page` clips overflow-x, so
      // document.scrollWidth stays pinned to the viewport even when a box hangs
      // off the edge; only the boxes show that.
      expect(linkBox.x, where).toBeGreaterThanOrEqual(0);
      expect(linkBox.x + linkBox.width, where).toBeLessThanOrEqual(width);
      expect(rowBox.x, where).toBeGreaterThanOrEqual(cardBox.x);
      expect(rowBox.x + rowBox.width, where).toBeLessThanOrEqual(cardBox.x + cardBox.width + 1);
      expect(linkBox.x, where).toBeGreaterThanOrEqual(rowBox.x);
      expect(linkBox.x + linkBox.width, where).toBeLessThanOrEqual(rowBox.x + rowBox.width + 1);
      expect(linkBox.y, where).toBeGreaterThanOrEqual(rowBox.y);
      expect(linkBox.y + linkBox.height, where).toBeLessThanOrEqual(rowBox.y + rowBox.height + 1);

      // The title text itself stays inside the card, unclipped.
      expect(lineBox.x, where).toBeGreaterThanOrEqual(cardBox.x);
      expect(lineBox.x + lineBox.width, where).toBeLessThanOrEqual(cardBox.x + cardBox.width);
    }
  });
}

// Type and Stack are the widest fields, and the desktop row gives each of the
// four fields a quarter of the card. The values wrap instead of truncating, so
// the whole stack list stays readable at every desktop width.
for (const width of [901, 1000, 1440]) {
  test(`Type and Stack metadata is readable, not clipped, at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const [slug, project] of Object.entries(repositories)) {
      await page.goto(`/projects/${slug}/`);
      await page.evaluate(() => document.fonts.ready);
      const where = `${slug} at ${width}px`;
      const values = page.locator('.project-meta-item__value');
      const expected = [project.type, project.year, project.stack, project.status];

      await expect(values).toHaveCount(4);
      for (const [index, text] of expected.entries()) {
        await expect(values.nth(index), `value ${index} ${where}`).toHaveText(text);
      }

      const boxes = await values.evaluateAll((elements) =>
        elements.map((element) => {
          const css = getComputedStyle(element);
          return {
            scrollWidth: element.scrollWidth,
            clientWidth: element.clientWidth,
            scrollHeight: element.scrollHeight,
            clientHeight: element.clientHeight,
            whiteSpace: css.whiteSpace,
            textOverflow: css.textOverflow,
          };
        }),
      );

      for (const [index, box] of boxes.entries()) {
        const field = `"${expected[index]}" ${where}`;
        expect(box.whiteSpace, field).toBe('normal');
        expect(box.textOverflow, field).not.toBe('ellipsis');
        expect(box.scrollWidth, field).toBeLessThanOrEqual(box.clientWidth + 1);
        expect(box.scrollHeight, field).toBeLessThanOrEqual(box.clientHeight + 1);
      }
    }
  });
}

test('Surface Runoff leaves the title row and Status cell without a repository link', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/projects/surface-runoff/');
  const row = page.locator('.project-title-row');
  await expect(row.locator('h1')).toHaveText('Surface Runoff Model');
  // With no URL the row holds only the heading, so it gains no gap or width.
  await expect(row.locator(':scope > *')).toHaveCount(1);
  await expect(page.locator('.project-repo')).toHaveCount(0);
  const status = page.locator('.project-meta-item').nth(3);
  await expect(page.locator('.project-meta-item')).toHaveCount(4);
  await expect(status.getByRole('link')).toHaveCount(0);
  await expect(status.locator('.project-meta-item__value')).toHaveText('Completed');
  // The Status cell keeps its plain box: no reserved gutter.
  const style = await status.evaluate((element) => {
    const css = getComputedStyle(element);
    return { position: css.position, paddingRight: css.paddingRight };
  });
  expect(style).toEqual({ position: 'static', paddingRight: '0px' });
  const html = await (await page.request.get('/projects/surface-runoff/')).text();
  expect(html).not.toContain('class="project-repo');
  expect(html).not.toContain('project-meta-item--repo');
});
