/**
 * EMDP Apply endpoint (Google Apps Script, free).
 * Receives JSON payload with base64 files and sends them as Gmail attachments.
 *
 * Script Properties:
 * - NOTIFY_TO (default: hodh123@gmail.com)
 * - NOTIFY_CC (default: hodh123@dgist.ac.kr)
 * - MAX_FILE_MB (default: 7)
 * - SEND_APPLICANT_CONFIRMATION (true/false, default: true)
 */

function doPost(e) {
  try {
    var raw = e && e.postData && e.postData.contents ? e.postData.contents : '{}';
    var payload = JSON.parse(raw);
    validatePayload_(payload);

    var maxFileBytes = Number(getProp_('MAX_FILE_MB') || 7) * 1024 * 1024;
    var cv = buildAttachment_(payload.files.cv, ['pdf'], maxFileBytes, 'CV');
    var cover = buildAttachment_(payload.files.cover_letter, ['pdf', 'doc', 'docx'], maxFileBytes, 'Cover letter');

    var submissionId = safeString_(payload.submission_id) || buildSubmissionId_();
    var notifyTo = getProp_('NOTIFY_TO') || 'hodh123@gmail.com';
    var notifyCc = getProp_('NOTIFY_CC') || 'hodh123@dgist.ac.kr';

    var subject = '[EMDP Apply] ' + safeString_(payload.applicant_name) + ' (' + safeString_(payload.program_track) + ')';
    var body =
      'A new application was submitted from the website.\n\n' +
      'Submission ID: ' + submissionId + '\n' +
      'Submitted at: ' + safeString_(payload.submitted_at) + '\n' +
      'Name: ' + safeString_(payload.applicant_name) + '\n' +
      'Email: ' + safeString_(payload.applicant_email) + '\n' +
      'Track: ' + safeString_(payload.program_track) + '\n' +
      'Affiliation: ' + safeString_(payload.affiliation) + '\n' +
      'Source page: ' + safeString_(payload.source_page) + '\n\n' +
      'Research proposal note:\n' + safeString_(payload.research_proposal_note) + '\n\n' +
      'Special note:\n' + safeString_(payload.special_note);

    safeSendEmail_(notifyTo, subject, body, {
      cc: notifyCc,
      replyTo: safeString_(payload.applicant_email),
      attachments: [cv.blob, cover.blob],
      name: 'EMDP Lab Apply Bot'
    });

    if (String(getProp_('SEND_APPLICANT_CONFIRMATION') || 'true').toLowerCase() === 'true') {
      var applicantEmail = safeString_(payload.applicant_email);
      if (applicantEmail) {
        safeSendEmail_(
          applicantEmail,
          '[EMDP Apply] Submission Received',
          'Your application has been received.\nSubmission ID: ' + submissionId + '\n\nEMDP Lab',
          { name: 'EMDP Lab Apply Bot' }
        );
      }
    }

    return json_({ success: true, submission_id: submissionId });
  } catch (error) {
    return json_({ success: false, error: String(error) });
  }
}

function doGet(_e) {
  return json_({
    ok: true,
    service: 'emdp-apply-mail-uploader',
    time: new Date().toISOString()
  });
}

function runSetupTest() {
  var notifyTo = getProp_('NOTIFY_TO') || 'hodh123@gmail.com';
  var ownerEmail = '';
  try {
    ownerEmail = Session.getEffectiveUser().getEmail();
  } catch (_error) {
    ownerEmail = '';
  }

  safeSendEmail_(
    notifyTo,
    '[EMDP Apply] Setup Test',
    'Apps Script setup test passed at ' + new Date().toISOString() + '\nRecipient: ' + notifyTo
  );

  if (ownerEmail && ownerEmail !== notifyTo) {
    safeSendEmail_(
      ownerEmail,
      '[EMDP Apply] Setup Test (Owner Copy)',
      'Apps Script setup test passed at ' + new Date().toISOString() + '\nPrimary recipient: ' + notifyTo
    );
  }

  Logger.log('Setup test email sent. notifyTo=' + notifyTo + ', owner=' + ownerEmail);
}

function runEmailDiagnostics() {
  var notifyTo = getProp_('NOTIFY_TO') || 'hodh123@gmail.com';
  var ownerEmail = '';
  try {
    ownerEmail = Session.getEffectiveUser().getEmail();
  } catch (_error) {
    ownerEmail = '(unavailable)';
  }

  var quota = MailApp.getRemainingDailyQuota();
  var stamp = new Date().toISOString();
  var subject = '[EMDP Apply] Mail Diagnostic ' + stamp;
  var body =
    'Diagnostic timestamp: ' + stamp + '\n' +
    'Owner email: ' + ownerEmail + '\n' +
    'NOTIFY_TO: ' + notifyTo + '\n' +
    'Remaining quota: ' + quota + '\n';

  safeSendEmail_(notifyTo, subject, body);
  if (ownerEmail && ownerEmail !== '(unavailable)' && ownerEmail !== notifyTo) {
    safeSendEmail_(ownerEmail, subject + ' (Owner Copy)', body);
  }

  Logger.log('Diagnostic sent. owner=' + ownerEmail + ', notifyTo=' + notifyTo + ', quota=' + quota);
}

function validatePayload_(p) {
  if (!p) throw new Error('Missing payload');
  if (!safeString_(p.applicant_name)) throw new Error('Missing applicant name');
  if (!safeString_(p.applicant_email)) throw new Error('Missing applicant email');
  if (!safeString_(p.program_track)) throw new Error('Missing program track');
  if (!safeString_(p.affiliation)) throw new Error('Missing affiliation');
  if (!safeString_(p.research_proposal_note)) throw new Error('Missing research proposal note');
  if (!p.files || !p.files.cv || !p.files.cover_letter) throw new Error('Missing files');
  if (!safeString_(p.files.cv.base64) || !safeString_(p.files.cover_letter.base64)) {
    throw new Error('Missing file bytes');
  }
}

function buildAttachment_(fileObj, allowedExt, maxBytes, label) {
  var name = safeString_(fileObj.name);
  var mime = safeString_(fileObj.type) || 'application/octet-stream';
  var ext = getExtension_(name);
  if (!allowedExt.includes(ext)) {
    throw new Error(label + ' has invalid file type');
  }

  var bytes = Utilities.base64Decode(safeString_(fileObj.base64));
  if (!bytes || !bytes.length) {
    throw new Error(label + ' is empty');
  }
  if (bytes.length > maxBytes) {
    throw new Error(label + ' exceeds size limit');
  }

  return {
    blob: Utilities.newBlob(bytes, mime, name),
    size: bytes.length
  };
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function getProp_(key) {
  var value = PropertiesService.getScriptProperties().getProperty(key);
  return value ? String(value).trim() : '';
}

function safeString_(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function getExtension_(name) {
  var s = safeString_(name).toLowerCase();
  var i = s.lastIndexOf('.');
  return i > 0 ? s.substring(i + 1) : '';
}

function buildSubmissionId_() {
  var ts = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
  var nonce = Math.random().toString(36).slice(2, 8);
  return ts + '-' + nonce;
}

function safeSendEmail_(to, subject, body, options) {
  var lastError = '';
  try {
    GmailApp.sendEmail(to, subject, body, options || {});
    return;
  } catch (error) {
    lastError = 'GmailApp failed: ' + String(error);
  }

  try {
    MailApp.sendEmail(
      Object.assign(
        {
          to: to,
          subject: subject,
          body: body
        },
        options || {}
      )
    );
    return;
  } catch (error2) {
    throw new Error(lastError + ' | MailApp failed: ' + String(error2));
  }
}
