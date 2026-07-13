/**
 * EMDP Apply endpoint (Google Apps Script, free).
 * Receives JSON payload with base64 files and sends them as Gmail attachments.
 *
 * Script Properties:
 * - NOTIFY_TO (default: hodh123@gmail.com)
 * - NOTIFY_CC (default: hodh123@dgist.ac.kr)
 * - MAX_FILE_MB (default: 7)
 * - SEND_APPLICANT_CONFIRMATION (true/false, default: true)
 * - MAX_SUBMISSIONS_PER_HOUR (default: 3)
 * - MAX_SUBMISSIONS_PER_EMAIL_6H (default: 2)
 * - MIN_FORM_SECONDS (default: 3)
 */

var PRIVACY_CONSENT_VERSION_ = '2026-07-10';

function doPost(e) {
  try {
    var raw = e && e.postData && e.postData.contents ? e.postData.contents : '{}';
    var payload = JSON.parse(raw);
    validatePayload_(payload);
    validateSubmissionPreconditions_(payload);

    var maxFileBytes = Number(getProp_('MAX_FILE_MB') || 7) * 1024 * 1024;
    var cv = buildAttachment_(payload.files.cv, ['pdf'], maxFileBytes, 'CV');
    consumeSubmissionLimits_(payload);

    var submissionId = safeString_(payload.submission_id) || buildSubmissionId_();
    var notifyTo = getProp_('NOTIFY_TO') || 'hodh123@gmail.com';
    var notifyCc = getProp_('NOTIFY_CC') || 'hodh123@dgist.ac.kr';

    var subject = '[EMDP Apply] ' + singleLine_(payload.applicant_name) + ' (' + singleLine_(payload.program_track) + ')';
    var body =
      'A new application was submitted from the website.\n\n' +
      'Submission ID: ' + submissionId + '\n' +
      'Submitted at: ' + safeString_(payload.submitted_at) + '\n' +
      'Name: ' + safeString_(payload.applicant_name) + '\n' +
      'Email: ' + safeString_(payload.applicant_email) + '\n' +
      'Track: ' + safeString_(payload.program_track) + '\n' +
      'Affiliation: ' + safeString_(payload.affiliation) + '\n' +
      'Source page: ' + safeString_(payload.source_page) + '\n\n' +
      'Privacy consent: ' + safeString_(payload.privacy_consent_version) + ' at ' + safeString_(payload.privacy_consent_at);

    safeSendEmail_(notifyTo, subject, body, {
      cc: notifyCc,
      replyTo: safeString_(payload.applicant_email),
      attachments: [cv.blob],
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
    Logger.log('Application submission failed: ' + String(error));
    return json_({ success: false, error: 'Submission could not be processed.' });
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
  requireText_(p.applicant_name, 'Applicant name', 80);
  var email = requireText_(p.applicant_email, 'Applicant email', 254);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Invalid applicant email');

  var track = requireText_(p.program_track, 'Program track', 40);
  if (['Internship', 'Undergraduate Research', 'MSc', 'PhD'].indexOf(track) === -1) {
    throw new Error('Invalid program track');
  }

  requireText_(p.affiliation, 'Affiliation', 120);
  optionalText_(p.source_page, 'Source page', 500);
  if (safeString_(p.privacy_consent) !== 'agreed') throw new Error('Missing privacy consent');
  if (safeString_(p.privacy_consent_version) !== PRIVACY_CONSENT_VERSION_) {
    throw new Error('Invalid privacy consent version');
  }
  var consentAt = Date.parse(safeString_(p.privacy_consent_at));
  if (!isFinite(consentAt)) throw new Error('Invalid privacy consent timestamp');

  var submissionId = safeString_(p.submission_id);
  if (submissionId && !/^[a-z0-9-]{8,80}$/i.test(submissionId)) {
    throw new Error('Invalid submission ID');
  }
  if (!p.files || !p.files.cv) throw new Error('Missing CV');
  if (!safeString_(p.files.cv.base64)) throw new Error('Missing CV bytes');
}

function validateSubmissionPreconditions_(payload) {
  if (safeString_(payload.honeypot)) throw new Error('Submission blocked');

  var startedAt = Number(payload.started_at);
  var minFormSeconds = Number(getProp_('MIN_FORM_SECONDS') || 3);
  var elapsed = Date.now() - startedAt;
  if (!isFinite(startedAt) || elapsed < minFormSeconds * 1000 || elapsed > 24 * 60 * 60 * 1000) {
    throw new Error('Invalid form timing');
  }
  if (MailApp.getRemainingDailyQuota() < requiredMailQuota_(payload)) {
    throw new Error('Mail quota is temporarily unavailable');
  }
}

function requiredMailQuota_(payload) {
  var recipients = [];
  function addRecipient(value) {
    var email = safeString_(value).toLowerCase();
    if (email && recipients.indexOf(email) === -1) recipients.push(email);
  }

  addRecipient(getProp_('NOTIFY_TO') || 'hodh123@gmail.com');
  addRecipient(getProp_('NOTIFY_CC') || 'hodh123@dgist.ac.kr');
  if (String(getProp_('SEND_APPLICANT_CONFIRMATION') || 'true').toLowerCase() === 'true') {
    addRecipient(payload.applicant_email);
  }
  return recipients.length;
}

function consumeSubmissionLimits_(payload) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) throw new Error('Submission service is busy');
  try {
    var cache = CacheService.getScriptCache();
    var hourKey = 'apply-hour-' + new Date().toISOString().slice(0, 13);
    var emailKey = 'apply-email-' + stableHash_(safeString_(payload.applicant_email).toLowerCase());
    var hourCount = Number(cache.get(hourKey) || 0);
    var emailCount = Number(cache.get(emailKey) || 0);
    var hourLimit = Number(getProp_('MAX_SUBMISSIONS_PER_HOUR') || 3);
    var emailLimit = Number(getProp_('MAX_SUBMISSIONS_PER_EMAIL_6H') || 2);
    if (hourCount >= hourLimit) throw new Error('Hourly submission limit reached');
    if (emailCount >= emailLimit) throw new Error('Email submission limit reached');
    cache.put(hourKey, String(hourCount + 1), 3600);
    cache.put(emailKey, String(emailCount + 1), 21600);
  } finally {
    lock.releaseLock();
  }
}

function stableHash_(value) {
  var hash = 2166136261;
  var text = safeString_(value);
  for (var i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function requireText_(value, label, maxLength) {
  var text = safeString_(value);
  if (!text) throw new Error('Missing ' + label.toLowerCase());
  if (text.length > maxLength) throw new Error(label + ' exceeds length limit');
  return text;
}

function optionalText_(value, label, maxLength) {
  var text = safeString_(value);
  if (text.length > maxLength) throw new Error(label + ' exceeds length limit');
  return text;
}

function buildAttachment_(fileObj, allowedExt, maxBytes, label) {
  var name = singleLine_(fileObj.name).replace(/[\\/]/g, '_').slice(0, 180);
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

  var signatures = {
    pdf: [0x25, 0x50, 0x44, 0x46, 0x2d],
    doc: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1],
    docx: [0x50, 0x4b, 0x03, 0x04]
  };
  if (!hasBytePrefix_(bytes, signatures[ext])) throw new Error(label + ' has invalid file signature');

  var mimeTypes = {
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  };

  return {
    blob: Utilities.newBlob(bytes, mimeTypes[ext], name),
    size: bytes.length
  };
}

function hasBytePrefix_(bytes, signature) {
  if (!signature || bytes.length < signature.length) return false;
  for (var i = 0; i < signature.length; i += 1) {
    if ((Number(bytes[i]) + 256) % 256 !== signature[i]) return false;
  }
  return true;
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

function singleLine_(value) {
  return safeString_(value).replace(/[\r\n]+/g, ' ').replace(/\s{2,}/g, ' ');
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
