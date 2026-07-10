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
});

test('Apps Script normalizes untrusted values used in email headers', () => {
  assert.equal(context.singleLine_('Jane\r\nBcc: attacker@example.com'), 'Jane Bcc: attacker@example.com');
});
