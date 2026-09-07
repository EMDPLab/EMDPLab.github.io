import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { contentSecurityPolicy, renderSite } from '../tools/site/build.mjs';

test('generated pages carry a restrictive CSP for the real site dependencies', async () => {
  const pages = await renderSite();

  for (const [route, html] of pages) {
    const policy = html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)">/)?.[1];
    assert.ok(policy, `${route} is missing its content security policy`);
    assert.match(policy, /default-src 'self'/, route);
    assert.match(policy, /script-src 'self'(?:;|\s)/, route);
    assert.doesNotMatch(policy, /script-src[^;]*'unsafe-inline'/, route);
    assert.match(policy, /style-src[^;]*'unsafe-inline'/, route);
    assert.match(policy, /font-src[^;]*https:\/\/fonts\.gstatic\.com/, route);
    assert.match(policy, /connect-src[^;]*https:\/\/script\.google\.com[^;]*https:\/\/script\.googleusercontent\.com[^;]*https:\/\/formsubmit\.co/, route);
    assert.match(policy, /form-action[^;]*https:\/\/script\.google\.com[^;]*https:\/\/formsubmit\.co/, route);
    assert.equal((html.match(/<meta name="referrer" content="strict-origin-when-cross-origin">/g) || []).length, 1, route);
  }
});

test('Cloudflare analytics origins are opt-in in the CSP helper', () => {
  const defaultPolicy = contentSecurityPolicy();
  const analyticsPolicy = contentSecurityPolicy({ cloudflareWebAnalytics: true });

  assert.doesNotMatch(defaultPolicy, /cloudflareinsights\.com/);
  assert.doesNotMatch(defaultPolicy, /static\.cloudflareinsights\.com/);
  assert.match(analyticsPolicy, /script-src[^;]*https:\/\/static\.cloudflareinsights\.com/);
  assert.match(analyticsPolicy, /connect-src[^;]*https:\/\/cloudflareinsights\.com/);
});

test('interest forms require an accepted JSON response before claiming delivery', async () => {
  const source = await readFile(new URL('../assets/js/scripts.js', import.meta.url), 'utf8');

  assert.match(source, /return response\.json\(\);/);
  assert.match(source, /interestResponseAccepted\(payload\)/);
  assert.match(source, /payload\.success === true/);
  assert.match(source, /payload\.success === 'true'/);
});
