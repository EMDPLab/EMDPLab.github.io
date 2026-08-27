import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { injectContent } from './content.mjs';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const sourceDir = path.join(rootDir, 'site/pages');
const styleDir = path.join(rootDir, 'site/styles');
const styleSources = ['base.css', 'components.css', 'home.css', 'study.css'];

export const pageDefinitions = [
  {
    route: 'index.html',
    page: 'home',
    title: 'EMDP Lab | Energy Materials Design and Processing',
    description: 'EMDP Lab at DGIST develops energy materials, interfaces, and processing routes for durable devices.'
  },
  {
    route: 'team.html',
    page: 'team',
    title: 'EMDP Lab | Team',
    description: 'Meet the principal investigator, students, interns, and alumni of EMDP Lab at DGIST.'
  },
  {
    route: 'research.html',
    page: 'research',
    title: 'EMDP Lab | Research',
    description: 'EMDP Lab studies liquid metals and low-melting-point alloys for energy transport, soft electronics, and advanced materials processing.',
    themeColor: '#f7fbff'
  },
  {
    route: 'research-facility.html',
    page: 'facility',
    title: 'EMDP Lab | Facility',
    description: 'Explore fabrication, imaging, electrical testing, and materials-processing instruments at EMDP Lab.'
  },
  {
    route: 'projects.html',
    page: 'projects',
    title: 'EMDP Lab | Output',
    description: 'Selected publications and the complete research output archive from EMDP Lab.'
  },
  {
    route: 'news.html',
    page: 'news',
    title: 'EMDP Lab | News',
    description: 'News, recruiting events, awards, and group activities from EMDP Lab at DGIST.'
  },
  {
    route: 'apply.html',
    page: 'apply',
    title: 'EMDP Lab | Apply',
    description: 'Apply to EMDP Lab with a current CV and a brief motivation and introduction.',
    moduleScripts: ['assets/js/application.js']
  },
  {
    route: 'study/index.html',
    page: 'study',
    title: 'EMDP Lab | Study Liquid Metal',
    description: 'A guided study hub for liquid metal, droplets, composites, and device applications.',
    bodyId: 'pageTop',
    bodyClass: 'study-page',
    studySection: 'overview'
  },
  {
    route: 'study/composites.html',
    page: 'study',
    title: 'EMDP Lab | Liquid Metal Composites',
    description: 'Study how liquid metal droplets interact with polymers to create conductive and resilient composites.',
    bodyId: 'pageTop',
    bodyClass: 'study-page',
    studySection: 'composites'
  },
  {
    route: 'study/devices.html',
    page: 'study',
    title: 'EMDP Lab | Liquid Metal Devices',
    description: 'Study liquid-metal processing routes for soft interconnects, vias, and functional devices.',
    bodyId: 'pageTop',
    bodyClass: 'study-page',
    studySection: 'devices'
  },
  {
    route: 'study/handbook.html',
    page: 'study',
    title: 'EMDP Lab | Liquid Metal Handbook',
    description: 'Explore key liquid-metal properties, comparisons, and design notes in an interactive handbook.',
    bodyId: 'pageTop',
    bodyClass: 'study-page',
    studySection: 'handbook',
    scripts: ['data/study-data.js', 'assets/js/study.js']
  }
];

const navItems = [
  ['home', 'index.html', 'Home'],
  ['team', 'team.html', 'Team'],
  ['research', 'research.html', 'Research'],
  ['facility', 'research-facility.html', 'Facility'],
  ['projects', 'projects.html', 'Output'],
  ['news', 'news.html', 'News'],
  ['study', 'study/index.html', 'Study'],
  ['apply', 'apply.html', 'Apply']
];

function prefixFor(route) {
  return route.includes('/') ? '../' : '';
}

function extractMain(html, route) {
  const match = html.match(/<main(?:\s[^>]*)?>[\s\S]*?<\/main>/i);
  if (!match) throw new Error(`Missing <main> in ${route}`);
  return match[0];
}

function renderHead(definition, prefix) {
  const extraScripts = (definition.scripts || [])
    .map((src) => `  <script src="${prefix}${src}" defer></script>`)
    .join('\n');
  const moduleScripts = (definition.moduleScripts || [])
    .map((src) => `  <script type="module" src="${prefix}${src}"></script>`)
    .join('\n');

  return `<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="${definition.description}">
  <meta name="theme-color" content="${definition.themeColor || '#171310'}">
  <title>${definition.title}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Manrope:wght@400;500;600;700;800&display=swap">
  <link rel="stylesheet" href="${prefix}assets/css/style.css">
  <link rel="icon" href="${prefix}assets/images/EMDP_Lab_logo.svg" type="image/svg+xml">
${extraScripts ? `${extraScripts}\n` : ''}${moduleScripts ? `${moduleScripts}\n` : ''}  <script src="${prefix}assets/js/scripts.js" defer></script>
</head>`;
}

function renderHeader(definition, prefix) {
  const links = navItems
    .map(([key, href, label]) => {
      const cta = key === 'apply' ? ' nav-link-cta' : '';
      const current = key === definition.page ? ' aria-current="page"' : '';
      return `        <a class="nav-link${cta}" data-nav="${key}" href="${prefix}${href}"${current}>${label}</a>`;
    })
    .join('\n');

  return `<header class="site-header">
    <div class="container nav-wrap">
      <a class="brand" href="${prefix}index.html" aria-label="EMDP Lab Home">
        <img class="brand-logo" src="${prefix}assets/images/EMDP_Lab_logo.svg" alt="EMDP Lab logo" width="64" height="64">
        <span>
          <span class="brand-wordmark">EMDP LAB</span>
          <span class="brand-meta">Energy Materials Design &amp; Processing Lab</span>
        </span>
      </a>
      <nav id="siteNav" class="site-nav" aria-label="Primary">
${links}
      </nav>
      <button id="menuToggle" class="menu-toggle" type="button" aria-expanded="false" aria-controls="siteNav">Menu</button>
    </div>
  </header>`;
}

function renderFooter(prefix) {
  return `<footer class="site-footer">
    <div class="container footer-inner">
      <div>
        <img class="footer-logo" src="${prefix}assets/images/dgist-logo.svg" alt="DGIST logo" width="116" height="36" loading="lazy">
        <p class="footer-meta">Energy Materials Design and Processing Lab, Department of Energy Science and Engineering</p>
      </div>
      <p>&copy; ${new Date().getUTCFullYear()} Energy Materials Design and Processing Lab, DGIST</p>
    </div>
  </footer>`;
}

function renderBodyAttributes(definition) {
  return [
    definition.bodyId ? `id="${definition.bodyId}"` : '',
    `data-page="${definition.page}"`,
    definition.studySection ? `data-study-section="${definition.studySection}"` : '',
    definition.bodyClass ? `class="${definition.bodyClass}"` : ''
  ]
    .filter(Boolean)
    .join(' ');
}

function decodeHtmlText(value) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&copy;/g, '©')
    .replace(/&nbsp;/g, '\u00a0');
}

function escapeHtmlText(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeAttribute(value) {
  return escapeHtmlText(value).replace(/"/g, '&quot;');
}

function translatedValue(value, catalog) {
  return catalog[decodeHtmlText(value)] || '';
}

export function translateHtml(html, catalog) {
  const excluded = new Set(['script', 'style', 'code']);
  const stack = [];

  return html.split(/(<[^>]+>)/g).map((part) => {
    if (!part) return part;
    if (part.startsWith('<')) {
      const closing = part.match(/^<\s*\/\s*([a-z0-9-]+)/i);
      if (closing) {
        if (excluded.has(closing[1].toLowerCase())) stack.pop();
        return part;
      }

      const opening = part.match(/^<\s*([a-z0-9-]+)/i);
      const tagName = opening?.[1]?.toLowerCase();
      const translatedTag = part.replace(/\b(alt|aria-label|placeholder|title|content)="([^"]*)"/g, (match, name, value) => {
        const translated = translatedValue(value, catalog);
        return translated ? `${name}="${escapeAttribute(translated)}"` : match;
      });
      if (tagName && excluded.has(tagName) && !/\/\s*>$/.test(part)) stack.push(tagName);
      return translatedTag;
    }

    if (stack.length) return part;
    const leading = part.match(/^\s*/)?.[0] || '';
    const trailing = part.match(/\s*$/)?.[0] || '';
    const value = part.trim();
    if (!value) return part;
    const translated = translatedValue(value, catalog);
    return translated ? `${leading}${escapeHtmlText(translated)}${trailing}` : part;
  }).join('');
}

function renderDocument(definition, main, catalog) {
  const prefix = prefixFor(definition.route);
  const korean = definition.route === 'apply.html';
  const document = `<!DOCTYPE html>
<html lang="${korean ? 'ko' : 'en'}">
${renderHead(definition, prefix)}
<body ${renderBodyAttributes(definition)}>
  <a class="skip-link" href="#main-content">Skip to main content</a>
  ${renderHeader(definition, prefix)}

  ${main}

  ${renderFooter(prefix)}
</body>
</html>
`;
  return korean ? translateHtml(document, catalog) : document;
}

function renderPublicationsRedirect() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="refresh" content="0; url=projects.html">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex">
  <link rel="canonical" href="projects.html">
  <link rel="icon" href="assets/images/EMDP_Lab_logo.svg" type="image/svg+xml">
  <title>Redirecting to Output | EMDP Lab</title>
</head>
<body>
  <p>Redirecting to <a href="projects.html">EMDP Lab output</a>...</p>
</body>
</html>
`;
}

export async function renderSite() {
  const rendered = new Map();
  const [publications, team, instruments, translations] = await Promise.all([
    readFile(path.join(rootDir, 'data/publications-data.json'), 'utf8').then(JSON.parse),
    readFile(path.join(rootDir, 'data/team-data.json'), 'utf8').then(JSON.parse),
    readFile(path.join(rootDir, 'data/instruments-data.json'), 'utf8').then(JSON.parse),
    readFile(path.join(rootDir, 'data/i18n-ko.json'), 'utf8').then(JSON.parse)
  ]);

  for (const definition of pageDefinitions) {
    const mainSource = await readFile(path.join(sourceDir, definition.route), 'utf8');
    const main = injectContent(extractMain(mainSource, definition.route), { publications, team, instruments });
    const catalog = definition.route === 'apply.html'
      ? { ...translations.common, ...(translations.pages[definition.route] || {}) }
      : {};
    rendered.set(definition.route, renderDocument(definition, main, catalog));
  }

  rendered.set('publications.html', renderPublicationsRedirect());
  return rendered;
}

export async function renderStyles() {
  const sources = await Promise.all(styleSources.map((file) => readFile(path.join(styleDir, file), 'utf8')));
  return `${sources.map((source) => source.trimEnd()).join('\n')}\n`;
}

export async function extractPageSources() {
  for (const definition of pageDefinitions) {
    const current = await readFile(path.join(rootDir, definition.route), 'utf8');
    const destination = path.join(sourceDir, definition.route);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, `${extractMain(current, definition.route)}\n`);
  }
}

export async function writeSite() {
  const pages = await renderSite();
  for (const [route, html] of pages) {
    const destination = path.join(rootDir, route);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, html);
  }
  await writeFile(path.join(rootDir, 'assets/css/style.css'), await renderStyles());
  return pages;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--extract-sources')) {
    await extractPageSources();
    console.log(`Extracted ${pageDefinitions.length} page sources.`);
  } else {
    const pages = await writeSite();
    console.log(`Built ${pages.size} public routes.`);
  }
}
