# ugniusk-web

Portfolio and journal of Ugnius Liberman. Built as a static Astro site with hand-written CSS and TypeScript motion—no client-side UI framework, server, or runtime API.

![Homepage: the UGNIUS LIBERMAN wordmark hero, with the social icons along the bottom edge](public/screenshots/this-site-card.webp)

## Run

With Node.js 24.15+:

```sh
npm install
npm run dev       # http://localhost:4321
npm run build     # static output to dist/
npm run preview
```

## How it works

- **Pages and content:** `src/pages/` builds the homepage, 404, and `/projects/[slug]` routes from typed entries in `src/data/projects.ts`.
- **Styling and motion:** Hand-written CSS with custom properties (`src/styles/global.css`), Lenis smooth scrolling, Anime.js reveals, and custom TypeScript cursor and text-scramble effects (`src/scripts/`).
- **Security and delivery:** Deployed to Vercel as static files with `assetsInlineLimit: 0` and headers in `vercel.json`, keeping `script-src 'self'` without inline hashes.

## Checks

```sh
npm run check
npm run test:mobile   # builds and runs Playwright against a local preview (needs npx playwright install chromium)
node --test tests/security-headers.node.mjs
```
