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
    assert.match(html, new RegExp(`<html lang="${route === 'apply.html' ? 'ko' : 'en'}">`), route);
    assert.doesNotMatch(html, /id="languageToggle"/, route);
    assert.doesNotMatch(html, /assets\/js\/i18n\.js/, route);
  }
});

test('application form accepts a CV with one short motivation and introduction', async () => {
  const pages = await renderSite();
  const apply = pages.get('apply.html');

  assert.match(apply, /name="cv_pdf"/);
  assert.match(apply, /name="motivation_intro"[^>]*maxlength="1200"[^>]*required/);
  assert.doesNotMatch(apply, /name="cover_letter"/);
  assert.doesNotMatch(apply, /name="research_proposal_note"/);
  assert.doesNotMatch(apply, /name="special_note"/);
});

test('translation catalog covers shared navigation and application essentials', async () => {
  const catalog = JSON.parse(await readFile(new URL('../data/i18n-ko.json', import.meta.url), 'utf8'));

  assert.equal(catalog.common.Home, '홈');
  assert.equal(catalog.common.Apply, '지원');
  assert.equal(catalog.pages['apply.html']['Submit Application'], '지원서 제출');
});

test('research hero leads with the lab liquid-metal and low-melting-alloy focus', async () => {
  const pages = await renderSite();
  const research = pages.get('research.html');

  assert.match(research, /Liquid Metals &amp; Low-Melting Alloys/);
  assert.match(research, /primarily studies liquid metals and low-melting-point alloys/);
  assert.match(research, /assets\/images\/research-hero-liquid-metal-alloys\.webp/);
});

test('news publishes the DGIST AI Build Week Grand Prize milestone', async () => {
  const pages = await renderSite();
  const news = pages.get('news.html');

  assert.match(news, /EMDP team wins the Grand Prize at DGIST AI Build Week/);
  assert.match(news, /서준형\/박인자\/이지현 학생 EMDP 팀이 1등/);
  assert.equal((news.match(/assets\/images\/news-ai-build-week-[^"]+\.webp/g) || []).length, 3);
  assert.equal((news.match(/assets\/images\/해커톤[^"]+\.jpeg/g) || []).length, 2);
});

test('renderSite publishes canonical content without waiting for client-side fetches', async () => {
  const pages = await renderSite();
  const output = pages.get('projects.html');
  const team = pages.get('team.html');
  const facility = pages.get('research-facility.html');

  assert.equal((output.match(/class="publication-item"/g) || []).length, 42);
  assert.match(team, /Negasi Teklay Weldesemat/);
  assert.match(team, /Junhyeong Seo/);
  assert.match(facility, /Tabletop digital multimeter/);
  assert.doesNotMatch(output, /publications-data\.js/);
});

test('English pages keep descriptive team copy in English', async () => {
  const pages = await renderSite();
  const team = pages.get('team.html');

  assert.match(team, /2025 Winter Intern and Current Intern · DGIST/);
  assert.doesNotMatch(team, /\d{4}년 (?:동계|하계) 인턴/);
});

test('renderStyles emits one compact current design system', async () => {
  const css = await renderStyles();

  assert.ok(Buffer.byteLength(css) < 60_000, 'CSS should stay below 60 KB before transfer compression');
  assert.doesNotMatch(css, /Utilitarian refresh|REF-inspired homepage direction|Dark-theme contrast repairs/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /prefers-reduced-motion/);
});

test('hero headings use the clean sans display treatment', async () => {
  const css = await renderStyles();

  assert.match(css, /\.hero-title\s*\{[^}]*font-family:\s*var\(--font-sans\)/s);
  assert.match(css, /\.ref-hero-copy h1\s*\{[^}]*font-family:\s*var\(--font-sans\)/s);
});

test('published pages omit editorial layout commentary', async () => {
  const pages = await renderSite();
  const published = [...pages.values()].join('\n');
  const commentary = [
    'Member cards are intentionally simple now',
    'Each photo uses the same frame size',
    'These featured cards give the page stronger hierarchy',
    'This page intentionally avoids a fragmented card layout',
    'This page is written as a continuous narrative rather than a grid of topic cards',
    'This page is intentionally written as continuous reading material',
    'Selected papers are shown first',
    'The full list remains data-driven'
  ];

  for (const phrase of commentary) assert.doesNotMatch(published, new RegExp(phrase));
});
