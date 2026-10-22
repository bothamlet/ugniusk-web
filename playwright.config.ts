import { defineConfig } from '@playwright/test';

// The suite owns a dedicated port and always builds the site itself: reusing a
// server would silently accept a running Astro dev server (or an older preview)
// and test something other than the production output. 4322 is the dev port and
// stays free for it.
const port = 4323;

export default defineConfig({
  testDir: './tests',
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    reducedMotion: 'reduce',
    // Playwright's default headless launch runs the separate headless shell. On
    // this site it intermittently never surfaced a browser-created tab as a page
    // event (17/20 while the browser created 20/20 tabs). `channel: 'chromium'`
    // runs the full Chromium build in new-headless mode, the supported mode for
    // end-to-end tests (20/20), and the standard `playwright install chromium`
    // already provides that build.
    channel: 'chromium',
  },
  webServer: {
    // `--ignore-lock` is Astro 7's supported one-off mode: it starts a plain
    // foreground preview instead of detaching into the background daemon that
    // `astro preview` otherwise uses when it detects an agent environment. It
    // also opts out of the preview lock file, so it never tracks, reuses or
    // stops another preview server - this suite still owns its own port.
    command: `npm run build && npm run preview -- --host 127.0.0.1 --port ${port} --ignore-lock`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
    env: { ASTRO_TELEMETRY_DISABLED: '1' },
  },
});
