import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const source = await readFile(new URL('../tools/google-apps-script-notify.gs', import.meta.url), 'utf8');
const context = vm.createContext({});
vm.runInContext(source, context);

function validPayload() {
  return {
    submission_id: '20260710120000-test',
    applicant_name: 'Jane Researcher',
    applicant_email: 'jane@example.edu',
    program_track: 'PhD',
    affiliation: 'Example University',
    privacy_consent: 'agreed',
    privacy_consent_version: '2026-07-10',
    privacy_consent_at: '2026-07-10T12:00:00.000Z',
    started_at: String(Date.now() - 10_000),
    research_proposal_note: 'Liquid-metal composite processing.',
    special_note: '',
    files: {
      cv: { name: 'cv.pdf', base64: 'dGVzdA==' },
      cover_letter: { name: 'cover.pdf', base64: 'dGVzdA==' }
    }
  };
}

test('Apps Script validates public application fields at the server boundary', () => {
  assert.doesNotThrow(() => context.validatePayload_(validPayload()));

  const invalidEmail = validPayload();
  invalidEmail.applicant_email = 'not-an-email';
  assert.throws(() => context.validatePayload_(invalidEmail), /email/i);

  const invalidTrack = validPayload();
  invalidTrack.program_track = 'Administrator';
  assert.throws(() => context.validatePayload_(invalidTrack), /track/i);

  const oversizedName = validPayload();
  oversizedName.applicant_name = 'x'.repeat(81);
  assert.throws(() => context.validatePayload_(oversizedName), /name/i);

  const missingConsent = validPayload();
  missingConsent.privacy_consent = '';
  assert.throws(() => context.validatePayload_(missingConsent), /consent/i);
});

test('Apps Script normalizes untrusted values used in email headers', () => {
  assert.equal(context.singleLine_('Jane\r\nBcc: attacker@example.com'), 'Jane Bcc: attacker@example.com');
});

test('Apps Script verifies attachment signatures and owns MIME types', () => {
  context.Utilities = {
    base64Decode: () => [0x25, 0x50, 0x44, 0x46, 0x2d, 0x31],
    newBlob: (_bytes, mime, name) => ({ mime, name })
  };

  const attachment = context.buildAttachment_(
    { name: 'resume.pdf', type: 'text/html', base64: 'encoded' },
    ['pdf'],
    1024,
    'CV'
  );
  assert.equal(attachment.blob.mime, 'application/pdf');

  context.Utilities.base64Decode = () => [0x4d, 0x5a, 0x90, 0x00];
  assert.throws(
    () => context.buildAttachment_({ name: 'malware.pdf', base64: 'encoded' }, ['pdf'], 1024, 'CV'),
    /signature/i
  );
});

test('Apps Script enforces per-email and global submission limits', () => {
  let cacheValues = new Map();
  const cache = {
    get: (key) => cacheValues.get(key) || null,
    put: (key, value) => cacheValues.set(key, value)
  };
  context.getProp_ = () => '';
  context.CacheService = { getScriptCache: () => cache };
  context.LockService = {
    getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} })
  };
  context.MailApp = { getRemainingDailyQuota: () => 100 };

  context.Utilities = {
    base64Decode: () => [0x4d, 0x5a, 0x90, 0x00],
    newBlob: () => ({})
  };
  context.Logger = { log: () => {} };
  context.ContentService = {
    MimeType: { JSON: 'json' },
    createTextOutput: () => ({ setMimeType() { return this; } })
  };
  context.doPost({ postData: { contents: JSON.stringify(validPayload()) } });
  assert.equal(cacheValues.size, 0, 'invalid attachments must not consume submission slots');

  context.MailApp = { getRemainingDailyQuota: () => 2 };
  assert.throws(() => context.validateSubmissionPreconditions_(validPayload()), /quota/i);
  context.MailApp = { getRemainingDailyQuota: () => 3 };
  assert.doesNotThrow(() => context.validateSubmissionPreconditions_(validPayload()));
  context.MailApp = { getRemainingDailyQuota: () => 100 };

  const first = validPayload();
  context.consumeSubmissionLimits_(first);
  context.consumeSubmissionLimits_(first);
  assert.throws(() => context.consumeSubmissionLimits_(first), /email submission limit/i);
  assert.equal(
    [...cacheValues.entries()].find(([key]) => key.startsWith('apply-hour-'))?.[1],
    '2',
    'rejected email attempts must not consume the shared hourly limit'
  );

  cacheValues = new Map();
  for (let index = 0; index < 3; index += 1) {
    const payload = validPayload();
    payload.applicant_email = `applicant-${index}@example.edu`;
    context.consumeSubmissionLimits_(payload);
  }
  const fourth = validPayload();
  fourth.applicant_email = 'fourth@example.edu';
  assert.throws(() => context.consumeSubmissionLimits_(fourth), /hourly submission limit/i);
});
