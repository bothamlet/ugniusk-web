import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// Run with `node --test tests/security-headers.node.mjs`. The file deliberately
// avoids Playwright's default testMatch (`*.spec.*` / `*.test.*`).
const config = JSON.parse(
  readFileSync(new URL('../vercel.json', import.meta.url), 'utf8')
);

const GLOBAL_HEADERS = [
  {
    key: 'Content-Security-Policy',
    value:
      "default-src 'self'; base-uri 'self'; object-src 'none'; frame-src 'none'; frame-ancestors 'self'; form-action 'self'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' data: blob:; media-src 'self'; connect-src 'self' https://vitals.vercel-insights.com; manifest-src 'self'; upgrade-insecure-requests",
  },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value:
      'accelerometer=(), autoplay=(), camera=(), display-capture=(), encrypted-media=(), fullscreen=(self), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), midi=(), payment=(), picture-in-picture=(), publickey-credentials-get=(), screen-wake-lock=(), usb=(), web-share=(self), xr-spatial-tracking=()',
  },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
  { key: 'X-XSS-Protection', value: '0' },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
];

const GLOBAL_RULE = { source: '/(.*)', headers: GLOBAL_HEADERS };
const OG_RULE = {
  source: '/og/(.*)',
  headers: [{ key: 'Cross-Origin-Resource-Policy', value: 'cross-origin' }],
};

const OG_PATHS = [
  '/og/this-site-card.png',
  '/og/todays-brief-card.png',
  '/og/chap-card-full.png',
  '/og/jukdata-card.png',
  '/og/surface-runoff-card.png',
];

const RESTRICTED_PATHS = [
  '/',
  '/projects/chap/',
  '/og',
  '/og-image.png',
  '/og-evil/card.png',
  '/images/projects/chap-2.webp',
  '/OG/this-site-card.png',
];

const toHeaderMap = headers =>
  Object.fromEntries(headers.map(({ key, value }) => [key.toLowerCase(), value]));

// Models the two `source` forms used here: a literal path, or a literal path
// prefix ending in `(.*)`. Vercel matches `source` against the pathname and
// applies every matching header rule in array order, with a later rule's value
// replacing an earlier value for the same header key.
const matchesSource = (source, pathname) => {
  const catchAll = '(.*)';
  return source.endsWith(catchAll)
    ? pathname.startsWith(source.slice(0, -catchAll.length))
    : pathname === source;
};

const resolveHeaders = (rules, pathname) => {
  const resolved = {};
  for (const rule of rules) {
    if (!matchesSource(rule.source, pathname)) continue;
    for (const { key, value } of rule.headers) {
      resolved[key.toLowerCase()] = value;
    }
  }
  return resolved;
};

const globalHeaderMap = toHeaderMap(GLOBAL_HEADERS);

test('vercel.json keeps the global security block and adds one scoped CORP override', () => {
  assert.deepEqual(Object.keys(config), ['$schema', 'headers', 'redirects']);
  assert.equal(config.$schema, 'https://openapi.vercel.sh/vercel.json');
  assert.deepEqual(config.headers, [GLOBAL_RULE, OG_RULE]);
  assert.deepEqual(config.redirects, [
    {
      source: '/projects/budget(/?)',
      destination: '/projects/chap$1',
      permanent: true,
    },
  ]);
});

test('the /og override comes after the global block and changes only CORP', () => {
  const globalIndex = config.headers.findIndex(
    rule => rule.source === GLOBAL_RULE.source
  );
  const ogIndex = config.headers.findIndex(rule => rule.source === OG_RULE.source);
  assert.ok(ogIndex > globalIndex, 'override must be applied after global headers');
  assert.deepEqual(Object.keys(OG_RULE.headers[0]).sort(), ['key', 'value']);
  assert.deepEqual(
    OG_RULE.headers.map(({ key }) => key.toLowerCase()),
    ['cross-origin-resource-policy']
  );
});

test('public OG images resolve to the cross-origin CORP exception', () => {
  for (const pathname of OG_PATHS) {
    assert.deepEqual(resolveHeaders(config.headers, pathname), {
      ...globalHeaderMap,
      'cross-origin-resource-policy': 'cross-origin',
    });
  }
});

test('page, non-OG image, and lookalike paths keep the global CORP', () => {
  for (const pathname of RESTRICTED_PATHS) {
    assert.deepEqual(resolveHeaders(config.headers, pathname), globalHeaderMap);
  }
});

test('stripping only CORP from an OG response leaves the global headers intact', () => {
  for (const pathname of OG_PATHS) {
    const resolved = resolveHeaders(config.headers, pathname);
    const baseline = { ...globalHeaderMap };
    assert.equal(resolved['cross-origin-resource-policy'], 'cross-origin');
    delete resolved['cross-origin-resource-policy'];
    delete baseline['cross-origin-resource-policy'];
    assert.deepEqual(resolved, baseline);
  }
});

test('rule order is what makes the override effective', () => {
  const pathname = OG_PATHS[0];
  const reversed = resolveHeaders([OG_RULE, GLOBAL_RULE], pathname);
  assert.equal(reversed['cross-origin-resource-policy'], 'same-origin');
});
