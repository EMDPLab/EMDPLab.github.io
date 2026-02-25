const CV_ALLOWED_EXTENSIONS = ['pdf'];
const COVER_ALLOWED_EXTENSIONS = ['pdf', 'doc', 'docx'];

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const isApplyPath = url.pathname === '/api/apply' || url.pathname === '/apply';
    const origin = request.headers.get('Origin') || '';
    const cors = buildCorsHeaders(origin, env);

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: cors
      });
    }

    if (!isApplyPath) {
      return jsonResponse({ success: false, error: 'Not found' }, 404, cors);
    }

    if (request.method !== 'POST') {
      return jsonResponse({ success: false, error: 'Method not allowed' }, 405, cors);
    }

    if (!isOriginAllowed(origin, env)) {
      return jsonResponse({ success: false, error: 'Origin not allowed' }, 403, cors);
    }

    try {
      const formData = await request.formData();
      const payload = extractPayload(formData);
      validatePayload(payload, env);

      const dropboxAccessToken = await getDropboxAccessToken(env);
      const submissionId = buildSubmissionId(payload.applicantName);
      const rootPath = cleanDropboxPath(env.DROPBOX_BASE_PATH || '/EMDP-Lab-Applications');
      const rootPrefix = rootPath === '/' ? '' : rootPath;
      const folderPath = `${rootPrefix}/${new Date().toISOString().slice(0, 10)}/${submissionId}`;

      await ensureFolder(folderPath, dropboxAccessToken);

      const cvUpload = await uploadFile({
        token: dropboxAccessToken,
        folderPath,
        file: payload.cvFile,
        filePrefix: 'cv'
      });

      const coverUpload = await uploadFile({
        token: dropboxAccessToken,
        folderPath,
        file: payload.coverFile,
        filePrefix: 'cover-letter'
      });

      const metadata = {
        submission_id: submissionId,
        submitted_at: new Date().toISOString(),
        applicant_name: payload.applicantName,
        applicant_email: payload.applicantEmail,
        program_track: payload.programTrack,
        affiliation: payload.affiliation,
        research_proposal_note: payload.proposalNote,
        special_note: payload.specialNote,
        source_page: payload.sourcePage,
        files: {
          cv: cvUpload.path_display || cvUpload.path_lower || '',
          cover_letter: coverUpload.path_display || coverUpload.path_lower || ''
        }
      };

      await uploadTextFile({
        token: dropboxAccessToken,
        path: `${folderPath}/submission.json`,
        content: JSON.stringify(metadata, null, 2)
      });

      let folderLink = '';
      try {
        folderLink = await getSharedLink(folderPath, dropboxAccessToken);
      } catch (error) {
        folderLink = '';
      }

      let notificationSent = false;
      try {
        notificationSent = await sendNotificationEmail(env, {
          submissionId,
          folderPath,
          folderLink,
          applicantName: payload.applicantName,
          applicantEmail: payload.applicantEmail,
          programTrack: payload.programTrack,
          affiliation: payload.affiliation
        });
      } catch (error) {
        notificationSent = false;
      }

      return jsonResponse(
        {
          success: true,
          submission_id: submissionId,
          folder_path: folderPath,
          folder_link: folderLink,
          notification_sent: notificationSent
        },
        200,
        cors
      );
    } catch (error) {
      return jsonResponse(
        {
          success: false,
          error: error && error.message ? error.message : 'Submission failed'
        },
        400,
        cors
      );
    }
  }
};

function extractPayload(formData) {
  return {
    applicantName: readString(formData, 'applicant_name'),
    applicantEmail: readString(formData, 'applicant_email'),
    programTrack: readString(formData, 'program_track'),
    affiliation: readString(formData, 'affiliation'),
    proposalNote: readString(formData, 'research_proposal_note'),
    specialNote: readString(formData, 'special_note'),
    sourcePage: readString(formData, 'source_page'),
    cvFile: formData.get('cv_pdf'),
    coverFile: formData.get('cover_letter'),
    honey: readString(formData, '_honey')
  };
}

function validatePayload(payload, env) {
  if (payload.honey) {
    throw new Error('Rejected submission');
  }

  requireField(payload.applicantName, 'Name');
  requireField(payload.applicantEmail, 'Email');
  requireField(payload.programTrack, 'Program track');
  requireField(payload.affiliation, 'Affiliation');
  requireField(payload.proposalNote, 'Research proposal note');

  if (!isValidEmail(payload.applicantEmail)) {
    throw new Error('Invalid email');
  }

  if (!(payload.cvFile instanceof File)) {
    throw new Error('CV file is required');
  }

  if (!(payload.coverFile instanceof File)) {
    throw new Error('Cover letter file is required');
  }

  const maxSizeMb = Number(env.MAX_UPLOAD_FILE_MB || '10');
  const maxSizeBytes = maxSizeMb * 1024 * 1024;

  validateFile(payload.cvFile, CV_ALLOWED_EXTENSIONS, maxSizeBytes, 'CV');
  validateFile(payload.coverFile, COVER_ALLOWED_EXTENSIONS, maxSizeBytes, 'Cover letter');
}

function requireField(value, label) {
  if (!value) throw new Error(`${label} is required`);
}

function validateFile(file, allowedExtensions, maxSizeBytes, label) {
  const ext = getFileExtension(file.name);
  if (!allowedExtensions.includes(ext)) {
    throw new Error(`${label} has an invalid file type`);
  }

  if (file.size <= 0) {
    throw new Error(`${label} file is empty`);
  }

  if (file.size > maxSizeBytes) {
    throw new Error(`${label} exceeds the size limit`);
  }
}

async function uploadFile({ token, folderPath, file, filePrefix }) {
  const ext = getFileExtension(file.name);
  const safeName = sanitizeSegment(stripExtension(file.name));
  const fileName = `${filePrefix}-${safeName || 'file'}.${ext}`;
  const targetPath = `${folderPath}/${fileName}`;
  return uploadBinaryFile({
    token,
    path: targetPath,
    content: await file.arrayBuffer()
  });
}

async function uploadTextFile({ token, path, content }) {
  return uploadBinaryFile({
    token,
    path,
    content: new TextEncoder().encode(content)
  });
}

async function uploadBinaryFile({ token, path, content }) {
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
    body: content
  });

  if (!response.ok) {
    const details = await safeReadText(response);
    throw new Error(`Dropbox upload failed: ${details || response.status}`);
  }

  return response.json();
}

async function ensureFolder(path, token) {
  const response = await fetch('https://api.dropboxapi.com/2/files/create_folder_v2', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      path,
      autorename: false
    })
  });

  if (response.ok) return;

  const details = await safeReadText(response);
  if (response.status === 409 && details.includes('conflict')) return;
  throw new Error(`Dropbox folder setup failed: ${details || response.status}`);
}

async function getSharedLink(path, token) {
  const createResponse = await fetch('https://api.dropboxapi.com/2/sharing/create_shared_link_with_settings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      path
    })
  });

  if (createResponse.ok) {
    const created = await createResponse.json();
    return created.url || '';
  }

  if (createResponse.status !== 409) {
    const details = await safeReadText(createResponse);
    throw new Error(`Dropbox shared link failed: ${details || createResponse.status}`);
  }

  const listResponse = await fetch('https://api.dropboxapi.com/2/sharing/list_shared_links', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      path,
      direct_only: true
    })
  });

  if (!listResponse.ok) return '';

  const data = await listResponse.json();
  if (!data.links || !data.links.length) return '';
  return data.links[0].url || '';
}

async function sendNotificationEmail(env, details) {
  const apiKey = (env.RESEND_API_KEY || '').trim();
  const notifyTo = (env.NOTIFY_TO || '').trim();
  if (!apiKey || !notifyTo) return false;

  const notifyFrom = (env.NOTIFY_FROM || 'EMDP Lab <onboarding@resend.dev>').trim();
  const subject = `New EMDP application: ${details.applicantName} (${details.submissionId})`;
  const text = [
    `Submission ID: ${details.submissionId}`,
    `Applicant: ${details.applicantName}`,
    `Email: ${details.applicantEmail}`,
    `Track: ${details.programTrack}`,
    `Affiliation: ${details.affiliation}`,
    `Dropbox folder: ${details.folderPath}`,
    details.folderLink ? `Dropbox link: ${details.folderLink}` : 'Dropbox link: (not created)'
  ].join('\n');

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: notifyFrom,
      to: [notifyTo],
      subject,
      text
    })
  });

  return response.ok;
}

async function getDropboxAccessToken(env) {
  const directToken = (env.DROPBOX_ACCESS_TOKEN || '').trim();
  if (directToken) return directToken;

  const refreshToken = (env.DROPBOX_REFRESH_TOKEN || '').trim();
  const appKey = (env.DROPBOX_APP_KEY || '').trim();
  const appSecret = (env.DROPBOX_APP_SECRET || '').trim();
  if (!refreshToken || !appKey || !appSecret) {
    throw new Error('Dropbox credentials are not configured');
  }

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken
  });

  const response = await fetch('https://api.dropboxapi.com/oauth2/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${btoa(`${appKey}:${appSecret}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body
  });

  if (!response.ok) {
    const details = await safeReadText(response);
    throw new Error(`Dropbox token refresh failed: ${details || response.status}`);
  }

  const data = await response.json();
  if (!data.access_token) {
    throw new Error('Dropbox token refresh did not return access token');
  }

  return data.access_token;
}

function buildCorsHeaders(origin, env) {
  const allowOrigin = isOriginAllowed(origin, env) ? origin || '*' : 'null';
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    Vary: 'Origin'
  };
}

function isOriginAllowed(origin, env) {
  const configured = (env.ALLOWED_ORIGINS || '').trim();
  if (!configured) return true;
  if (!origin) return false;

  return configured
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .includes(origin);
}

function jsonResponse(payload, status, cors) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...cors,
      'Content-Type': 'application/json; charset=utf-8'
    }
  });
}

function readString(formData, key) {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function getFileExtension(fileName) {
  const parts = String(fileName || '').toLowerCase().split('.');
  if (parts.length < 2) return '';
  return parts[parts.length - 1];
}

function stripExtension(fileName) {
  const name = String(fileName || '');
  const index = name.lastIndexOf('.');
  return index > 0 ? name.slice(0, index) : name;
}

function sanitizeSegment(input) {
  return String(input || '')
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function cleanDropboxPath(path) {
  const value = String(path || '/').trim();
  const withLeadingSlash = value.startsWith('/') ? value : `/${value}`;
  return withLeadingSlash.replace(/\/{2,}/g, '/').replace(/\/$/, '') || '/';
}

function buildSubmissionId(applicantName) {
  const base = sanitizeSegment(applicantName) || 'applicant';
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

async function safeReadText(response) {
  try {
    return (await response.text()).slice(0, 400);
  } catch (error) {
    return '';
  }
}
