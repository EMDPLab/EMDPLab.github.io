/**
 * Google Apps Script endpoint:
 * - Receives JSON payload with base64 file contents from apply page
 * - Uploads files + metadata to Dropbox
 * - Sends Gmail notification
 *
 * Setup (Script Properties):
 * - DROPBOX_BASE_PATH (optional, default /EMDP-Lab-Applications)
 * - DROPBOX_ACCESS_TOKEN OR:
 *   - DROPBOX_REFRESH_TOKEN
 *   - DROPBOX_APP_KEY
 *   - DROPBOX_APP_SECRET
 * - NOTIFY_TO (optional, default hodh123@gmail.com)
 * - NOTIFY_CC (optional, default hodh123@dgist.ac.kr)
 */

function doPost(e) {
  try {
    var raw = e && e.postData && e.postData.contents ? e.postData.contents : '{}';
    var payload = JSON.parse(raw);
    validatePayload_(payload);

    var submissionId = safeString_(payload.submission_id) || buildSubmissionId_(payload.applicant_name);
    var date = new Date().toISOString().slice(0, 10);
    var basePath = cleanPath_(getProp_('DROPBOX_BASE_PATH') || '/EMDP-Lab-Applications');
    var folderPath = basePath + '/' + date + '/' + submissionId;
    var token = getDropboxAccessToken_();

    ensureFolder_(token, folderPath);

    var cvName = uploadBase64File_(
      token,
      folderPath,
      'cv',
      payload.files.cv.name,
      payload.files.cv.type,
      payload.files.cv.base64
    );
    var coverName = uploadBase64File_(
      token,
      folderPath,
      'cover-letter',
      payload.files.cover_letter.name,
      payload.files.cover_letter.type,
      payload.files.cover_letter.base64
    );

    var metadata = {
      submission_id: submissionId,
      submitted_at: safeString_(payload.submitted_at),
      source_page: safeString_(payload.source_page),
      applicant_name: safeString_(payload.applicant_name),
      applicant_email: safeString_(payload.applicant_email),
      program_track: safeString_(payload.program_track),
      affiliation: safeString_(payload.affiliation),
      research_proposal_note: safeString_(payload.research_proposal_note),
      special_note: safeString_(payload.special_note),
      files: {
        cv: cvName,
        cover_letter: coverName
      }
    };

    uploadTextFile_(token, folderPath + '/submission.json', JSON.stringify(metadata, null, 2));
    sendNotification_(metadata, folderPath);

    return json_({ success: true, submission_id: submissionId });
  } catch (error) {
    return json_({ success: false, error: String(error) });
  }
}

function validatePayload_(p) {
  if (!p) throw new Error('Missing payload');
  if (!safeString_(p.applicant_name)) throw new Error('Missing applicant name');
  if (!safeString_(p.applicant_email)) throw new Error('Missing applicant email');
  if (!safeString_(p.program_track)) throw new Error('Missing program track');
  if (!safeString_(p.affiliation)) throw new Error('Missing affiliation');
  if (!safeString_(p.research_proposal_note)) throw new Error('Missing research proposal note');
  if (!p.files || !p.files.cv || !p.files.cover_letter) throw new Error('Missing files');
  if (!safeString_(p.files.cv.base64) || !safeString_(p.files.cover_letter.base64)) throw new Error('Missing file bytes');
}

function sendNotification_(meta, folderPath) {
  var to = getProp_('NOTIFY_TO') || 'hodh123@gmail.com';
  var cc = getProp_('NOTIFY_CC') || 'hodh123@dgist.ac.kr';
  var subject = '[EMDP Apply] ' + meta.applicant_name + ' (' + meta.program_track + ')';
  var body =
    'A new application was uploaded automatically.\n\n' +
    'Submission ID: ' + meta.submission_id + '\n' +
    'Submitted at: ' + meta.submitted_at + '\n' +
    'Name: ' + meta.applicant_name + '\n' +
    'Email: ' + meta.applicant_email + '\n' +
    'Track: ' + meta.program_track + '\n' +
    'Affiliation: ' + meta.affiliation + '\n' +
    'Dropbox folder: ' + folderPath + '\n\n' +
    'Research proposal note:\n' + meta.research_proposal_note + '\n\n' +
    'Special note:\n' + meta.special_note;

  GmailApp.sendEmail(to, subject, body, { cc: cc });
}

function uploadBase64File_(token, folderPath, prefix, originalName, mime, base64Data) {
  var ext = getExtension_(originalName);
  var safeBase = sanitize_(stripExtension_(originalName)) || 'file';
  var path = folderPath + '/' + prefix + '-' + safeBase + (ext ? '.' + ext : '');
  var bytes = Utilities.base64Decode(base64Data);

  var response = UrlFetchApp.fetch('https://content.dropboxapi.com/2/files/upload', {
    method: 'post',
    muteHttpExceptions: true,
    headers: {
      Authorization: 'Bearer ' + token,
      'Dropbox-API-Arg': JSON.stringify({
        path: path,
        mode: 'add',
        autorename: true,
        mute: true,
        strict_conflict: false
      }),
      'Content-Type': mime || 'application/octet-stream'
    },
    payload: bytes
  });

  if (response.getResponseCode() < 200 || response.getResponseCode() >= 300) {
    throw new Error('Dropbox upload failed: ' + response.getContentText());
  }

  var json = JSON.parse(response.getContentText());
  return json.path_display || json.path_lower || path;
}

function uploadTextFile_(token, path, content) {
  var response = UrlFetchApp.fetch('https://content.dropboxapi.com/2/files/upload', {
    method: 'post',
    muteHttpExceptions: true,
    headers: {
      Authorization: 'Bearer ' + token,
      'Dropbox-API-Arg': JSON.stringify({
        path: path,
        mode: 'add',
        autorename: true,
        mute: true,
        strict_conflict: false
      }),
      'Content-Type': 'application/octet-stream'
    },
    payload: Utilities.newBlob(content, 'application/json').getBytes()
  });

  if (response.getResponseCode() < 200 || response.getResponseCode() >= 300) {
    throw new Error('Dropbox metadata upload failed: ' + response.getContentText());
  }
}

function ensureFolder_(token, path) {
  var response = UrlFetchApp.fetch('https://api.dropboxapi.com/2/files/create_folder_v2', {
    method: 'post',
    muteHttpExceptions: true,
    contentType: 'application/json',
    headers: {
      Authorization: 'Bearer ' + token
    },
    payload: JSON.stringify({ path: path, autorename: false })
  });

  if (response.getResponseCode() === 409) return;
  if (response.getResponseCode() < 200 || response.getResponseCode() >= 300) {
    throw new Error('Dropbox folder setup failed: ' + response.getContentText());
  }
}

function getDropboxAccessToken_() {
  var direct = getProp_('DROPBOX_ACCESS_TOKEN');
  if (direct) return direct;

  var refresh = getProp_('DROPBOX_REFRESH_TOKEN');
  var appKey = getProp_('DROPBOX_APP_KEY');
  var appSecret = getProp_('DROPBOX_APP_SECRET');
  if (!refresh || !appKey || !appSecret) {
    throw new Error('Dropbox credentials are not configured in Script Properties');
  }

  var response = UrlFetchApp.fetch('https://api.dropboxapi.com/oauth2/token', {
    method: 'post',
    muteHttpExceptions: true,
    headers: {
      Authorization: 'Basic ' + Utilities.base64Encode(appKey + ':' + appSecret)
    },
    payload: {
      grant_type: 'refresh_token',
      refresh_token: refresh
    }
  });

  if (response.getResponseCode() < 200 || response.getResponseCode() >= 300) {
    throw new Error('Dropbox token refresh failed: ' + response.getContentText());
  }

  var json = JSON.parse(response.getContentText());
  if (!json.access_token) {
    throw new Error('Dropbox token refresh response missing access token');
  }
  return json.access_token;
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

function cleanPath_(path) {
  var value = safeString_(path) || '/';
  if (value.charAt(0) !== '/') value = '/' + value;
  return value.replace(/\\/+/g, '/').replace(/\\/$/, '');
}

function sanitize_(value) {
  return safeString_(value)
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function stripExtension_(name) {
  var s = safeString_(name);
  var i = s.lastIndexOf('.');
  return i > 0 ? s.substring(0, i) : s;
}

function getExtension_(name) {
  var s = safeString_(name).toLowerCase();
  var i = s.lastIndexOf('.');
  return i > 0 ? s.substring(i + 1) : '';
}

function buildSubmissionId_(name) {
  var base = sanitize_(name) || 'applicant';
  var ts = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
  var nonce = Math.random().toString(36).slice(2, 8);
  return ts + '-' + base + '-' + nonce;
}
