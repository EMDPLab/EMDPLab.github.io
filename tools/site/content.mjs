const doiOverrides = new Map([
  [38, '10.1016/j.compositesb.2025.112626'],
  [13, '10.31613/ceramist.2020.23.1.04'],
  [10, '10.1016/j.nanoen.2020.105262'],
  [1, '10.1002/adma.201505739']
]);

export function escapeHtml(value) {
  return String(value ?? '')
    .trim()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitizeDoi(value) {
  return String(value ?? '')
    .trim()
    .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '')
    .replace(/^doi:\s*/i, '')
    .replace(/[)\],.;]+$/g, '')
    .trim();
}

function extractDoiFromLink(link) {
  const value = String(link ?? '').trim();
  if (!/^https?:\/\//i.test(value)) return '';

  let normalized = value;
  try {
    normalized = decodeURIComponent(value);
  } catch {}

  const doiMatch = normalized.match(/10\.\d{4,9}\/[^?#\s]+/i);
  if (doiMatch) return sanitizeDoi(doiMatch[0]);

  const natureMatch = normalized.match(/nature\.com\/articles\/([^/?#]+)/i);
  return natureMatch ? sanitizeDoi(`10.1038/${natureMatch[1]}`) : '';
}

function isPatent(record) {
  return /patent/i.test(String(record.venue ?? '')) || String(record.link ?? '').toLowerCase() === 'http://patent';
}

function usableLink(link) {
  const value = String(link ?? '').trim();
  return /^https?:\/\//i.test(value) && value.toLowerCase() !== 'http://patent';
}

function publicationDoi(record) {
  return sanitizeDoi(record.doi) || doiOverrides.get(record.number) || extractDoiFromLink(record.link);
}

function publicationItem(record) {
  const doi = publicationDoi(record);
  const patent = isPatent(record);
  const link = doi ? `https://doi.org/${doi}` : usableLink(record.link) ? record.link : '';
  const recordLabel = doi ? 'DOI' : usableLink(record.link) ? 'Record link' : patent ? 'DOI status' : 'Record';
  const recordValue = doi
    ? doi
    : usableLink(record.link)
      ? record.link.replace(/^https?:\/\//i, '').replace(/\/$/, '')
      : patent
        ? 'No DOI issued'
        : 'No DOI listed';
  const recordMarkup = doi
    ? `<code class="pub-record-value pub-record-doi">${escapeHtml(recordValue)}</code>`
    : link
      ? `<a class="pub-record-link" href="${escapeHtml(link)}" target="_blank" rel="noopener noreferrer">${escapeHtml(recordValue)}</a>`
      : `<span class="pub-record-value">${escapeHtml(recordValue)}</span>`;

  return `<article class="publication-item" role="listitem">
  <div class="pub-head">
    <span class="pub-no">Record #${escapeHtml(record.number)}</span>
    <div class="pub-chip-row"><span class="pub-type">${patent ? 'Patent' : 'Publication'}</span><span class="pub-year">${escapeHtml(record.year)}</span></div>
  </div>
  <p class="pub-title">${escapeHtml(record.title)}</p>
  <div class="pub-meta-grid">
    <div class="pub-meta-item pub-venue"><span class="pub-label">Venue</span><span class="pub-meta-value">${escapeHtml(record.venue)}</span></div>
    <div class="pub-meta-item pub-pages"><span class="pub-label">${patent ? 'Patent record' : 'Article / Pages'}</span><span class="pub-meta-value">${escapeHtml(patent ? record.venue || 'Patent filing' : record.pages || 'Not listed')}</span></div>
    <div class="pub-meta-item pub-authors pub-meta-item-wide"><span class="pub-label">Authors</span><span class="pub-meta-value">${escapeHtml(record.authors)}</span></div>
    <div class="pub-meta-item pub-record pub-meta-item-wide"><span class="pub-label">${recordLabel}</span>${recordMarkup}</div>
  </div>
${link ? `  <div class="pub-actions"><a class="pub-link" href="${escapeHtml(link)}" target="_blank" rel="noopener noreferrer">${doi ? 'Open DOI' : 'Open record'}</a></div>\n` : ''}
</article>`;
}

export function renderPublications(records) {
  const groups = new Map();
  for (const record of records) {
    const year = String(record.year || 'Unknown');
    if (!groups.has(year)) groups.set(year, []);
    groups.get(year).push(record);
  }

  return [...groups].map(([year, items], index) => `<details class="pub-year-group"${index === 0 ? ' open' : ''}>
  <summary class="pub-year-summary">
    <div class="pub-year-summary-main"><span class="pub-year-title">${escapeHtml(year)}</span><span class="pub-year-note">Expand archive</span></div>
    <div class="pub-year-summary-side"><span class="pub-year-count">${items.length} ${items.length === 1 ? 'record' : 'records'}</span><span class="pub-year-caret" aria-hidden="true"></span></div>
  </summary>
  <div class="pub-year-items" role="list">
    ${items.map(publicationItem).join('\n    ')}
  </div>
</details>`).join('\n');
}

function memberCard(member) {
  const photo = member.photo
    ? `<img class="team-photo" loading="lazy" decoding="async" src="${escapeHtml(member.photo)}" alt="${escapeHtml(member.alt || member.name || 'Team member')}">`
    : '';
  return `<article class="team-card">
  ${photo}
  <div class="team-content">
    <p class="kicker">${escapeHtml(member.role)}</p>
    <h3>${escapeHtml(member.name)}</h3>
    <p><strong>${escapeHtml(member.education)}</strong></p>
    <p>${escapeHtml(member.description)}</p>
  </div>
</article>`;
}

function historyCard(member, label) {
  return `<article class="team-card team-card-intern">
  <div class="team-content">
    <p class="kicker">${label}</p>
    <h3>${escapeHtml(member.name)}</h3>
    <p><strong>${escapeHtml(member.period)}</strong></p>
    <p>${escapeHtml(member.topic)}</p>
  </div>
</article>`;
}

export function renderTeamSections(data) {
  return new Map([
    ['teamPhdList', data.phd_course.map(memberCard).join('\n')],
    ['teamCombinedList', data.combined_course.map(memberCard).join('\n')],
    ['teamMscList', data.msc_course.map(memberCard).join('\n')],
    ['internshipList', data.internship.map((item) => historyCard(item, 'Internship')).join('\n')],
    ['alumniList', data.alumni.map((item) => historyCard(item, 'Alumni')).join('\n')]
  ]);
}

export function renderInstruments(records) {
  return records.map((record) => `<tr>
  <td>${escapeHtml(record.number)}</td>
  <td>${escapeHtml(record.name)}</td>
  <td>${escapeHtml(record.manufacturer)}</td>
  <td>${escapeHtml(record.model)}</td>
  <td>${escapeHtml(record.spec)}</td>
</tr>`).join('\n');
}

export function injectContent(main, { publications, team, instruments }) {
  let result = main;
  result = result.replace(/(<div id="publicationsList"[^>]*>)[\s\S]*?(<\/div>)/, `$1\n${renderPublications(publications)}\n$2`);
  result = result.replace(/(<tbody id="instrumentsTableBody"[^>]*>)[\s\S]*?(<\/tbody>)/, `$1\n${renderInstruments(instruments)}\n$2`);

  for (const [id, markup] of renderTeamSections(team)) {
    result = result.replace(new RegExp(`(<div id="${id}"[^>]*>)[\\s\\S]*?(<\\/div>)`), `$1\n${markup}\n$2`);
  }

  return result;
}
