// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://ugniusk-web-pied.vercel.app',
  integrations: [sitemap()],
  vite: {
    build: {
      // Production only: keep every script bundle as an external file so the
      // CSP (script-src 'self') can allow it without inline hashes. Skipped in
      // dev because it breaks Vite's full-reload pipeline.
      ...(process.env.NODE_ENV === 'production'
        ? { assetsInlineLimit: 0 }
        : {}),
    },
    plugins: [tailwindcss()],
    server: {
      watch: {
        ignored: ['**/dev-server.log', '**/.edge-preview/**'],
      },
    },
  },
});
