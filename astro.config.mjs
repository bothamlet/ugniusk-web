// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://ugniusliberman.me',
  // v7 defaults to 'jsx', which drops whitespace between inline elements. Keep
  // the v6 HTML-aware compression so a space between inline nodes survives.
  compressHTML: true,
  integrations: [sitemap()],
  vite: {
    build: {
      // Astro forces `target: 'esnext'`, and Vite reuses that as the CSS target,
      // which lets lightningcss minify media queries into Level 4 range syntax
      // (`width<=900px`) that Safari 16.0-16.3 cannot parse. Target Safari 16 for
      // CSS only so the emitted media queries keep the compatible
      // `max-width`/`min-width` form; JavaScript keeps Astro's target.
      cssTarget: 'safari16',
      // Production only: keep every script bundle as an external file so the
      // CSP (script-src 'self') can allow it without inline hashes. Skipped in
      // dev because it breaks Vite's full-reload pipeline.
      ...(process.env.NODE_ENV === 'production'
        ? { assetsInlineLimit: 0 }
        : {}),
    },
    server: {
      watch: {
        ignored: ['**/dev-server.log', '**/.edge-preview/**'],
      },
    },
  },
});
