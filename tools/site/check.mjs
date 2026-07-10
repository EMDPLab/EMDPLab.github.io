import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { pageDefinitions, renderSite, renderStyles } from './build.mjs';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function localReferences(html) {
  return [...html.matchAll(/(?:href|src)="([^"]+)"/g)]
    .map((match) => match[1])
    .filter((reference) => !/^(?:https?:|mailto:|tel:|data:|#)/i.test(reference))
    .map((reference) => decodeURIComponent(reference.split(/[?#]/)[0]))
    .filter(Boolean);
}

function routeTarget(route, reference) {
  return path.posix.normalize(path.posix.join(path.posix.dirname(route), reference));
}

async function exists(target) {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

function validatePublications(records) {
  assert(Array.isArray(records) && records.length > 0, 'Publication data must be a non-empty array.');
  const numbers = new Set();
  for (const record of records) {
    for (const key of ['number', 'title', 'year', 'authors', 'venue']) {
      assert(String(record[key] ?? '').trim(), `Publication #${record.number ?? '?'} is missing ${key}.`);
    }
    assert(!numbers.has(record.number), `Duplicate publication number: ${record.number}`);
    numbers.add(record.number);
  }
}

function validateTeam(data) {
  for (const section of ['phd_course', 'combined_course', 'msc_course', 'internship', 'alumni']) {
    assert(Array.isArray(data[section]), `Team data is missing ${section}.`);
  }
}

function validateInstruments(records) {
  assert(Array.isArray(records) && records.length > 0, 'Instrument data must be a non-empty array.');
  const numbers = new Set();
  for (const record of records) {
    assert(record.number && record.name, 'Every instrument needs a number and name.');
    assert(!numbers.has(record.number), `Duplicate instrument number: ${record.number}`);
    numbers.add(record.number);
  }
}

export async function runSiteChecks({ verifyGenerated = true } = {}) {
  const [pages, css, publications, team, instruments] = await Promise.all([
    renderSite(),
    renderStyles(),
    readFile(path.join(rootDir, 'data/publications-data.json'), 'utf8').then(JSON.parse),
    readFile(path.join(rootDir, 'data/team-data.json'), 'utf8').then(JSON.parse),
    readFile(path.join(rootDir, 'data/instruments-data.json'), 'utf8').then(JSON.parse)
  ]);

  validatePublications(publications);
  validateTeam(team);
  validateInstruments(instruments);
  assert(Buffer.byteLength(css) < 60_000, 'Generated CSS exceeds the 60 KB budget.');
  assert(Buffer.byteLength(await readFile(path.join(rootDir, 'assets/js/scripts.js'))) < 12_000, 'Common runtime exceeds the 12 KB budget.');

  const missing = [];
  for (const [route, html] of pages) {
    assert((html.match(/<h1\b/g) || []).length <= 1, `${route} has more than one h1.`);
    for (const reference of localReferences(html)) {
      const target = routeTarget(route, reference);
      if (!pages.has(target) && !(await exists(path.join(rootDir, target)))) missing.push(`${route} -> ${reference}`);
    }
    if (verifyGenerated) {
      const current = await readFile(path.join(rootDir, route), 'utf8');
      assert(current === html, `${route} is not in sync. Run npm run build.`);
    }
  }

  assert(missing.length === 0, `Missing local references:\n${missing.join('\n')}`);
  for (const definition of pageDefinitions) {
    const source = await readFile(path.join(rootDir, 'site/pages', definition.route), 'utf8');
    assert(!/<(?:head|header|footer)\b/i.test(source), `${definition.route} source contains shared shell markup.`);
  }

  return {
    routes: pages.size,
    publications: publications.length,
    instruments: instruments.length,
    cssBytes: Buffer.byteLength(css)
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await runSiteChecks();
  console.log(`Site checks passed: ${result.routes} routes, ${result.publications} publications, ${result.instruments} instruments, ${result.cssBytes} CSS bytes.`);
}
