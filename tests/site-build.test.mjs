import assert from 'node:assert/strict';
import test from 'node:test';

import { renderSite, renderStyles } from '../tools/site/build.mjs';

test('renderSite produces every public route through one shared shell', async () => {
  const pages = await renderSite();

  assert.equal(pages.size, 12);

  for (const [route, html] of pages) {
    if (route === 'publications.html') continue;

    assert.equal((html.match(/<header class="site-header">/g) || []).length, 1, route);
    assert.equal((html.match(/<footer class="site-footer">/g) || []).length, 1, route);
    assert.match(html, /<meta name="description" content="[^"]+">/, route);
  }
});

test('renderSite publishes canonical content without waiting for client-side fetches', async () => {
  const pages = await renderSite();
  const output = pages.get('projects.html');
  const team = pages.get('team.html');
  const facility = pages.get('research-facility.html');

  assert.equal((output.match(/class="publication-item"/g) || []).length, 39);
  assert.match(team, /Negasi Teklay Weldesemat/);
  assert.match(team, /Junhyeong Seo/);
  assert.match(facility, /Tabletop digital multimeter/);
  assert.doesNotMatch(output, /publications-data\.js/);
});

test('renderStyles emits one compact current design system', async () => {
  const css = await renderStyles();

  assert.ok(Buffer.byteLength(css) < 60_000, 'CSS should stay below 60 KB before transfer compression');
  assert.doesNotMatch(css, /Utilitarian refresh|REF-inspired homepage direction|Dark-theme contrast repairs/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /prefers-reduced-motion/);
});
