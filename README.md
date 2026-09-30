# ugniusk-web

Portfolio and journal of Ugnius Liberman. Static Astro build, no client-side framework.

![Homepage: editorial intro over the selected work carousel](public/screenshots/this-site-card.webp)

## Stack

| | |
| --- | --- |
| Framework | Astro 6, static output |
| Styling | Hand-written CSS with custom properties |
| Motion | Lenis for scroll, Anime.js for reveals, custom cursor and text scramble in TypeScript |
| Type | Archivo Black, self-hosted from `public/fonts/`; Georgia and Courier New fallbacks |
| Deploy | Vercel - security headers in `vercel.json`, analytics through Vercel first-party scripts |

## Commands

| Command | Purpose |
| --- | --- |
| `npm install` | Install dependencies |
| `npm run dev` | Dev server on `http://localhost:4321` |
| `npm run build` | Static build to `dist/` |
| `npm run check` | Astro and TypeScript diagnostics |
| `npm run preview` | Serve the built `dist/` locally |

Node 22.12 or newer.

## Layout

```text
src/
├─ pages/         routes - the index and projects/[slug]
├─ layouts/       BaseLayout: metadata, fonts, shared head
├─ components/    one file per section
├─ data/          site.ts and projects.ts - all copy and project content
├─ scripts/       client-side motion: scroll, cursor, scramble, nav
└─ styles/        global.css - design tokens and shared rules
```

## Content

Project content is one entry per project in a typed array in `src/data/projects.ts`. Two details
affect rendering:

- `hidden: true` keeps an entry in the data but excludes it from listings, page generation and the
  sitemap.
- `sections[].label` is a `SectionLabel` union; an unknown label fails `astro check`.

## Notes

- Card images are served from `-800.webp` and `-1600.webp` variants generated beside each asset.
  Regenerate the variants when replacing an image.
- Production builds set `assetsInlineLimit: 0`, emitting every script as an external file. This
  keeps the CSP at `script-src 'self'` without inline hashes.
- The build is static: no server, no API, no runtime data fetching.
- `design-references/` is local working material and is gitignored.
