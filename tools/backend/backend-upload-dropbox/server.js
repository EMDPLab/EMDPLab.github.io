import express from 'express';
import cors from 'cors';
import multer from 'multer';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 8080);
const maxFileMb = Number(process.env.MAX_FILE_MB || 10);
const maxFileBytes = maxFileMb * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: maxFileBytes,
    files: 2
  }
});

const allowedOrigin = (process.env.ALLOWED_ORIGIN || '').trim();
app.use(
  cors({
    origin(origin, callback) {
      if (!allowedOrigin) return callback(null, true);
      if (!origin || origin === allowedOrigin) return callback(null, true);
      return callback(new Error('Origin not allowed'));
    }
  })
);

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.post(
  '/api/apply',
  upload.fields([
    { name: 'cv_pdf', maxCount: 1 },
    { name: 'cover_letter', maxCount: 1 }
  ]),
  async (req, res) => {
    try {
      const payload = readPayload(req);
      validatePayload(payload, maxFileBytes);

      const token = await getDropboxAccessToken();
      const submissionId = buildSubmissionId(payload.applicant_name);
      const folderPath = `${cleanDropboxPath(process.env.DROPBOX_BASE_PATH || '/EMDP-Lab-Applications')}/${new Date()
        .toISOString()
        .slice(0, 10)}/${submissionId}`;

      await ensureFolder(folderPath, token);

      const cvMeta = await uploadFileToDropbox(token, folderPath, payload.cv_file, 'cv');
      const coverMeta = await uploadFileToDropbox(token, folderPath, payload.cover_file, 'cover-letter');

      const metadata = {
        submission_id: submissionId,
        submitted_at: new Date().toISOString(),
        source_page: payload.source_page,
        applicant_name: payload.applicant_name,
        applicant_email: payload.applicant_email,
        program_track: payload.program_track,
        affiliation: payload.affiliation,
        research_proposal_note: payload.research_proposal_note,
        special_note: payload.special_note,
        files: {
          cv: cvMeta.path_display || cvMeta.path_lower || '',
          cover_letter: coverMeta.path_display || coverMeta.path_lower || ''
        }
      };

      await uploadTextToDropbox(token, `${folderPath}/submission.json`, JSON.stringify(metadata, null, 2));

      await maybeNotify(metadata);

      res.json({ success: true, submission_id: submissionId });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message || 'Upload failed' });
    }
  }
);

app.use((err, _req, res, _next) => {
  if (err && err.message === 'Origin not allowed') {
    return res.status(403).json({ success: false, error: 'Origin not allowed' });
  }
  if (err && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ success: false, error: `Each file must be ${maxFileMb}MB or smaller.` });
  }
  if (err && err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({ success: false, error: 'Unexpected file field.' });
  }
  return res.status(500).json({ success: false, error: 'Internal server error' });
});

app.listen(port, () => {
  console.log(`Apply backend running on port ${port}`);
});

function readPayload(req) {
  const files = req.files || {};
  return {
    applicant_name: String(req.body.applicant_name || '').trim(),
    applicant_email: String(req.body.applicant_email || '').trim(),
    program_track: String(req.body.program_track || '').trim(),
    affiliation: String(req.body.affiliation || '').trim(),
    research_proposal_note: String(req.body.research_proposal_note || '').trim(),
    special_note: String(req.body.special_note || '').trim(),
    source_page: String(req.body.source_page || '').trim(),
    cv_file: files.cv_pdf && files.cv_pdf[0],
    cover_file: files.cover_letter && files.cover_letter[0],
    honey: String(req.body._honey || '').trim()
  };
}

function validatePayload(payload, maxBytes) {
  if (payload.honey) throw new Error('Rejected submission');

  requireField(payload.applicant_name, 'Full name');
  requireField(payload.applicant_email, 'Email');
  requireField(payload.program_track, 'Program track');
  requireField(payload.affiliation, 'Affiliation');
  requireField(payload.research_proposal_note, 'Research proposal note');

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.applicant_email)) {
    throw new Error('Invalid email');
  }

  if (!payload.cv_file) throw new Error('CV file is required');
  if (!payload.cover_file) throw new Error('Cover letter file is required');

  validateFile(payload.cv_file, ['pdf'], maxBytes, 'CV');
  validateFile(payload.cover_file, ['pdf', 'doc', 'docx'], maxBytes, 'Cover letter');
}

function validateFile(file, allowedExt, maxBytes, label) {
  const ext = getExtension(file.originalname);
  if (!allowedExt.includes(ext)) {
    throw new Error(`${label} has an invalid file type`);
  }
  if (!file.buffer || !file.buffer.length) {
    throw new Error(`${label} file is empty`);
  }
  if (file.size > maxBytes) {
    throw new Error(`${label} exceeds the size limit`);
  }
}

function requireField(value, label) {
  if (!value) throw new Error(`${label} is required`);
}

function getExtension(name) {
  const parts = String(name || '').toLowerCase().split('.');
  if (parts.length < 2) return '';
  return parts[parts.length - 1];
}

function sanitizeSegment(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function buildSubmissionId(name) {
  const base = sanitizeSegment(name) || 'applicant';
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  const hh = String(now.getUTCHours()).padStart(2, '0');
  const mm = String(now.getUTCMinutes()).padStart(2, '0');
  const ss = String(now.getUTCSeconds()).padStart(2, '0');
  const nonce = Math.random().toString(36).slice(2, 8);
  return `${y}${m}${d}-${hh}${mm}${ss}-${base}-${nonce}`;
}

function cleanDropboxPath(path) {
  const value = String(path || '/').trim();
  const withLeading = value.startsWith('/') ? value : `/${value}`;
  return withLeading.replace(/\/+$/, '').replace(/\/\//g, '/');
}

async function getDropboxAccessToken() {
  const direct = (process.env.DROPBOX_ACCESS_TOKEN || '').trim();
  if (direct) return direct;

  const refresh = (process.env.DROPBOX_REFRESH_TOKEN || '').trim();
  const appKey = (process.env.DROPBOX_APP_KEY || '').trim();
  const appSecret = (process.env.DROPBOX_APP_SECRET || '').trim();

  if (!refresh || !appKey || !appSecret) {
    throw new Error('Dropbox credentials are not configured');
  }

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refresh
  });

  const response = await fetch('https://api.dropboxapi.com/oauth2/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${appKey}:${appSecret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body
  });

  if (!response.ok) {
    throw new Error(`Dropbox token refresh failed (${response.status})`);
  }

  const json = await response.json();
  if (!json.access_token) {
    throw new Error('Dropbox token refresh failed');
  }
  return json.access_token;
}

async function ensureFolder(path, token) {
  const response = await fetch('https://api.dropboxapi.com/2/files/create_folder_v2', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ path, autorename: false })
  });

  if (response.ok) return;
  if (response.status === 409) return;
  throw new Error(`Dropbox folder setup failed (${response.status})`);
}

async function uploadFileToDropbox(token, folderPath, file, prefix) {
  const ext = getExtension(file.originalname);
  const safe = sanitizeSegment(file.originalname.replace(/\.[^.]+$/, '')) || 'file';
  const targetPath = `${folderPath}/${prefix}-${safe}.${ext}`;

  const response = await fetch('https://content.dropboxapi.com/2/files/upload', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Dropbox-API-Arg': JSON.stringify({
        path: targetPath,
        mode: 'add',
        autorename: true,
        mute: true,
        strict_conflict: false
      }),
      'Content-Type': 'application/octet-stream'
    },
    body: file.buffer
  });

  if (!response.ok) {
    throw new Error(`Dropbox upload failed (${response.status})`);
  }

  return response.json();
}

async function uploadTextToDropbox(token, path, content) {
  const response = await fetch('https://content.dropboxapi.com/2/files/upload', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Dropbox-API-Arg': JSON.stringify({
        path,
        mode: 'add',
        autorename: true,
        mute: true,
        strict_conflict: false
      }),
      'Content-Type': 'application/octet-stream'
    },
    body: Buffer.from(content, 'utf8')
  });

  if (!response.ok) {
    throw new Error(`Dropbox metadata upload failed (${response.status})`);
  }
}

async function maybeNotify(metadata) {
  const webhook = (process.env.NOTIFY_WEBHOOK_URL || '').trim();
  if (!webhook) return;
  try {
    await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      body: JSON.stringify(metadata)
    });
  } catch (_error) {
    // ignore notification errors
  }
}
