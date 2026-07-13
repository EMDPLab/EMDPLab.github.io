const CV_EXTENSIONS = ['pdf'];

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
  if (!cv || !CV_EXTENSIONS.includes(extensionOf(cv))) {
    return { ok: false, message: 'CV must be a PDF file.' };
  }

  const maxBytes = maxFileMb * 1024 * 1024;
  if (cv.size > maxBytes) {
    return { ok: false, message: `CV must be ${maxFileMb}MB or smaller.` };
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
    const cvBase64 = await encodeFile(files.cv);
    const payload = {
      submission_id: submissionId,
      submitted_at: now().toISOString(),
      source_page: valueOf(formData, 'source_page'),
      applicant_name: valueOf(formData, 'applicant_name'),
      applicant_email: valueOf(formData, 'applicant_email'),
      program_track: valueOf(formData, 'program_track'),
      affiliation: valueOf(formData, 'affiliation'),
      motivation_intro: valueOf(formData, 'motivation_intro'),
      started_at: valueOf(formData, 'started_at'),
      honeypot: valueOf(formData, '_honey'),
      privacy_consent: valueOf(formData, 'privacy_consent'),
      privacy_consent_version: valueOf(formData, 'privacy_consent_version'),
      privacy_consent_at: valueOf(formData, 'privacy_consent_at'),
      files: {
        cv: {
          name: files.cv.name,
          type: files.cv.type || 'application/pdf',
          base64: cvBase64
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
  target.textContent = window.EMDP_I18N?.translate(text || '') || text || '';
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
      cv: cvInput?.files?.[0]
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
    formData.set('privacy_consent_at', new Date().toISOString());
    submitButton.disabled = true;
    submitButton.textContent = window.EMDP_I18N?.translate('Sending...') || 'Sending...';
    setMessage(status, 'Sending your application...', 'pending');

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
        setMessage(
          status,
          window.EMDP_I18N?.language() === 'ko'
            ? `지원서가 접수되었습니다. 제출 ID: ${result.submissionId || '확인됨'}`
            : `Application received. Submission ID: ${result.submissionId || 'confirmed'}`,
          'success'
        );
      } else {
        setMessage(
          status,
          window.EMDP_I18N?.language() === 'ko'
            ? `지원 요청을 전송했습니다. ID: ${result.submissionId}. 확인 이메일이 도착하면 접수가 완료된 것입니다.`
            : `Application request sent. ID: ${result.submissionId}. Receipt is confirmed only when the confirmation email arrives.`,
          'pending'
        );
      }
    } catch (error) {
      setMessage(status, error?.message || 'Upload failed. Please email the lab directly.', 'error');
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = window.EMDP_I18N?.translate('Submit Application') || 'Submit Application';
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
