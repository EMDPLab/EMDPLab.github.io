import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
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
    assert.match(html, /<html lang="ko">/, route);
    assert.match(html, /id="languageToggle"/, route);
    assert.match(html, /assets\/js\/i18n\.js/, route);
  }
});

test('application form accepts a CV without cover letter or proposal fields', async () => {
  const pages = await renderSite();
  const apply = pages.get('apply.html');

  assert.match(apply, /name="cv_pdf"/);
  assert.doesNotMatch(apply, /name="cover_letter"/);
  assert.doesNotMatch(apply, /name="research_proposal_note"/);
  assert.doesNotMatch(apply, /name="special_note"/);
});

test('translation catalog covers shared navigation and application essentials', async () => {
  const catalog = JSON.parse(await readFile(new URL('../data/i18n-ko.json', import.meta.url), 'utf8'));

  assert.equal(catalog.common.Home, '홈');
  assert.equal(catalog.common.Apply, '지원');
  assert.equal(catalog.pages['apply.html']['Submit CV'], 'CV 제출');
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
