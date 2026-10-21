# ugniusk-web

Portfolio and journal of Ugnius Liberman. Static Astro build, no client-side framework.

![Homepage: the UGNIUS LIBERMAN wordmark hero, with the social icons along the bottom edge](public/screenshots/this-site-card.webp)

## Stack

| | |
| --- | --- |
| Framework | Astro 6, static output |
| Styling | Hand-written CSS with custom properties |
| Motion | Lenis for scroll, Anime.js for reveals, custom cursor and text scramble in TypeScript |
| Type | Archivo Black display and Georgia reading; Courier New for small mono, with self-hosted IBM Plex Mono from 1200px up on desktop labels. Archivo Black and IBM Plex Mono ship from `public/fonts/` |
| Deploy | Vercel - security headers in `vercel.json`, analytics through Vercel first-party scripts |

## Commands

| Command | Purpose |
| --- | --- |
| `npm install` | Install dependencies |
| `npm run dev` | Dev server on `http://localhost:4321` |
| `npm run build` | Static build to `dist/` |
| `npm run check` | Astro and TypeScript diagnostics |
| `npm run preview` | Serve the built `dist/` locally |
| `npm run test:mobile` | Playwright suite - builds, serves its own preview on `http://127.0.0.1:4323` and runs the Chromium tests |
| `npm run images:variants` | Write the missing responsive WebP derivatives |

Node 22.12 or newer. The suite also needs Playwright's Chromium: `npx playwright install chromium`. The
suite runs it through `channel: 'chromium'`, Playwright's full-Chromium new-headless mode rather than the
separate headless shell, which the same install provides.
It builds the site and serves a fresh preview on its own port, so it never attaches to the dev
server or to an older `dist/`.

## Layout

```text
src/
├─ pages/         routes - the index, the 404, and projects/[slug]
├─ layouts/       BaseLayout: metadata, fonts, shared head
├─ components/    one file per section
├─ data/          site.ts and projects.ts - all copy and project content;
│                 responsiveImages.json and images.ts - image sizes and srcsets
├─ scripts/       client-side motion: scroll, cursor, scramble, nav
└─ styles/        global.css - design tokens and shared rules
scripts/          generate-image-variants.mjs - writes the responsive WebP derivatives
tests/            mobile.spec.ts - the Playwright suite
```

## Content

Project content is one entry per project in a typed array in `src/data/projects.ts`. Details that
affect rendering:

- `hidden: true` keeps an entry in the data but excludes it from listings, page generation and the
  sitemap. `sections[].label` is a `SectionLabel` union; an unknown label fails `astro check`.
- The homepage grid reads `selectedWork`, not `projects`: the planned cards (diucon and Horseflight)
  lead, then the shipped projects follow. A planned entry has `planned: true` and only the card
  fields - it renders as a card with a `Planned` note, no link and no focus stop, so it needs no
  page, gallery or `sections`.

## Notes

- Responsive images: `src/data/responsiveImages.json` records each shipped asset's native
  width/height and the generated width variants that exist beside it (`-800` and `-1600` where the
  source is wide enough; the 894px Surface Runoff card gets only `-800`). The three Surface Runoff
  figures are 160-frame animated WebPs and list no variants: a resized copy would drop every frame
  but the first, so they keep the original file at every viewport.
  `npm run images:variants`
  writes any missing variant at quality 85 and never enlarges a source; `--force` rewrites them
  after you replace an image. The script fails when the table's dimensions no longer match the
  file, so update the table with the image. Full-size originals stay the `src` fallback and the
  open-original link target.
- OG cards: `public/og/*.png` are separate 1200x630 images referenced by `ogImage` and `ogImageAlt`
  in `projects.ts`; `public/og-image.png` is a legacy URL kept for old shares. The variant script
  does not generate them - re-export the PNG by hand when a project's image changes.
- Production builds set `assetsInlineLimit: 0`, emitting every script as an external file. This
  keeps the CSP at `script-src 'self'` without inline hashes.
- The build is static: no server, no API, no runtime data fetching.
- `.github/workflows/ci.yml` runs `npm ci`, `npm run check` and `npm run test:mobile` on push and
  pull requests with read-only `contents` permission. It has no deploy step and only takes effect
  once the workflow is published.
- `design-references/` is local working material and is gitignored.
