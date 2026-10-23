import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { test, expect, type Locator, type Page } from '@playwright/test';
import { imageFor, imageSrcSet, responsiveImages } from '../src/data/images';

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

// The shipped WebP assets use VP8 (lossy) or VP8X (extended) chunks whose
// headers carry the pixel dimensions. Read from the shipped bytes so the
// assertions below describe the asset itself.
const webpSize = (path: string) => {
  const bytes = readFileSync(new URL(`../dist${path}`, import.meta.url));
  expect(bytes.toString('ascii', 0, 4), `${path} RIFF`).toBe('RIFF');
  expect(bytes.toString('ascii', 8, 12), `${path} WEBP`).toBe('WEBP');
  const chunk = bytes.toString('ascii', 12, 16);
  if (chunk === 'VP8X') {
    return { width: bytes.readUIntLE(24, 3) + 1, height: bytes.readUIntLE(27, 3) + 1 };
  }
  expect(chunk, path).toBe('VP8 ');
  expect(bytes.subarray(23, 26), `${path} VP8 start code`).toEqual(Buffer.from([0x9d, 0x01, 0x2a]));
  return { width: bytes.readUInt16LE(26) & 0x3fff, height: bytes.readUInt16LE(28) & 0x3fff };
};

// The three Surface Runoff figures are 160-frame animated WebPs. These fixtures
// name them once: a resized copy would drop every frame but the first, so they
// keep their original file (see the animation test further down).
const animatedFigures = [
  '/images/projects/surface-runoff-rain-storm.webp',
  '/images/projects/surface-runoff-water-depth.webp',
  '/images/projects/surface-runoff-soil-saturation.webp',
];

// Count the frames of a shipped WebP by walking its RIFF chunks: an animated
// file carries one ANMF chunk per frame, a still file none.
const webpFrameCount = (path: string) => {
  const bytes = readFileSync(new URL(`../dist${path}`, import.meta.url));
  expect(bytes.toString('ascii', 0, 4), `${path} RIFF`).toBe('RIFF');
  expect(bytes.toString('ascii', 8, 12), `${path} WEBP`).toBe('WEBP');
  let offset = 12;
  let frames = 0;
  while (offset + 8 <= bytes.length) {
    const id = bytes.toString('ascii', offset, offset + 4);
    const size = bytes.readUInt32LE(offset + 4);
    if (id === 'ANMF') frames += 1;
    offset += 8 + size + (size % 2);
  }
  return Math.max(frames, 1);
};

test('This Site hero ships a 2880x1620 export with honest responsive variants', async ({ page }) => {
  // Captured at a 1440x810 CSS viewport with deviceScaleFactor 2.
  expect(webpSize('/screenshots/this-site-card.webp')).toEqual({ width: 2880, height: 1620 });
  const variants = {
    '/screenshots/this-site-card-800.webp': 800,
    '/screenshots/this-site-card-1600.webp': 1600,
  };
  for (const [path, descriptor] of Object.entries(variants)) {
    // The srcset width descriptor is the file's real pixel width, not a label.
    expect(webpSize(path), path).toEqual({ width: descriptor, height: descriptor * 9 / 16 });
  }

  // ProjectVisual reserves the full export's intrinsic box in the built page.
  const projectPage = readDist('/projects/this-site/index.html');
  expect(projectPage).toMatch(/<img src="\/screenshots\/this-site-card\.webp"[^>]*width="2880" height="1620"/);

  // The homepage card offers both variants beside the full file.
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  const card = page.locator('a[href="/projects/this-site/"] .product-shot__img').first();
  await expect(card).toHaveAttribute('src', '/screenshots/this-site-card.webp');
  const srcset = (await card.getAttribute('srcset')) ?? '';
  for (const [path, descriptor] of Object.entries(variants)) {
    expect(srcset, path).toContain(`${path} ${descriptor}w`);
  }

  for (const path of ['/screenshots/this-site-card.webp', ...Object.keys(variants)]) {
    const response = await page.request.get(path);
    expect(response.status(), path).toBe(200);
    expect(response.headers()['content-type'], path).toBe('image/webp');
  }

  // Surface Runoff is untouched: the 894px card cannot claim the 1400px gallery
  // figure, which is a different frame (t=0.00 min) from the card's t=4.50 min.
  expect(webpSize('/images/projects/surface-runoff-card.webp')).toEqual({ width: 894, height: 503 });
  expect(webpSize('/images/projects/surface-runoff-water-depth.webp')).toEqual({ width: 1400, height: 783 });
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

  // Today's Brief keeps both Overview paragraphs as plain body copy: the six
  // section names and "Complete system" are no longer bolded inline.
  await page.goto('/projects/todays-brief/');
  const briefOverview = page.locator('.project-editorial').first();
  await expect(briefOverview.locator('.project-editorial-body')).toHaveCount(2);
  await expect(briefOverview.locator('strong, b')).toHaveCount(0);
  await expect(briefOverview).toContainText('Each issue is divided into World, Europe, Lietuva, Tech, Sports, and Other');
  await expect(briefOverview).toContainText('Complete system - source collection, clustering, classification');
  for (const body of await briefOverview.locator('.project-editorial-body').all()) {
    expect(await body.evaluate((element) => getComputedStyle(element).fontWeight)).toBe('400');
  }
  await expect(briefOverview.locator('.project-editorial-heading')).toHaveCSS('font-weight', '900');
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
    status: 'Completed',
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

const statusCell = (page: Page) => page.locator('.project-meta-item').nth(3);

// Adjacent-sibling selector: the mark must follow the scrambled status word
// itself, which also proves it sits outside the span the scramble rewrites.
const statusRepoLink = (page: Page) =>
  statusCell(page).locator('.project-meta-item__status > [data-scramble="scroll"] + a.project-repo');

const onSameLine = (a: Box, b: Box) => a.y < b.y + b.height && b.y < a.y + a.height;

for (const [slug, project] of Object.entries(repositories)) {
  test(`${slug}: the Status value carries the repository link`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/projects/${slug}/`);

    // The title is a plain block heading again: no row wrapper, no reserved
    // gutter, and no mark beside the name.
    const heading = page.locator('h1.project-title');
    await expect(heading).toHaveCount(1);
    await expect(heading).toHaveText(project.title);
    await expect(page.locator('.project-title-row')).toHaveCount(0);
    await expect(page.locator('.project-title .project-repo, .project-title + .project-repo')).toHaveCount(0);

    await expect(page.locator('.project-meta-item')).toHaveCount(4);
    const status = statusCell(page);
    await expect(status.locator('.project-meta-item__label')).toHaveText('Status');
    const value = status.locator('.project-meta-item__value');
    await expect(value).toHaveText(project.status);
    expect(await value.getAttribute('data-scramble')).toBe('scroll');
    // No mark inside the scrambled span.
    await expect(status.locator('[data-scramble="scroll"] .project-repo')).toHaveCount(0);

    const link = statusRepoLink(page);
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

    // 44px target right after the status word, not at the far edge of the cell.
    const [valueBox, linkBox] = [await value.boundingBox(), await link.boundingBox()];
    expect(linkBox!.width).toBeGreaterThanOrEqual(44);
    expect(linkBox!.height).toBeGreaterThanOrEqual(44);
    // The row owns the spacing: a comfortable 8px after the word, before the mark.
    expect(await status.evaluate((element) => getComputedStyle(element).gap)).toBe('8px');
    const gap = linkBox!.x - (valueBox!.x + valueBox!.width);
    expect(gap).toBeGreaterThanOrEqual(7.5);
    expect(gap).toBeLessThanOrEqual(8.5);
    expect(onSameLine(valueBox!, linkBox!), 'mark shares the status line').toBe(true);
  });
}

// The built pages and stylesheet are the shipped artefact, so the markup and
// CSS assertions read them directly: the dev server rewrites component styles at
// runtime, which makes its raw response a poor witness for a removed rule.
test('built project pages carry the Status mark and no title-row remnants', () => {
  const cssDir = new URL('../dist/_astro/', import.meta.url);
  const css = readdirSync(cssDir)
    .filter((file) => file.endsWith('.css'))
    .map((file) => readFileSync(new URL(file, cssDir), 'utf8'))
    .join('\n');
  expect(css).not.toContain('project-title-row');
  expect(css).not.toContain('project-meta-item--repo');
  expect(css).toContain('.project-meta-item__status');
  expect(css).toMatch(/project-visual-full--inset[^{]*\{background:#fdfbf7/);

  for (const [slug, project] of Object.entries(repositories)) {
    const html = readFileSync(new URL(`../dist/projects/${slug}/index.html`, import.meta.url), 'utf8');
    // The standalone heading is back, and the mark lives after the Status word.
    expect(html).toMatch(/<h1 class="project-title[^"]*"/);
    expect(html).not.toContain('project-title-row');
    const statusStart = html.indexOf('>Status</span>');
    const linkStart = html.indexOf('class="project-repo cursor-hover"');
    expect(statusStart, slug).toBeGreaterThan(-1);
    expect(linkStart, slug).toBeGreaterThan(statusStart);
    expect(html, slug).toMatch(/<\/span><a class="project-repo cursor-hover"/);
    expect(html, slug).toContain(`href="${project.url}"`);
  }

  const surface = readFileSync(new URL('../dist/projects/surface-runoff/index.html', import.meta.url), 'utf8');
  expect(surface).not.toContain('class="project-repo');
  expect(surface).not.toContain('project-meta-item--repo');
  expect(surface).not.toContain('project-title-row');
});

// The public domain comes from `site` in astro.config.mjs. The built output is
// what crawlers and social scrapers receive, so these assertions read it.
const publicOrigin = 'https://ugniusliberman.me';
const legacyOrigin = 'https://ugniusk-web-pied.vercel.app';

const readDist = (path: string) => readFileSync(new URL(`../dist${path}`, import.meta.url), 'utf8');

const metaContent = (html: string, key: string) => {
  const content = html.match(new RegExp(`<meta (?:name|property)="${key}" content="([^"]*)"`))?.[1];
  expect(content, key).toBeDefined();
  return content!;
};

const canonicalHref = (html: string) => {
  const href = html.match(/<link rel="canonical" href="([^"]*)"/)?.[1];
  expect(href, 'canonical link').toBeDefined();
  return href!;
};

const jsonLdGraph = (html: string) => {
  const raw = html.match(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/)?.[1];
  expect(raw, 'JSON-LD block').toBeDefined();
  return (JSON.parse(raw!) as { '@graph': { '@type': string; url?: string }[] })['@graph'];
};

test('built pages, robots and sitemaps advertise the public domain', () => {
  // The six indexable URLs: the home page and the five shipped projects.
  const pages: Record<string, string> = {
    '/': '/index.html',
    '/projects/todays-brief/': '/projects/todays-brief/index.html',
    '/projects/this-site/': '/projects/this-site/index.html',
    '/projects/chap/': '/projects/chap/index.html',
    '/projects/jukdata/': '/projects/jukdata/index.html',
    '/projects/surface-runoff/': '/projects/surface-runoff/index.html',
  };

  for (const [path, file] of Object.entries(pages)) {
    const html = readDist(file);
    const canonical = canonicalHref(html);
    expect(canonical, file).toBe(`${publicOrigin}${path}`);
    expect(metaContent(html, 'og:url'), file).toBe(canonical);

    for (const key of ['og:image', 'twitter:image']) {
      const image = metaContent(html, key);
      expect(image.startsWith(`${publicOrigin}/`), `${file} ${key} is absolute on the public domain`).toBe(true);
      // The shared image is a real file in the built output.
      expect(existsSync(new URL(`../dist${new URL(image).pathname}`, import.meta.url)), `${file} ${key}`).toBe(true);
    }

    const graph = jsonLdGraph(html);
    for (const type of ['WebSite', 'Person']) {
      expect(graph.find((node) => node['@type'] === type)?.url, `${file} ${type}`).toBe(`${publicOrigin}/`);
    }
  }

  const robots = readDist('/robots.txt');
  expect(robots).toContain(`Sitemap: ${publicOrigin}/sitemap-index.xml`);
  expect(robots).not.toContain(legacyOrigin);

  const sitemapIndex = readDist('/sitemap-index.xml');
  expect(sitemapIndex).toContain(`<loc>${publicOrigin}/sitemap-0.xml</loc>`);
  expect(sitemapIndex).not.toContain(legacyOrigin);

  const sitemap = readDist('/sitemap-0.xml');
  const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
  expect([...locs].sort()).toEqual(Object.keys(pages).map((path) => `${publicOrigin}${path}`).sort());
  // Planned and hidden projects have no page and no sitemap entry.
  expect(sitemap).not.toMatch(/diucon|horseflight|inner-council/i);
  expect(sitemap).not.toContain(legacyOrigin);
});

// Every shipped social card is a 1200x630 PNG, so the expected image, alt text
// and dimensions live here as literals: a page that regresses to the wrong card,
// or describes a cropped card inaccurately, fails this table.
const socialCards: Record<string, { file: string; image: string; alt: string }> = {
  '/': {
    file: '/index.html',
    image: '/og/this-site-card.png',
    alt: 'Ugnius Liberman - off-white and magenta UGNIUS LIBERMAN wordmark on black, with the social icons along the bottom edge',
  },
  '/projects/todays-brief/': {
    file: '/projects/todays-brief/index.html',
    image: '/og/todays-brief-card.png',
    alt: "Today's Brief - six section markers, one filled teal, above the TODAY'S BRIEF editorial wordmark on a cream paper field",
  },
  '/projects/this-site/': {
    file: '/projects/this-site/index.html',
    image: '/og/this-site-card.png',
    alt: 'This Site - the UGNIUS LIBERMAN wordmark in off-white and magenta on black, with the social icons along the bottom edge',
  },
  '/projects/chap/': {
    file: '/projects/chap/index.html',
    image: '/og/chap-card-full.png',
    alt: 'Chap - the Chap wordmark and purple dot beside a partly cropped phone showing an empty envelope dashboard',
  },
  '/projects/jukdata/': {
    file: '/projects/jukdata/index.html',
    image: '/og/jukdata-card.png',
    alt: 'JUKdata - the corporate homepage hero on a warm dark field, with the navigation, the Lithuanian headline and two orange calls to action',
  },
  '/projects/surface-runoff/': {
    file: '/projects/surface-runoff/index.html',
    image: '/og/surface-runoff-card.png',
    alt: 'Surface Runoff Model - a 3D plot of water depth on the terrain at t=4.50 min, with labelled X, Y and height axes, a water-depth colour scale and a terrain note',
  },
};

test('built pages emit their social card image, alt text and fixed dimensions', () => {
  for (const [path, card] of Object.entries(socialCards)) {
    const html = readDist(card.file);
    const image = `${publicOrigin}${card.image}`;
    for (const key of ['og:image', 'twitter:image']) {
      expect(metaContent(html, key), `${path} ${key}`).toBe(image);
    }
    for (const key of ['og:image:alt', 'twitter:image:alt']) {
      expect(metaContent(html, key), `${path} ${key}`).toBe(card.alt);
    }
    expect(metaContent(html, 'og:image:width'), path).toBe('1200');
    expect(metaContent(html, 'og:image:height'), path).toBe('630');
    expect(metaContent(html, 'og:image:type'), path).toBe('image/png');
  }

  // Home reuses the This Site card; each project carries its own, never the fallback.
  const projectCards = Object.entries(socialCards)
    .filter(([path]) => path !== '/')
    .map(([, card]) => card.image);
  expect(socialCards['/'].image).toBe(socialCards['/projects/this-site/'].image);
  expect(new Set(projectCards).size).toBe(5);
  expect(projectCards).not.toContain('/og-image.png');
});

// PNG: 8-byte signature, then the IHDR chunk whose first fields are width and
// height, read straight from the built bytes rather than through an image library.
test('social cards are real 1200x630 PNGs served as image/png', async ({ page }) => {
  const pngSize = (path: string) => {
    const bytes = readFileSync(new URL(`../dist${path}`, import.meta.url));
    expect(bytes.subarray(0, 8), `${path} signature`).toEqual(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );
    expect(bytes.toString('ascii', 12, 16), `${path} IHDR`).toBe('IHDR');
    return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  };

  const images = [...new Set(Object.values(socialCards).map((card) => card.image))];
  expect(images).toHaveLength(5);
  for (const image of images) {
    expect(pngSize(image), image).toEqual({ width: 1200, height: 630 });
  }

  // The default card and the two new cards are reachable over HTTP with the PNG content type.
  for (const image of ['/og/this-site-card.png', '/og/todays-brief-card.png', '/og/surface-runoff-card.png']) {
    const response = await page.request.get(image);
    expect(response.status(), image).toBe(200);
    expect(response.headers()['content-type'], image).toBe('image/png');
  }
});

test('repository link is keyboard reachable with a visible focus ring', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/projects/jukdata/');
  // The back link is the last tab stop before the meta row, so one Tab lands on
  // the repository link in the Status cell.
  await page.locator('.project-back').focus();
  await page.keyboard.press('Tab');
  const link = page.locator('.project-repo');
  await expect(link).toBeFocused();
  expect(await link.evaluate((element) => element.matches(':focus-visible'))).toBe(true);
  expect(await link.evaluate((element) => getComputedStyle(element).outlineWidth)).toBe('2px');
  expect(await link.evaluate((element) => getComputedStyle(element).outlineStyle)).toBe('solid');
});

for (const width of [320, 390, 430, 600, 900, 901, 1000, 1440]) {
  test(`repository link stays beside the Status value without clipping at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const [slug, project] of Object.entries(repositories)) {
      await page.goto(`/projects/${slug}/`);
      await page.evaluate(() => document.fonts.ready);
      const where = `${slug} at ${width}px`;
      const status = statusCell(page);
      const value = status.locator('.project-meta-item__value');
      const link = statusRepoLink(page);
      // The reveal and nav-height corrections can still hold the meta row below
      // its settled position right after fonts resolve. Resolve the five
      // elements, then read every rect in one synchronous evaluation so the
      // assertions below compare a single layout state.
      const elements = [
        await page.locator('.project-detail').elementHandle(),
        await status.elementHandle(),
        await value.elementHandle(),
        await link.elementHandle(),
        await link.locator('svg').elementHandle(),
      ];
      const [cardBox, statusBox, valueBox, linkBox, iconBox] = await page.evaluate(
        (handles) =>
          handles.map((element) => {
            if (!element) throw new Error('geometry element is missing');
            const { x, y, width, height } = element.getBoundingClientRect();
            return { x, y, width, height };
          }),
        elements,
      );

      await expect(page.locator('h1.project-title'), where).toHaveText(project.title);
      await expect(page.locator('.project-title-row'), where).toHaveCount(0);
      await expect(page.locator('.project-title .project-repo'), where).toHaveCount(0);

      // 44px touch target around an 18px mark.
      expect(linkBox.width, where).toBeGreaterThanOrEqual(44);
      expect(linkBox.height, where).toBeGreaterThanOrEqual(44);
      expect(iconBox.width, where).toBeGreaterThanOrEqual(18);
      expect(iconBox.width, where).toBeLessThanOrEqual(19);
      expect(iconBox.height, where).toBeGreaterThanOrEqual(18);
      expect(iconBox.height, where).toBeLessThanOrEqual(19);

      // Immediately after the status word: the gap is the row's own 8px
      // spacing, never the distance across the cell to a right-aligned mark.
      const gap = linkBox.x - (valueBox.x + valueBox.width);
      expect(gap, where).toBeGreaterThanOrEqual(7.5);
      expect(gap, where).toBeLessThanOrEqual(8.5);
      expect(onSameLine(valueBox, linkBox), `${where} mark shares the status line`).toBe(true);

      // The status word stays whole - no wrap, no ellipsis.
      await expect(value, where).toHaveText(project.status);
      const valueOverflow = await value.evaluate((element) => {
        const css = getComputedStyle(element);
        return {
          scrollWidth: element.scrollWidth,
          clientWidth: element.clientWidth,
          scrollHeight: element.scrollHeight,
          clientHeight: element.clientHeight,
          whiteSpace: css.whiteSpace,
          textOverflow: css.textOverflow,
        };
      });
      expect(valueOverflow.whiteSpace, where).toBe('normal');
      expect(valueOverflow.textOverflow, where).not.toBe('ellipsis');
      expect(valueOverflow.scrollWidth, where).toBeLessThanOrEqual(valueOverflow.clientWidth + 1);
      expect(valueOverflow.scrollHeight, where).toBeLessThanOrEqual(valueOverflow.clientHeight + 1);

      // Inside the viewport, the card and the Status cell at once.
      expect(linkBox.x, where).toBeGreaterThanOrEqual(0);
      expect(linkBox.x + linkBox.width, where).toBeLessThanOrEqual(width);
      expect(statusBox.x, where).toBeGreaterThanOrEqual(cardBox.x);
      expect(statusBox.x + statusBox.width, where).toBeLessThanOrEqual(cardBox.x + cardBox.width + 1);
      expect(linkBox.x, where).toBeGreaterThanOrEqual(statusBox.x);
      expect(linkBox.x + linkBox.width, where).toBeLessThanOrEqual(statusBox.x + statusBox.width + 1);
      expect(linkBox.y, where).toBeGreaterThanOrEqual(statusBox.y);
      expect(linkBox.y + linkBox.height, where).toBeLessThanOrEqual(statusBox.y + statusBox.height + 1);
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

test('Surface Runoff leaves the Status cell without a repository link', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/projects/surface-runoff/');
  await expect(page.locator('h1.project-title')).toHaveText('Surface Runoff Model');
  await expect(page.locator('.project-title-row')).toHaveCount(0);
  await expect(page.locator('.project-repo')).toHaveCount(0);
  await expect(page.locator('.project-meta-item')).toHaveCount(4);
  const status = statusCell(page);
  await expect(status.getByRole('link')).toHaveCount(0);
  await expect(status.locator('.project-meta-item__value')).toHaveText('Completed');
  // The status row holds the word alone: no reserved target, no leftover gap.
  await expect(status.locator('.project-meta-item__status > *')).toHaveCount(1);
  const style = await status.evaluate((element) => {
    const css = getComputedStyle(element);
    return { position: css.position, paddingRight: css.paddingRight };
  });
  expect(style).toEqual({ position: 'static', paddingRight: '0px' });
});

test('statuses use the terminal vocabulary without rewriting narrative copy', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const terminalStatuses = ['Active', 'Paused', 'Completed'];
  const expected: Record<string, string> = {
    'todays-brief': 'Completed',
    'this-site': 'Active',
    chap: 'Paused',
    jukdata: 'Completed',
    'surface-runoff': 'Completed',
  };
  for (const [slug, status] of Object.entries(expected)) {
    await page.goto(`/projects/${slug}/`);
    const value = page.locator('.project-meta-item__value').nth(3);
    await expect(value, slug).toHaveText(status);
    expect(terminalStatuses, slug).toContain(await value.textContent());
  }
  // The narrative keeps its own wording: only the Status field was normalised.
  await page.goto('/projects/jukdata/');
  await expect(page.locator('.project-page')).toContainText('Complete product');
});

test("Today's Brief inset visual fills its side gutters with the screenshot's paper tone", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/projects/todays-brief/');
  await page.evaluate(() => document.fonts.ready);
  const band = page.locator('.project-visual-full--inset');
  await expect(band).toHaveCount(1);
  // #fdfbf7 is the median colour of the screenshot's paper edge.
  await expect(band).toHaveCSS('background-color', 'rgb(253, 251, 247)');

  const [bandBox, imageBox] = [(await band.boundingBox())!, (await band.locator('img').boundingBox())!];
  // The image keeps its inset geometry; only the exposed gutters changed tone.
  expect(imageBox.width).toBeCloseTo(Math.min(bandBox.width * 0.8, 64 * 16), 0);
  expect(imageBox.x - bandBox.x).toBeGreaterThan(0);
  expect(bandBox.x + bandBox.width - (imageBox.x + imageBox.width)).toBeGreaterThan(0);

  // The tint is scoped to the inset variant only. Today's Brief authors two
  // gallery images, so its one other visual is the cover band.
  const otherVisuals = page.locator('.project-visual-full:not(.project-visual-full--inset)');
  await expect(otherVisuals).toHaveCount(1);
  for (const visual of await otherVisuals.all()) {
    await expect(visual).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  }
  await page.goto('/projects/surface-runoff/');
  await expect(page.locator('.project-visual-full--inset')).toHaveCount(0);
  await expect(page.locator('.project-visual-full').nth(1)).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
});

// Today's Brief authors two gallery images, so the third visual slot is guarded
// on the image's presence: the Technical column hands over to Reflection with no
// full-bleed placeholder band in between.
test("Today's Brief ends its visuals after the second image", async ({ page }) => {
  for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 1000 }]) {
    await page.setViewportSize(viewport);
    await page.goto('/projects/todays-brief/');
    await page.evaluate(() => document.fonts.ready);
    const where = `${viewport.width}px`;

    const visuals = page.locator('.project-visual-full');
    await expect(visuals, where).toHaveCount(2);
    await expect(page.locator('.project-visual-placeholder'), where).toHaveCount(0);
    await expect(page.locator('.project-visual-code'), where).toHaveCount(0);

    const images = visuals.locator('img');
    await expect(images, where).toHaveCount(2);
    await expect(images.nth(0), where).toHaveAttribute('src', '/images/projects/todays-brief-card.webp');
    await expect(images.nth(1), where).toHaveAttribute('src', '/images/projects/todays-brief-world.webp');
    for (const image of await images.all()) {
      await image.scrollIntoViewIfNeeded();
      await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.naturalWidth)).toBeGreaterThan(0);
    }

    // The World band keeps the inset cream that carries the page into its gutters.
    const inset = page.locator('.project-visual-full--inset');
    await expect(inset, where).toHaveCount(1);
    await expect(inset, where).toHaveCSS('background-color', 'rgb(253, 251, 247)');
    await expect(inset.locator('img'), where).toHaveAttribute('src', '/images/projects/todays-brief-world.webp');

    // The Technical section's next sibling is the Reflection section itself, so
    // the two columns meet with no band between them.
    const technical = page.locator('.project-editorial--left');
    const reflection = page.locator('.project-editorial').last();
    await expect(reflection.locator('.project-editorial-label'), where).toHaveText('Reflection');
    const nextSibling = await technical.evaluate((element) => [...(element.nextElementSibling?.classList ?? [])]);
    expect(nextSibling, where).toContain('project-editorial');
    expect(nextSibling, where).not.toContain('project-visual-full');
    const [technicalBox, reflectionBox] = [(await technical.boundingBox())!, (await reflection.boundingBox())!];
    expect(reflectionBox.y, `${where} no orphan band`).toBeCloseTo(technicalBox.y + technicalBox.height, 0);

    // Removing the band leaves no horizontal overflow.
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, where).toBeLessThanOrEqual(0);
  }

  // The other four project pages render their authored gallery visuals in the
  // built pages, which is the shipped artefact. Today's Brief authors two gallery
  // images and JUKdata renders two: its mid-page technology strip is hidden, so
  // its expected list drops jukdata-2 and keeps the hero and detail bands.
  const visualPages: Record<string, string[]> = {
    'this-site': [
      '/screenshots/this-site-card.webp',
      '/screenshots/this-site-overview.webp',
      '/screenshots/this-site-detail.webp',
    ],
    chap: ['/chap-card-full.webp', '/images/projects/chap-2.webp', '/images/projects/chap-3.webp'],
    jukdata: ['/jukdata-card.webp', '/images/projects/jukdata-3.webp'],
    'surface-runoff': [
      '/images/projects/surface-runoff-rain-storm.webp',
      '/images/projects/surface-runoff-water-depth.webp',
      '/images/projects/surface-runoff-soil-saturation.webp',
    ],
  };
  for (const [slug, sources] of Object.entries(visualPages)) {
    const html = readDist(`/projects/${slug}/index.html`);
    // One band per authored source: three everywhere except JUKdata's two.
    expect(html.match(/class="project-visual-full/g), slug).toHaveLength(sources.length);
    for (const source of sources) expect(html, `${slug} ${source}`).toContain(`src="${source}"`);
  }
  const today = readDist('/projects/todays-brief/index.html');
  expect(today.match(/class="project-visual-full/g)).toHaveLength(2);
  expect(today).not.toContain('project-visual-placeholder');
  const jukdata = readDist('/projects/jukdata/index.html');
  expect(jukdata).not.toContain('jukdata-2.webp');
});

// JUKdata's second gallery image is a technology logo strip that reads as a
// divider, so the whole band is skipped for that project. The hero and detail
// bands stay, Overview hands straight over to Technical, and no empty band or
// extra gap is left behind where the strip used to sit.
test('JUKdata skips its technology strip between Overview and Technical', async ({ page }) => {
  for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 1000 }]) {
    await page.setViewportSize(viewport);
    await page.goto('/projects/jukdata/');
    await page.evaluate(() => document.fonts.ready);
    const where = `${viewport.width}px`;

    const visuals = page.locator('.project-visual-full');
    await expect(visuals, where).toHaveCount(2);
    const images = visuals.locator('img');
    await expect(images, where).toHaveCount(2);
    await expect(images.nth(0), where).toHaveAttribute('src', '/jukdata-card.webp');
    await expect(images.nth(1), where).toHaveAttribute('src', '/images/projects/jukdata-3.webp');
    for (const image of await images.all()) {
      await image.scrollIntoViewIfNeeded();
      await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.naturalWidth)).toBeGreaterThan(0);
    }
    await expect(page.locator('img[src*="jukdata-2"]'), where).toHaveCount(0);
    await expect(page.locator('.project-visual-placeholder'), where).toHaveCount(0);
    await expect(page.locator('.project-visual-code'), where).toHaveCount(0);

    // Overview's next sibling is the Technical column itself, so the band was
    // removed outright rather than rendered as an empty box.
    const overview = page.locator('.project-editorial').first();
    await expect(overview.locator('.project-editorial-label'), where).toHaveText('Overview');
    const technical = page.locator('.project-editorial--left');
    const nextSibling = await overview.evaluate((element) => [...(element.nextElementSibling?.classList ?? [])]);
    expect(nextSibling, where).toContain('project-editorial--left');
    expect(nextSibling, where).not.toContain('project-visual-full');
    const [overviewBox, technicalBox] = [(await overview.boundingBox())!, (await technical.boundingBox())!];
    expect(technicalBox.y, `${where} no orphan band`).toBeCloseTo(overviewBox.y + overviewBox.height, 0);

    // The Reflection column below the detail band is untouched.
    const reflection = page.locator('.project-editorial').last();
    await expect(reflection.locator('.project-editorial-label'), where).toHaveText('Reflection');
    await expect(reflection, where).toContainText('Warming up the data');

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, where).toBeLessThanOrEqual(0);
  }
});

// Planned cards lead Selected Work: card-only entries with no page, route or
// More Works slot.
const plannedCards = [
  {
    title: 'diucon',
    label: 'E-commerce Insights Platform',
    year: '2026',
    image: '/images/projects/diucon-card.webp',
    variants: [
      '/images/projects/diucon-card-800.webp',
      '/images/projects/diucon-card-1600.webp',
    ],
  },
  {
    title: 'Horseflight',
    label: 'Occasionally Brilliant Chess Engine',
    year: '2026',
    image: '/images/projects/horseflight-card.webp',
    variants: [
      '/images/projects/horseflight-card-800.webp',
      '/images/projects/horseflight-card-1600.webp',
    ],
  },
];

const assertPlannedCard = async (card: Locator, plannedCard: (typeof plannedCards)[number]) => {
  await expect(card).toHaveClass(/selected-work__item--planned/);

  // Non-interactive: a div wrapper with no href, role, tab stop or link.
  const wrapper = card.locator('.selected-work__link');
  expect(await wrapper.evaluate((element) => element.tagName)).toBe('DIV');
  expect(await wrapper.getAttribute('href')).toBeNull();
  expect(await wrapper.getAttribute('role')).toBeNull();
  expect(await wrapper.getAttribute('tabindex')).toBeNull();
  await expect(card.locator('a')).toHaveCount(0);
  await expect(card.getByRole('link')).toHaveCount(0);
  expect(await wrapper.evaluate((element) => getComputedStyle(element).cursor)).toBe('auto');

  // Exact card copy.
  const name = card.locator('.selected-work__name');
  const descriptor = card.locator('.selected-work__descriptor');
  const year = card.locator('.selected-work__year');
  await expect(name).toHaveText(plannedCard.title);
  await expect(descriptor).toHaveText(plannedCard.label);
  await expect(year).toHaveText(plannedCard.year);

  // 'Planned' is italic, after the name, and right-aligned with the year below.
  const planned = card.locator('.selected-work__planned');
  await expect(planned).toHaveText('Planned');
  expect(await planned.evaluate((element) => getComputedStyle(element).fontStyle)).toBe('italic');
  // IBM Plex Mono ships regular only, so the italic needs local style synthesis.
  expect(await planned.evaluate((element) => getComputedStyle(element).fontSynthesisStyle)).toBe('auto');
  const [nameBox, plannedBox, yearBox, cardBox] = [
    (await name.boundingBox())!,
    (await planned.boundingBox())!,
    (await year.boundingBox())!,
    (await card.boundingBox())!,
  ];
  expect(plannedBox.x).toBeGreaterThan(nameBox.x + nameBox.width);
  // The shared 2px optical lift sits the label just above the name's centre.
  const centerOffset = plannedBox.y + plannedBox.height / 2 - (nameBox.y + nameBox.height / 2);
  expect(centerOffset).toBeGreaterThanOrEqual(-3);
  expect(centerOffset).toBeLessThanOrEqual(-1);
  expect(plannedBox.y).toBeGreaterThanOrEqual(nameBox.y - 3);
  expect(plannedBox.y + plannedBox.height).toBeLessThanOrEqual(nameBox.y + nameBox.height + 1);
  expect(Math.abs(plannedBox.x + plannedBox.width - (yearBox.x + yearBox.width))).toBeLessThanOrEqual(1);
  expect(plannedBox.x + plannedBox.width).toBeLessThanOrEqual(cardBox.x + cardBox.width);
  expect(plannedBox.x).toBeGreaterThanOrEqual(cardBox.x);

  // The name keeps its card size at every width. The planned card is exempt
  // from the shared two-line clamp, so its full descriptor is visible - no
  // overflow at any width.
  const nameSize = await name.evaluate((element) => parseFloat(getComputedStyle(element).fontSize));
  expect(nameSize).toBeGreaterThanOrEqual(24);
  const descriptorBox = await descriptor.evaluate((element) => ({
    text: element.textContent,
    scrollHeight: element.scrollHeight,
    clientHeight: element.clientHeight,
    scrollWidth: element.scrollWidth,
    clientWidth: element.clientWidth,
    lineClamp: getComputedStyle(element).webkitLineClamp,
  }));
  expect(descriptorBox.text).toBe(plannedCard.label);
  expect(descriptorBox.lineClamp).toBe('none');
  expect(descriptorBox.scrollHeight).toBeLessThanOrEqual(descriptorBox.clientHeight + 1);
  expect(descriptorBox.scrollWidth).toBeLessThanOrEqual(descriptorBox.clientWidth + 1);

  // The generated card image and both srcset variants are wired and load.
  const image = card.locator('.product-shot__img');
  await expect(image).toHaveAttribute('src', plannedCard.image);
  const srcset = (await image.getAttribute('srcset')) ?? '';
  expect(srcset).toContain(`${plannedCard.image.replace(/\.webp$/, '-800.webp')} 800w`);
  expect(srcset).toContain(`${plannedCard.image.replace(/\.webp$/, '-1600.webp')} 1600w`);
  await image.scrollIntoViewIfNeeded();
  await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.naturalWidth)).toBeGreaterThan(0);
};

for (const width of [320, 390, 1440]) {
  test(`planned cards lead Selected Work as non-clickable cards at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);

    const cards = page.locator('.selected-work__item');
    await expect(cards).toHaveCount(7);
    await expect(page.locator('a.selected-work__link')).toHaveCount(5);
    await expect(page.locator('.selected-work__item--planned')).toHaveCount(2);
    // Diucon leads, Horseflight follows, then the five shipped projects.
    await expect(cards.nth(0).locator('.selected-work__name')).toHaveText('diucon');
    await expect(cards.nth(1).locator('.selected-work__name')).toHaveText('Horseflight');
    await expect(cards.nth(2).locator('.selected-work__name')).toHaveText("Today's Brief");

    for (const [index, plannedCard] of plannedCards.entries()) {
      await assertPlannedCard(cards.nth(index), plannedCard);
    }

    // The five shipped cards keep the shared two-line descriptor clamp.
    const shipped = page.locator('.selected-work__item:not(.selected-work__item--planned) .selected-work__descriptor');
    await expect(shipped).toHaveCount(5);
    const shippedClamps = await shipped.evaluateAll(elements =>
      elements.map(element => getComputedStyle(element).webkitLineClamp));
    for (const lineClamp of shippedClamps) {
      expect(lineClamp).toBe('2');
    }
  });
}

test('Selected Work subtext and year step down to 95% with a tighter row gap', async ({ page }) => {
  const cases = [
    // Below the desktop breakpoint the descriptor sits on its 0.97375rem floor.
    { width: 320, name: 24, descriptor: 15.58 },
    { width: 390, name: 24, descriptor: 15.58 },
    // Tablet keeps the label-row tracking band but the descriptor carries its
    // own negative tracking, so the new value must win over the inherited one.
    { width: 900, name: 24, descriptor: 15.58 },
    { width: 1199, name: 29.975, descriptor: 15.58 },
    { width: 1440, name: 36, descriptor: 15.58 },
    // 1822-2000px is the only band where the desktop clamp takes its 0.855vw
    // middle term: 95% of the former 0.9vw middle at the same viewport.
    { width: 1920, name: 36, descriptor: 16.416 },
  ];

  for (const { width, name, descriptor } of cases) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    const where = `${width}px`;

    const cards = await page.locator('.selected-work__item').evaluateAll((items) =>
      items.map((item) => {
        const size = (selector: string) => {
          const element = item.querySelector(selector);
          return element ? parseFloat(getComputedStyle(element).fontSize) : null;
        };
        const meta = item.querySelector('.selected-work__meta')!;
        const label = item.querySelector('.selected-work__descriptor')!;
        const year = item.querySelector('.selected-work__year')!;
        return {
          title: item.querySelector('.selected-work__name')!.textContent,
          name: size('.selected-work__name'),
          descriptor: size('.selected-work__descriptor'),
          year: size('.selected-work__year'),
          planned: size('.selected-work__planned'),
          rowGap: parseFloat(getComputedStyle(meta).rowGap),
          labelRowMarginTop: parseFloat(getComputedStyle(item.querySelector('.selected-work__label-row')!).marginTop),
          descriptorLetterSpacing: getComputedStyle(label).letterSpacing,
          labelOverflow: {
            scrollWidth: label.scrollWidth,
            clientWidth: label.clientWidth,
            scrollHeight: label.scrollHeight,
            clientHeight: label.clientHeight,
          },
          yearRight: year.getBoundingClientRect().right,
          cardRight: item.getBoundingClientRect().right,
        };
      }));

    expect(cards, where).toHaveLength(7);
    for (const card of cards) {
      expect(card.name, `${card.title} name ${where}`).toBeCloseTo(name, 2);
      expect(card.descriptor, `${card.title} descriptor ${where}`).toBeCloseTo(descriptor, 2);
      // The year and the planned tag keep one size, both 95% of 0.95rem.
      expect(card.year, `${card.title} year ${where}`).toBeCloseTo(14.44, 2);
      if (card.planned !== null) {
        expect(card.planned, `${card.title} planned ${where}`).toBeCloseTo(14.44, 2);
      }
      // The label and year rows close up against the name row.
      expect(card.rowGap, `${card.title} row gap ${where}`).toBeCloseTo(1.6, 2);
      // The row sits 2px higher, and the description tightens its own tracking
      // (rather than inheriting the wider label-row value at tablet widths).
      expect(card.labelRowMarginTop, `${card.title} label row margin ${where}`).toBeCloseTo(5.2, 2);
      expect(parseFloat(card.descriptorLetterSpacing), `${card.title} descriptor tracking ${where}`)
        .toBeCloseTo(card.descriptor! * -0.025, 2);
      // The planned descriptors are the longest strings on the cards and carry
      // no clamp: at every width the smaller type still shows all of the copy.
      if (card.planned !== null) {
        expect(card.labelOverflow.scrollHeight, `${card.title} label height ${where}`)
          .toBeLessThanOrEqual(card.labelOverflow.clientHeight + 1);
        expect(card.labelOverflow.scrollWidth, `${card.title} label width ${where}`)
          .toBeLessThanOrEqual(card.labelOverflow.clientWidth + 1);
      }
      expect(card.yearRight, `${card.title} year inside card ${where}`).toBeLessThanOrEqual(card.cardRight);
    }
  }
});

test('planned cards share the card hover effect without being clickable', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  const cards = page.locator('.selected-work__item');

  // Each planned card settles on the shared hover state - shrunk card, smaller
  // ghost copy at full opacity, dimmed base image - not a still, disabled look.
  const expectHoverState = async (card: Locator) => {
    await expect.poll(() => card.evaluate((element) => getComputedStyle(element).scale)).toBe('0.97');
    await expect(card.locator('.product-shot__ghost')).toHaveCSS('opacity', '1');
    await expect(card.locator('.product-shot__img')).toHaveCSS('opacity', '0.4');
  };
  for (const [index, plannedCard] of plannedCards.entries()) {
    const card = cards.nth(index);
    await expect(card.locator('.selected-work__name')).toHaveText(plannedCard.title);
    await card.scrollIntoViewIfNeeded();
    await card.hover();
    await expectHoverState(card);

    // Hovering it never turns it into a link: clicking does not navigate.
    const before = page.url();
    await card.locator('.product-shot').click();
    await page.waitForTimeout(500);
    expect(page.url()).toBe(before);
  }

  // The shipped cards still link out, and reach the identical hover state.
  const linkedCard = cards.nth(2);
  expect(await linkedCard.locator('.selected-work__link').evaluate((element) => element.tagName)).toBe('A');
  await expect(linkedCard.locator('.selected-work__link')).toHaveAttribute('href', '/projects/todays-brief/');
  await linkedCard.hover();
  await expectHoverState(linkedCard);
});

test('planned cards serve their assets and stay out of routes, the sitemap and More Works', async ({ page }) => {
  for (const plannedCard of plannedCards) {
    for (const url of [plannedCard.image, ...plannedCard.variants]) {
      expect((await page.request.get(url)).status(), url).toBe(200);
    }
    // No detail page was generated for the planned cards.
    const route = `/projects/${plannedCard.title.toLowerCase()}/`;
    expect((await page.request.get(route)).status(), route).toBe(404);
  }

  // The built sitemap lists the five shipped projects and no planned card.
  const sitemap = readFileSync(new URL('../dist/sitemap-0.xml', import.meta.url), 'utf8');
  expect(sitemap).toContain('/projects/todays-brief/');
  expect(sitemap).toContain('/projects/surface-runoff/');
  expect(sitemap).not.toMatch(/diucon|horseflight/i);

  // The homepage carries the card copy but never a link to a planned route.
  const home = await (await page.request.get('/')).text();
  expect(home).toContain('diucon');
  expect(home).toContain('Horseflight');
  expect(home).not.toMatch(/href="\/projects\/(?:diucon|horseflight)/i);
  expect(home.match(/class="selected-work__item selected-work__item--planned"/g)).toHaveLength(2);

  // More Works still draws from the shipped projects only.
  await page.goto('/projects/chap/');
  const moreWorks = page.locator('.project-more__name');
  await expect(moreWorks).toHaveCount(2);
  for (const more of await moreWorks.all()) {
    expect((await more.textContent())?.toLowerCase()).not.toMatch(/diucon|horseflight/);
  }
});

// ── Responsive image delivery ─────────────────────────────────────────────────
//
// Detail galleries and More Works used to request the full-resolution file at
// every viewport. The metadata table drives both the generated variants and the
// descriptors, so the tests below check the shipped bytes rather than the table
// alone: a descriptor that does not equal its file's real width would make the
// browser pick a candidate it cannot fill.

test('every declared variant is a real file at its descriptor width', () => {
  const sources = Object.entries(responsiveImages);
  expect(sources.length).toBeGreaterThan(0);

  for (const [src, image] of sources) {
    expect(webpSize(src), src).toEqual({ width: image.width, height: image.height });
    for (const width of image.variants) {
      const variant = src.replace(/\.webp$/, `-${width}.webp`);
      const size = webpSize(variant);
      expect(size.width, variant).toBe(width);
      // A resize keeps the source's ratio; the odd pixel is rounding.
      expect(Math.abs(size.height - (image.height * width) / image.width), variant).toBeLessThanOrEqual(1);
      // A low-resolution source never gets an enlarged variant.
      expect(width, `${variant} would enlarge ${src}`).toBeLessThan(image.width);
    }
  }
});

test('srcset descriptors are the files themselves, ending at the untouched original', () => {
  for (const [src, image] of Object.entries(responsiveImages)) {
    // An animated source has no resized siblings, so it offers no srcset at all.
    if (image.variants.length === 0) {
      expect(imageSrcSet(src), src).toBeUndefined();
      expect(animatedFigures, src).toContain(src);
      continue;
    }

    const candidates = imageSrcSet(src)!.split(', ').map((entry) => {
      const [url, descriptor] = entry.split(' ');
      return { url: url!, width: Number(descriptor!.replace('w', '')) };
    });

    expect(candidates.map((candidate) => candidate.width), src).toEqual([...image.variants, image.width]);
    for (const candidate of candidates) {
      expect(webpSize(candidate.url).width, candidate.url).toBe(candidate.width);
    }
    expect(candidates.at(-1)!.url, src).toBe(src);
  }
});

test('built detail pages offer responsive candidates for galleries and More Works', () => {
  const moreSizes = '(max-width: 600px) 92vw, 46vw';
  const gallerySizes = ['100vw', '(min-width: 80rem) 64rem, 80vw'];
  const pages = ['todays-brief', 'this-site', 'chap', 'jukdata', 'surface-runoff'];

  for (const slug of pages) {
    const html = readDist(`/projects/${slug}/index.html`);
    const images = [...html.matchAll(/<img ([^>]*)>/g)].map((match) => match[1]!);
    expect(images.length, slug).toBeGreaterThan(0);

    for (const tag of images) {
      const src = tag.match(/src="([^"]+)"/)?.[1]!;
      const isMoreWork = tag.includes(`sizes="${moreSizes}"`);
      const sizes = tag.match(/sizes="([^"]*)"/)?.[1];
      const srcset = tag.match(/srcset="([^"]*)"/)?.[1];

      if (animatedFigures.includes(src)) {
        // A resized copy would freeze the 160-frame plot, so the band loads the
        // animated original and declares no candidate list at all.
        expect(srcset, `${slug} ${src} keeps its animation`).toBeUndefined();
        expect(sizes, `${slug} ${src} has no sizes without srcset`).toBeUndefined();
        continue;
      }

      expect(sizes, `${slug} every image declares sizes`).toBeDefined();
      if (isMoreWork) {
        expect(sizes, `${slug} More Works`).toBe(moreSizes);
      } else {
        expect(gallerySizes, `${slug} gallery band`).toContain(sizes);
      }

      expect(srcset, `${slug} ${tag}`).toBeDefined();
      for (const entry of srcset!.split(', ')) {
        const [url, descriptor] = entry.split(' ');
        expect(webpSize(url!).width, `${slug} ${url}`).toBe(Number(descriptor!.replace('w', '')));
      }
    }

    // The first band loads eagerly at high priority; later bands stay lazy.
    const gallery = images.filter((tag) => !tag.includes(`sizes="${moreSizes}"`));
    expect(gallery[0], slug).toContain('loading="eager"');
    expect(gallery[0], slug).toContain('fetchpriority="high"');
    for (const tag of gallery.slice(1)) expect(tag, slug).toContain('loading="lazy"');

    // Each band still opens its full-size original, which is also the file `src`
    // falls back to when srcset is unsupported.
    const openers = [...html.matchAll(/<a class="project-visual-image[^"]*" href="([^"]+)"[^>]*>\s*<img src="([^"]+)"/g)];
    expect(openers.length, slug).toBe(gallery.length);
    for (const [, href, imgSrc] of openers) {
      expect(imgSrc, slug).toBe(href);
      expect(webpSize(href!).width, href).toBeGreaterThanOrEqual(800);
    }

    // More Works pairs every candidate with its hover ghost.
    const moreWork = images.filter((tag) => tag.includes(`sizes="${moreSizes}"`));
    expect(moreWork.length, slug).toBe(4);

    // Planned entries never appear here, and the skip for JUKdata's strip holds.
    expect(html, slug).not.toMatch(/diucon|horseflight|jukdata-2/);
  }
});

test('mobile detail pages request an 800px candidate while originals stay linked', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const firstVisuals: Record<string, string> = {
    'todays-brief': '/images/projects/todays-brief-card.webp',
    'this-site': '/screenshots/this-site-card.webp',
    chap: '/chap-card-full.webp',
    jukdata: '/jukdata-card.webp',
    'surface-runoff': '/images/projects/surface-runoff-rain-storm.webp',
  };

  for (const [slug, original] of Object.entries(firstVisuals)) {
    await page.goto(`/projects/${slug}/`);
    const image = page.locator('.project-visual-image img').first();
    await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.naturalWidth)).toBeGreaterThan(0);

    // 390 CSS px of a full-bleed band needs the 800px file, not the 3840-6688px
    // one. The animated Surface Runoff figures have no static sibling, so they
    // intentionally stay on their original.
    const expected = animatedFigures.includes(original) ? original : original.replace(/\.webp$/, '-800.webp');
    expect(await image.evaluate((element: HTMLImageElement) => new URL(element.currentSrc).pathname), slug)
      .toBe(expected);

    // The untouched original is still the open-original target at its native size.
    await expect(page.locator('.project-visual-image').first(), slug).toHaveAttribute('href', original);
    expect(webpSize(original).width, original).toBe(imageFor(original)?.width);

    // More Works thumbnails draw from the same variants instead of the full file.
    // A lazy image reports an empty `currentSrc` until the browser has picked a
    // candidate, so that transient state polls instead of throwing.
    for (const thumbnail of await page.locator('.project-more__img-main').all()) {
      await thumbnail.scrollIntoViewIfNeeded();
      await expect.poll(() => thumbnail.evaluate((element: HTMLImageElement) => (
        element.currentSrc ? new URL(element.currentSrc).pathname : ''
      ))).toMatch(/-800\.webp$/);
    }
  }
});

// The three Surface Runoff figures are 160-frame animated WebPs, so their
// responsive story is the opposite of the static assets': a resized copy would
// drop 159 frames and freeze the plot, and an animated re-encode at the same
// quality is larger than the original (measured: 679/1141/463 KB at 1200px for
// originals of 465/769/353 KB). They therefore keep their original file at every
// viewport, which this test both documents and protects.
test('animated Surface Runoff figures keep their original file at every density', async ({ browser }) => {
  for (const src of animatedFigures) {
    // The table records the asset's real size but no resized variants.
    expect(imageFor(src)?.variants, src).toEqual([]);
    // 160 frames of the simulation, not a still.
    expect(webpFrameCount(src), src).toBe(160);
  }

  // The built page offers the originals and no static sibling of any width.
  const html = readDist('/projects/surface-runoff/index.html');
  for (const src of animatedFigures) {
    const base = src.replace(/\.webp$/, '');
    expect(html, src).toContain(`src="${src}"`);
    expect(html, `${src} has no -800 sibling in the markup`).not.toContain(`${base}-800.webp`);
    expect(html, `${src} has no -1200 sibling in the markup`).not.toContain(`${base}-1200.webp`);
  }

  // A high-density phone asks for the animated original, receives all of it, and
  // still opens the same file from the image link.
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });
  const page = await context.newPage();
  await page.route('**/_vercel/**', route => route.fulfill({ status: 204 }));

  const transferred = new Map<string, number>();
  page.on('response', async (response) => {
    if (response.request().resourceType() !== 'image') return;
    try {
      transferred.set(new URL(response.url()).pathname, (await response.body()).length);
    } catch {
      // A response without a body (redirect, 204) carries no image bytes.
    }
  });

  await page.goto('/projects/surface-runoff/');
  const visuals = page.locator('.project-visual-image');
  await expect(visuals).toHaveCount(animatedFigures.length);

  for (const [index, src] of animatedFigures.entries()) {
    const visual = visuals.nth(index);
    await visual.scrollIntoViewIfNeeded();
    await expect.poll(() => visual.locator('img').evaluate((image: HTMLImageElement) => new URL(image.currentSrc).pathname), src)
      .toBe(src);
    await expect(visual, src).toHaveAttribute('href', src);
    await expect.poll(() => transferred.has(src), src).toBe(true);
    expect(transferred.get(src), src).toBe(statSync(new URL(`../dist${src}`, import.meta.url)).size);
  }

  await context.close();
});

// Every other shipped source is a still image, so a resize reproduces exactly
// what the original shows and the responsive candidates are safe to offer.
test('every non-animated responsive source is a still image with real variants', () => {
  for (const [src, image] of Object.entries(responsiveImages)) {
    if (animatedFigures.includes(src)) continue;
    expect(webpFrameCount(src), src).toBe(1);
    expect(image.variants.length, src).toBeGreaterThan(0);
  }
});

test('desktop galleries still reach a high-density candidate', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  for (const [slug, expected] of [
    // A 1440px band asks for 1600px, so the mid variant is chosen, not the 2880/6688px original.
    ['this-site', '/screenshots/this-site-overview-1600.webp'],
    ['chap', '/images/projects/chap-2-1600.webp'],
    // The 1400px figure has no larger sibling: the original is the honest choice.
    ['surface-runoff', '/images/projects/surface-runoff-water-depth.webp'],
  ] as const) {
    await page.goto(`/projects/${slug}/`);
    const image = page.locator('.project-visual-image img').nth(1);
    await image.scrollIntoViewIfNeeded();
    await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.currentSrc))
      .toContain(expected);
  }
});

// ── Document structure and landmarks ────────────────────────────────────────

test('the homepage script ships inside the document, so the CSP stays self-only', () => {
  const policy = (JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8')) as {
    headers: { headers: { key: string; value: string }[] }[];
  }).headers[0]!.headers.find((header) => header.key === 'Content-Security-Policy')!.value;
  expect(policy).toContain("script-src 'self'");
  expect(policy).not.toContain('unsafe-inline');

  for (const file of ['/index.html', '/404.html', '/projects/chap/index.html']) {
    const html = readDist(file);
    // Nothing is emitted after the closing element any more.
    expect(html.trimEnd().endsWith('</html>'), file).toBe(true);
    expect(html.slice(html.lastIndexOf('</html>')), file).not.toContain('<script');

    // Every executable script is an external module the policy allows.
    const inline = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>/g)]
      .map((match) => match[0])
      .filter((tag) => !tag.includes('application/ld+json'));
    expect(inline, file).toEqual([]);
  }

  const home = readDist('/index.html');
  const fallback = home.indexOf('/_astro/index.astro_astro_type_script_index_0_lang');
  expect(fallback).toBeGreaterThan(home.indexOf('</footer>'));
  expect(fallback).toBeLessThan(home.indexOf('</body>'));
});

test('the site footer is one page-level contentinfo landmark', async ({ page }) => {
  for (const path of ['/', '/projects/todays-brief/', '/projects/this-site/', '/projects/chap/', '/projects/jukdata/', '/projects/surface-runoff/']) {
    await page.goto(path);
    const footer = page.getByRole('contentinfo');
    await expect(footer, path).toHaveCount(1);
    await expect(footer, path).toHaveAttribute('aria-label', 'Site footer');
    await expect(footer.getByRole('link', { name: 'GitHub', exact: true }), path).toHaveCount(1);
  }
});

// ── Fresh production preview ────────────────────────────────────────────────
//
// The suite builds and serves its own output on a dedicated port. Reusing a
// running server used to let these tests inspect an Astro dev server (or an
// older preview) while reading a stale `dist/`.

test('the suite is served by its own fresh production build', async ({ page, baseURL }) => {
  expect(baseURL, 'the dev server port stays free').not.toContain(':4322');

  const response = await page.request.get('/');
  expect(response.status()).toBe(200);
  // The served document is the build on disk: a dev server injects its own
  // client and the Astro toolbar, and a stale preview serves older markup.
  expect(await response.text()).toBe(readDist('/index.html'));
});

// ── Exit-animation fallback ─────────────────────────────────────────────────
//
// The fallback only runs where the View Transitions API is missing (older
// Firefox), so these tests remove the API before the page's module script runs
// and exercise the real branch instead of a rewritten copy of it.

const withoutViewTransitions = (page: Page) =>
  page.addInitScript(() => {
    Object.defineProperty(document, 'startViewTransition', { configurable: true, value: undefined });
  });

const firstProjectCard = (page: Page) => page.locator('a.selected-work__link').first();

test.describe('exit-animation fallback without View Transitions', () => {
  test.use({ reducedMotion: 'no-preference' });

  test('modified clicks keep their native new-tab behaviour', async ({ page, context }) => {
    await withoutViewTransitions(page);

    for (const modifier of ['Control', 'Shift'] as const) {
      await page.goto('/');
      await expect(firstProjectCard(page)).toHaveAttribute('href', '/projects/todays-brief/');

      // Chromium opens the project in another tab and leaves this one in place.
      const opened = context.waitForEvent('page');
      await firstProjectCard(page).click({ modifiers: [modifier] });
      const tab = await opened;
      expect(context.pages().length, `${modifier} opens a second tab`).toBe(2);

      // The popup document's own location is the fact under test. `tab.url()`
      // is Playwright's bookkeeping copy of it, and that copy can stay at
      // `about:blank` for the whole run when the new tab commits its navigation
      // before Playwright adopts it (measured on roughly half of concurrent
      // runs while the document itself was already on the project page).
      await tab.waitForFunction(() => location.pathname === '/projects/todays-brief/');
      expect(await tab.evaluate(() => location.pathname), modifier).toBe('/projects/todays-brief/');
      await expect(page, modifier).toHaveURL(/\/$/);

      // No exit animation was started on the page behind it.
      const body = await page.evaluate(() => ({
        position: document.body.style.position,
        transform: document.body.style.transform,
      }));
      expect(body, modifier).toEqual({ position: '', transform: '' });
      await tab.close();
    }
  });

  test('non-primary and modifier-only clicks are not swallowed', async ({ page }) => {
    await withoutViewTransitions(page);
    await page.goto('/');

    const outcomes = await page.evaluate(() => {
      const link = document.querySelector<HTMLAnchorElement>('a.selected-work__link')!;
      // Keep the page alive so the default action cannot navigate away.
      link.href = '#work';
      const click = (init: MouseEventInit) => {
        const event = new MouseEvent('click', { bubbles: true, cancelable: true, ...init });
        link.dispatchEvent(event);
        return {
          prevented: event.defaultPrevented,
          position: document.body.style.position,
          transform: document.body.style.transform,
        };
      };
      return {
        ctrl: click({ ctrlKey: true }),
        meta: click({ metaKey: true }),
        shift: click({ shiftKey: true }),
        alt: click({ altKey: true }),
        middle: click({ button: 1 }),
      };
    });

    for (const [kind, outcome] of Object.entries(outcomes)) {
      // Left to the browser: not prevented, and no exit move applied.
      expect(outcome, kind).toEqual({ prevented: false, position: '', transform: '' });
    }
  });

  test('a click another handler cancels is not animated', async ({ page }) => {
    await withoutViewTransitions(page);
    await page.goto('/');

    const outcome = await page.evaluate(() => {
      const link = document.querySelector<HTMLAnchorElement>('a.selected-work__link')!;
      link.href = '#work';
      // A capture listener runs before the page's own handler.
      const cancel = (event: Event) => event.preventDefault();
      document.addEventListener('click', cancel, { capture: true, once: true });
      const event = new MouseEvent('click', { bubbles: true, cancelable: true });
      link.dispatchEvent(event);
      document.removeEventListener('click', cancel, { capture: true });
      return { prevented: event.defaultPrevented, position: document.body.style.position };
    });

    expect(outcome).toEqual({ prevented: true, position: '' });
  });

  test('a primary click still plays the exit animation before navigating', async ({ page }) => {
    await withoutViewTransitions(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await expect(firstProjectCard(page)).toBeVisible();

    // `click()` inside the page runs the handler synchronously, so the state is
    // read before the 450ms navigation delay elapses.
    await page.evaluate(() => document.querySelector<HTMLAnchorElement>('a.selected-work__link')!.click());
    const state = await page.evaluate(() => document.body.style.position);
    expect(state).toBe('fixed');

    const moved = await page.evaluate(() => new Promise<boolean>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve(document.body.style.transform !== '')));
    }));
    expect(moved).toBe(true);

    await page.waitForURL('**/projects/todays-brief/');
  });
});

test.describe('exit-animation fallback with reduced motion', () => {
  test('a card click navigates without the exit animation', async ({ page }) => {
    await withoutViewTransitions(page);
    await page.goto('/');

    const outcome = await page.evaluate(() => {
      const link = document.querySelector<HTMLAnchorElement>('a.selected-work__link')!;
      link.href = '#work';
      const event = new MouseEvent('click', { bubbles: true, cancelable: true });
      link.dispatchEvent(event);
      return { prevented: event.defaultPrevented, position: document.body.style.position };
    });

    // Reduced motion keeps the plain navigation: the handler never takes over.
    expect(outcome).toEqual({ prevented: false, position: '' });
  });

  test('a real click still reaches the project', async ({ page }) => {
    await withoutViewTransitions(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await firstProjectCard(page).click();
    await page.waitForURL('**/projects/todays-brief/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText("Today's Brief");
  });
});

test('the native view-transition path is left alone', async ({ page }) => {
  await page.goto('/');
  expect(await page.evaluate(() => typeof document.startViewTransition)).toBe('function');

  const outcome = await page.evaluate(() => {
    const link = document.querySelector<HTMLAnchorElement>('a.selected-work__link')!;
    link.href = '#work';
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    link.dispatchEvent(event);
    return { prevented: event.defaultPrevented, position: document.body.style.position };
  });

  expect(outcome).toEqual({ prevented: false, position: '' });
});

test('the navigation keeps its blurred glass on mobile and coarse pointers only', async ({ page, browser }) => {
  const blurOf = (target: Page) => target.locator('.site-nav').evaluate(nav => getComputedStyle(nav).backdropFilter);

  // A narrow window blurs even with a fine pointer: the width rule stands alone.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  expect(await blurOf(page)).toBe('blur(8px)');

  // A fine-pointer desktop keeps the plain, unblurred navigation.
  await page.setViewportSize({ width: 1440, height: 900 });
  expect(await blurOf(page)).toBe('none');

  // Touch devices blur at both widths, including above the 900px width rule.
  for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
    const context = await browser.newContext({ viewport, hasTouch: true, isMobile: true });
    try {
      const touch = await context.newPage();
      await touch.route('**/_vercel/**', route => route.fulfill({ status: 204 }));
      await touch.goto('/');
      expect(await blurOf(touch), `coarse pointer at ${viewport.width}px`).toBe('blur(8px)');
    } finally {
      await context.close();
    }
  }

  // Older Safari only understands the prefixed property while Chromium, Firefox
  // and current Safari use the standard one, so both declarations have to reach
  // the browser; the media queries must also stay in the legacy width form that
  // Safari 16.0-16.3 can parse rather than Level 4 range syntax.
  const css = await page.evaluate(async () => {
    const hrefs = [...document.querySelectorAll('link[rel="stylesheet"]')].map(link => (link as HTMLLinkElement).href);
    const sheets = await Promise.all(hrefs.map(href => fetch(href).then(response => response.text())));
    return sheets.join('\n');
  });
  expect(css).toMatch(/@media[^{]*\(max-width:\s*900px\)/);
  expect(css).not.toMatch(/\(width\s*<=/);
  expect(css).not.toMatch(/\(width\s*>=/);
  expect(css).toMatch(/[;{]backdrop-filter:\s*blur\(8px\)/);
  expect(css).toMatch(/[;{]-webkit-backdrop-filter:\s*blur\(8px\)/);
});
