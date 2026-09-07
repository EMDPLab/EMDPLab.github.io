import test from 'node:test';
import assert from 'node:assert/strict';
import { renderSite } from '../tools/site/build.mjs';

test('analytics is off by default and enabled only with a valid public beacon token', async () => {
  const disabled = await renderSite({ analytics: { cloudflareToken: '' } });
  assert.doesNotMatch(disabled.get('index.html'), /cloudflareinsights|analytics-notice/);
  // A format-valid fixture verifies rendering; no request is made to a service.
  const enabled = await renderSite({ analytics: { cloudflareToken: '0123456789abcdef0123456789abcdef' } });
  for (const [route, html] of enabled) {
    if (route === 'publications.html') continue;
    assert.equal((html.match(/src="https:\/\/static.cloudflareinsights.com\/beacon.min.js"/g) || []).length, 1, route);
    assert.match(html, /connect-src[^";]*https:\/\/cloudflareinsights.com/, route);
    assert.match(html, /class="analytics-notice"/, route);
  }
  await assert.rejects(renderSite({ analytics: { cloudflareToken: '\"><script>' } }), /beacon token/);
});
