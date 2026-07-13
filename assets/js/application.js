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
  if (honeypot) return { ok: false, message: '제출이 차단되었습니다.' };
  if (!consent) return { ok: false, message: '개인정보 수집 및 이용 동의 항목을 확인해주세요.' };

  const cv = files?.cv;
  if (!cv || !CV_EXTENSIONS.includes(extensionOf(cv))) {
    return { ok: false, message: 'CV는 PDF 파일이어야 합니다.' };
  }

  const maxBytes = maxFileMb * 1024 * 1024;
  if (cv.size > maxBytes) {
    return { ok: false, message: `CV는 ${maxFileMb}MB 이하여야 합니다.` };
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
  if (kind === 'invalid') throw new Error('업로드 경로가 설정되지 않았습니다.');

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
    throw new Error(payload.error || '업로드에 실패했습니다.');
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
    reader.onerror = () => reject(new Error('파일을 읽지 못했습니다.'));
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
  const honeypot = form.querySelector('input[name="_honey"]');

  if (startedField) startedField.value = String(Date.now());

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const kind = transportKind(endpoint);
    if (kind === 'invalid') {
      setMessage(status, '업로드 경로가 설정되지 않았습니다. 연구실로 직접 이메일을 보내주세요.', 'error');
      return;
    }
    if (recentSubmissions().length >= 5) {
      setMessage(status, '오늘 이 브라우저에서 제출한 횟수가 너무 많습니다. 연구실로 직접 이메일을 보내주세요.', 'error');
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
    submitButton.textContent = '전송 중...';
    setMessage(status, '지원서 전송 중...', 'pending');

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
          `지원서가 접수되었습니다. 제출 ID: ${result.submissionId || '확인됨'}`,
          'success'
        );
      } else {
        setMessage(
          status,
          `지원 요청을 전송했습니다. ID: ${result.submissionId}. 확인 이메일이 도착하면 접수가 완료된 것입니다.`,
          'pending'
        );
      }
    } catch (error) {
      console.error('[EMDP] application submission', error);
      setMessage(status, '지원서를 전송하지 못했습니다. 연구실로 직접 이메일을 보내주세요.', 'error');
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = '지원서 제출';
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
