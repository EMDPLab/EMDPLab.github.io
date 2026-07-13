import assert from 'node:assert/strict';
import test from 'node:test';

import { submitApplication, validateApplicationPackage } from '../assets/js/application.js';

test('application package requires only a PDF CV', () => {
  assert.deepEqual(
    validateApplicationPackage({
      consent: true,
      honeypot: '',
      files: { cv: { name: 'cv.pdf', size: 1024 } },
      maxFileMb: 7
    }),
    { ok: true }
  );
});

test('Apps Script transport reports queued until a confirmation email verifies receipt', async () => {
  const calls = [];
  const result = await submitApplication({
    endpoint: 'https://script.google.com/macros/s/example/exec',
    formData: new Map([
      ['applicant_name', 'Test Applicant'],
      ['motivation_intro', 'I want to contribute to liquid-metal device research.'],
      ['privacy_consent', 'agreed'],
      ['privacy_consent_version', '2026-07-10'],
      ['privacy_consent_at', '2026-07-10T00:00:00.000Z']
    ]),
    files: {
      cv: { name: 'cv.pdf', type: 'application/pdf' }
    },
    encodeFile: async () => 'encoded',
    fetchImpl: async (...args) => {
      calls.push(args);
      return { ok: false };
    },
    now: () => new Date('2026-07-10T00:00:00.000Z'),
    random: () => 0.5
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0][1].mode, 'no-cors');
  const payload = JSON.parse(calls[0][1].body);
  assert.equal(payload.privacy_consent, 'agreed');
  assert.equal(payload.privacy_consent_version, '2026-07-10');
  assert.equal(payload.privacy_consent_at, '2026-07-10T00:00:00.000Z');
  assert.equal(payload.motivation_intro, 'I want to contribute to liquid-metal device research.');
  assert.deepEqual(Object.keys(payload.files), ['cv']);
  assert.equal('research_proposal_note' in payload, false);
  assert.deepEqual(result, {
    state: 'queued',
    verified: false,
    submissionId: '20260710000000-i'
  });
});
