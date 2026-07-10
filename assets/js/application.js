const CV_EXTENSIONS = ['pdf'];
const COVER_EXTENSIONS = ['pdf', 'doc', 'docx'];

function valueOf(formData, key) {
  const value = formData && typeof formData.get === 'function' ? formData.get(key) : '';
  return String(value ?? '').trim();
}

function extensionOf(file) {
  const name = String(file?.name ?? '').toLowerCase();
  const index = name.lastIndexOf('.');
  return index > -1 ? name.slice(index + 1) : '';
}

export function transportKind(endpoint) {
  if (!endpoint || !/^https?:\/\//i.test(endpoint)) return 'invalid';
  return /script\.google\.com\/macros\/s\/.+\/exec/i.test(endpoint) ? 'apps-script' : 'http';
}

export function validateApplicationPackage({ consent, honeypot, files, maxFileMb }) {
  if (honeypot) return { ok: false, message: 'Submission blocked.' };
  if (!consent) return { ok: false, message: 'Please confirm the consent checkbox.' };

  const cv = files?.cv;
  const coverLetter = files?.coverLetter;
  if (!cv || !CV_EXTENSIONS.includes(extensionOf(cv))) {
    return { ok: false, message: 'CV must be a PDF file.' };
  }
  if (!coverLetter || !COVER_EXTENSIONS.includes(extensionOf(coverLetter))) {
    return { ok: false, message: 'Cover letter must be PDF, DOC, or DOCX.' };
  }

  const maxBytes = maxFileMb * 1024 * 1024;
  if (cv.size > maxBytes || coverLetter.size > maxBytes) {
    return { ok: false, message: `Each file must be ${maxFileMb}MB or smaller.` };
  }
  return { ok: true };
}

function createSubmissionId(now, random) {
  const stamp = now().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
  const nonce = random().toString(36).slice(2, 8);
  return `${stamp}-${nonce}`;
}

export async function submitApplication({
  endpoint,
  formData,
  files,
  encodeFile,
  fetchImpl = fetch,
  now = () => new Date(),
  random = Math.random
}) {
  const kind = transportKind(endpoint);
  if (kind === 'invalid') throw new Error('Upload endpoint is not configured.');

  if (kind === 'apps-script') {
    const submissionId = createSubmissionId(now, random);
    const [cvBase64, coverBase64] = await Promise.all([
      encodeFile(files.cv),
      encodeFile(files.coverLetter)
    ]);
    const payload = {
      submission_id: submissionId,
      submitted_at: now().toISOString(),
      source_page: valueOf(formData, 'source_page'),
      applicant_name: valueOf(formData, 'applicant_name'),
      applicant_email: valueOf(formData, 'applicant_email'),
      program_track: valueOf(formData, 'program_track'),
      affiliation: valueOf(formData, 'affiliation'),
      research_proposal_note: valueOf(formData, 'research_proposal_note'),
      special_note: valueOf(formData, 'special_note'),
      files: {
        cv: {
          name: files.cv.name,
          type: files.cv.type || 'application/pdf',
          base64: cvBase64
        },
        cover_letter: {
          name: files.coverLetter.name,
          type: files.coverLetter.type || 'application/octet-stream',
          base64: coverBase64
        }
      }
    };

    await fetchImpl(endpoint, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      body: JSON.stringify(payload)
    });

    return { state: 'queued', verified: false, submissionId };
  }

  const response = await fetchImpl(endpoint, { method: 'POST', body: formData });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.success === false) {
    throw new Error(payload.error || 'Upload failed');
  }
  return {
    state: 'confirmed',
    verified: true,
    submissionId: payload.submission_id || ''
  };
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const commaIndex = result.indexOf(',');
      resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result);
    };
    reader.onerror = () => reject(new Error('File read failed'));
    reader.readAsDataURL(file);
  });
}

function setMessage(target, text, kind) {
  if (!target) return;
  target.textContent = text || '';
  target.classList.remove('success', 'error', 'pending');
  if (kind) target.classList.add(kind);
}

function recentSubmissions() {
  try {
    const parsed = JSON.parse(localStorage.getItem('emdp_apply_submit_v2') || '[]');
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    return Array.isArray(parsed) ? parsed.filter((time) => Number.isFinite(time) && time > cutoff) : [];
  } catch {
    return [];
  }
}

function recordSubmission() {
  try {
    localStorage.setItem('emdp_apply_submit_v2', JSON.stringify([...recentSubmissions(), Date.now()]));
  } catch {}
}

export function setupApplicationForm() {
  const form = document.getElementById('applicationForm');
  if (!form || form.dataset.applicationBound === 'true') return;
  form.dataset.applicationBound = 'true';

  const endpoint = String(form.dataset.uploadEndpoint || '').trim();
  const status = document.getElementById('applicationStatus');
  const submitButton = document.getElementById('applicationSubmit');
  const startedField = document.getElementById('applicationStartedAt');
  const consent = document.getElementById('consentCheck');
  const cvInput = document.getElementById('cvFile');
  const coverInput = document.getElementById('coverFile');
  const honeypot = form.querySelector('input[name="_honey"]');

  if (startedField) startedField.value = String(Date.now());

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const kind = transportKind(endpoint);
    if (kind === 'invalid') {
      setMessage(status, 'Upload endpoint is not configured. Please email the lab directly.', 'error');
      return;
    }
    if (recentSubmissions().length >= 5) {
      setMessage(status, 'Too many submissions from this browser today. Please email the lab directly.', 'error');
      return;
    }

    const files = {
      cv: cvInput?.files?.[0],
      coverLetter: coverInput?.files?.[0]
    };
    const maxFileMb = kind === 'apps-script' ? 7 : 10;
    const validation = validateApplicationPackage({
      consent: Boolean(consent?.checked),
      honeypot: String(honeypot?.value || '').trim(),
      files,
      maxFileMb
    });
    if (!validation.ok) {
      setMessage(status, validation.message, 'error');
      return;
    }

    const formData = new FormData(form);
    formData.set('source_page', window.location.href);
    formData.set('submitted_at', new Date().toISOString());
    submitButton.disabled = true;
    submitButton.textContent = 'Sending...';
    setMessage(status, 'Sending your application package...', 'pending');

    try {
      const result = await submitApplication({
        endpoint,
        formData,
        files,
        encodeFile: fileToBase64
      });
      recordSubmission();
      form.reset();
      if (startedField) startedField.value = String(Date.now());

      if (result.verified) {
        setMessage(status, `Application received. Submission ID: ${result.submissionId || 'confirmed'}`, 'success');
      } else {
        setMessage(
          status,
          `Application request sent. ID: ${result.submissionId}. Receipt is confirmed only when the confirmation email arrives.`,
          'pending'
        );
      }
    } catch (error) {
      setMessage(status, error?.message || 'Upload failed. Please email the lab directly.', 'error');
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = 'Submit Application Package';
    }
  });
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupApplicationForm, { once: true });
  } else {
    setupApplicationForm();
  }
}
