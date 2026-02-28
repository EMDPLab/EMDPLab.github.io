(function () {
  var THEME_STORAGE_KEY = 'emdp_theme_version';
  var DEFAULT_THEME = 'current';
  var ALLOWED_THEMES = { current: true, previous: true };
  var THEME_OPTION_SELECTOR = '.theme-option[data-theme-value]';

  function byId(id) {
    return document.getElementById(id);
  }

  function resolveTheme(theme) {
    return ALLOWED_THEMES[theme] ? theme : DEFAULT_THEME;
  }

  function syncThemeSwitchThumbs() {
    document.querySelectorAll('.theme-switch').forEach(function (group) {
      var options = Array.from(group.querySelectorAll(THEME_OPTION_SELECTOR));
      if (!options.length) return;

      var thumb = group.querySelector('.theme-switch-thumb');
      if (!thumb) {
        thumb = document.createElement('span');
        thumb.className = 'theme-switch-thumb';
        thumb.setAttribute('aria-hidden', 'true');
        group.insertBefore(thumb, group.firstChild);
      }

      var activeOption = options.find(function (option) {
        return option.classList.contains('active');
      });
      if (!activeOption) activeOption = options[0];

      var hostRect = group.getBoundingClientRect();
      var targetRect = activeOption.getBoundingClientRect();
      thumb.style.width = targetRect.width + 'px';
      thumb.style.height = targetRect.height + 'px';
      thumb.style.transform =
        'translate3d(' + (targetRect.left - hostRect.left) + 'px,' + (targetRect.top - hostRect.top) + 'px,0)';
    });
  }

  function applyTheme(theme) {
    var safeTheme = resolveTheme(theme);
    document.body.setAttribute('data-theme', safeTheme);
    document.querySelectorAll(THEME_OPTION_SELECTOR).forEach(function (option) {
      var active = option.getAttribute('data-theme-value') === safeTheme;
      option.classList.toggle('active', active);
      option.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    window.requestAnimationFrame(syncThemeSwitchThumbs);
  }

  function getStoredTheme() {
    try {
      return resolveTheme(window.localStorage.getItem(THEME_STORAGE_KEY));
    } catch (error) {
      return DEFAULT_THEME;
    }
  }

  function storeTheme(theme) {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, resolveTheme(theme));
    } catch (error) {}
  }

  function setupThemeSelector() {
    var selectedTheme = getStoredTheme();
    applyTheme(selectedTheme);

    document.querySelectorAll(THEME_OPTION_SELECTOR).forEach(function (option) {
      if (option.getAttribute('data-theme-bound') === '1') return;
      option.setAttribute('data-theme-bound', '1');
      option.addEventListener('click', function () {
        var nextTheme = resolveTheme(option.getAttribute('data-theme-value') || DEFAULT_THEME);
        applyTheme(nextTheme);
        storeTheme(nextTheme);
      });
    });

    if (document.body.getAttribute('data-theme-resize-bound') !== '1') {
      document.body.setAttribute('data-theme-resize-bound', '1');
      window.addEventListener('resize', syncThemeSwitchThumbs);
      window.addEventListener('orientationchange', syncThemeSwitchThumbs);
    }
  }

  function setActiveNav() {
    var page = document.body.getAttribute('data-page');
    if (!page) return;
    document.querySelectorAll('.nav-link').forEach(function (link) {
      if (link.getAttribute('data-nav') === page) {
        link.classList.add('active');
      }
    });
  }

  function setupMenuToggle() {
    var toggle = byId('menuToggle');
    var nav = byId('siteNav');
    if (!toggle || !nav) return;
    toggle.addEventListener('click', function () {
      nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', nav.classList.contains('open') ? 'true' : 'false');
    });
  }

  function setupDeviceMode() {
    function applyMode() {
      var compactWidth = window.matchMedia('(max-width: 860px)').matches;
      var touchDevice = window.matchMedia('(pointer: coarse)').matches && window.matchMedia('(max-width: 1180px)').matches;
      var isMobileMode = compactWidth || touchDevice;
      document.body.setAttribute('data-device', isMobileMode ? 'mobile' : 'desktop');
    }

    applyMode();
    window.addEventListener('resize', applyMode);
    window.addEventListener('orientationchange', applyMode);
  }

  function setupPerformanceMode() {
    var connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    var saveData = !!(connection && connection.saveData);
    var lowMemory = typeof navigator.deviceMemory === 'number' && navigator.deviceMemory <= 4;
    var lowCoreCount = typeof navigator.hardwareConcurrency === 'number' && navigator.hardwareConcurrency <= 4;
    var liteMode = prefersReducedMotion() || saveData || lowMemory || lowCoreCount;
    document.body.setAttribute('data-performance', liteMode ? 'lite' : 'full');
  }

  function setupNavGlass() {
    document.querySelectorAll('.site-nav').forEach(function (nav) {
      var links = Array.from(nav.querySelectorAll('.nav-link'));
      if (!links.length) return;

      var indicator = document.createElement('span');
      indicator.className = 'nav-glass-indicator';
      nav.appendChild(indicator);

      function isMobileViewport() {
        return window.matchMedia('(max-width: 760px)').matches;
      }

      function hideIndicator() {
        indicator.classList.remove('active');
      }

      function moveIndicator(target, driftX, driftY) {
        if (!target || isMobileViewport()) {
          hideIndicator();
          return;
        }

        var navRect = nav.getBoundingClientRect();
        var targetRect = target.getBoundingClientRect();
        var offsetX = typeof driftX === 'number' ? driftX : 0;
        var offsetY = typeof driftY === 'number' ? driftY : 0;
        var left = targetRect.left - navRect.left + offsetX;
        var top = targetRect.top - navRect.top + offsetY;

        indicator.style.width = targetRect.width + 'px';
        indicator.style.height = targetRect.height + 'px';
        indicator.style.transform = 'translate3d(' + left + 'px, ' + top + 'px, 0)';
        indicator.classList.add('active');
      }

      function resetToActiveLink() {
        var activeLink = nav.querySelector('.nav-link.active');
        if (activeLink) {
          moveIndicator(activeLink);
          return;
        }
        hideIndicator();
      }

      links.forEach(function (link) {
        link.addEventListener('mouseenter', function () {
          moveIndicator(link);
        });

        link.addEventListener('mousemove', function (event) {
          var rect = link.getBoundingClientRect();
          var driftX = (event.clientX - rect.left - rect.width / 2) * 0.18;
          var driftY = (event.clientY - rect.top - rect.height / 2) * 0.24;
          moveIndicator(link, driftX, driftY);
        });

        link.addEventListener('focus', function () {
          moveIndicator(link);
        });
      });

      nav.addEventListener('mouseleave', resetToActiveLink);
      nav.addEventListener('focusout', function (event) {
        if (!nav.contains(event.relatedTarget)) resetToActiveLink();
      });
      window.addEventListener('resize', resetToActiveLink);

      resetToActiveLink();
    });
  }

  var revealObserver = null;
  var revealSeed = 0;

  function prefersReducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function setupPageChoreography() {
    document.body.setAttribute('data-stage', 'prelude');
    var sequenceTargets = document.querySelectorAll('main > .container > .hero, main > .container > .page-title, main > .container > .section, main > .container > .contact');
    sequenceTargets.forEach(function (item, index) {
      item.style.setProperty('--stage-order', String(index));
    });
    window.requestAnimationFrame(function () {
      window.requestAnimationFrame(function () {
        document.body.setAttribute('data-stage', 'ready');
      });
    });
  }

  function setupScrollProgress() {
    var bar = document.querySelector('.scroll-progress');
    if (!bar) {
      bar = document.createElement('div');
      bar.className = 'scroll-progress';
      bar.setAttribute('aria-hidden', 'true');
      bar.innerHTML = '<span class="scroll-progress-fill"></span>';
      document.body.appendChild(bar);
    }

    var fill = bar.querySelector('.scroll-progress-fill');
    var ticking = false;

    function paint() {
      var top = window.pageYOffset || document.documentElement.scrollTop || 0;
      var max = document.documentElement.scrollHeight - window.innerHeight;
      var ratio = max > 0 ? Math.min(top / max, 1) : 0;
      fill.style.transform = 'scaleX(' + ratio.toFixed(4) + ')';
      ticking = false;
    }

    function requestPaint() {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(paint);
    }

    window.addEventListener('scroll', requestPaint, { passive: true });
    window.addEventListener('resize', requestPaint);
    window.addEventListener('orientationchange', requestPaint);
    requestPaint();
  }

  function revealTargets() {
    return document.querySelectorAll(
      '.hero, .section, .contact, .metric-card, .fit-item, .step-card, .team-card, .news-card, .publication-item, .photo-item, .apply-form-side, .application-form'
    );
  }

  function refreshRevealTargets() {
    var reduced = prefersReducedMotion();

    revealTargets().forEach(function (target) {
      if (target.getAttribute('data-reveal-ready') === '1') {
        if (reduced) target.classList.add('revealed');
        return;
      }

      target.setAttribute('data-reveal-ready', '1');
      target.classList.add('reveal-ready');
      target.style.setProperty('--reveal-delay', String((revealSeed % 8) * 34) + 'ms');
      revealSeed += 1;

      if (reduced || !revealObserver) {
        target.classList.add('revealed');
      } else {
        revealObserver.observe(target);
      }
    });
  }

  function setupScrollReveal() {
    if (!prefersReducedMotion() && 'IntersectionObserver' in window) {
      try {
        revealObserver = new IntersectionObserver(
          function (entries) {
            entries.forEach(function (entry) {
              if (!entry.isIntersecting) return;
              entry.target.classList.add('revealed');
              revealObserver.unobserve(entry.target);
            });
          },
          {
            threshold: 0.16,
            rootMargin: '0px 0px -8% 0px'
          }
        );
      } catch (error) {
        revealObserver = null;
      }
    }

    refreshRevealTargets();
  }

  function setupCardTilt() {
    var disableTilt = prefersReducedMotion() || window.matchMedia('(pointer: coarse)').matches;
    var cards = document.querySelectorAll(
      '.metric-card, .fit-item, .step-card, .team-card, .news-card, .publication-item, .photo-item:not(.topic-lead), .apply-form-side'
    );

    function clearTilt(card) {
      card.style.setProperty('--tilt-x', '0deg');
      card.style.setProperty('--tilt-y', '0deg');
      card.style.setProperty('--tilt-lift', '0px');
    }

    cards.forEach(function (card) {
      if (disableTilt) {
        card.classList.remove('dynamic-tilt');
        clearTilt(card);
        return;
      }

      card.classList.add('dynamic-tilt');
      if (card.getAttribute('data-tilt-bound') === '1') return;

      card.setAttribute('data-tilt-bound', '1');

      card.addEventListener('pointermove', function (event) {
        var rect = card.getBoundingClientRect();
        var x = (event.clientX - rect.left) / rect.width;
        var y = (event.clientY - rect.top) / rect.height;
        var rotateY = (x - 0.5) * 6;
        var rotateX = (0.5 - y) * 5;
        card.style.setProperty('--tilt-x', rotateX.toFixed(2) + 'deg');
        card.style.setProperty('--tilt-y', rotateY.toFixed(2) + 'deg');
        card.style.setProperty('--tilt-lift', '-2px');
      });

      card.addEventListener('pointerleave', function () {
        clearTilt(card);
      });

      card.addEventListener('pointercancel', function () {
        clearTilt(card);
      });
    });
  }

  function setupLiquidGlass() {
    var disableLiquid =
      prefersReducedMotion() ||
      window.matchMedia('(pointer: coarse)').matches ||
      document.body.getAttribute('data-performance') === 'lite';
    var targets = document.querySelectorAll(
      '.hero, .card, .contact, .metric-card, .fit-item, .step-card, .team-card, .photo-item, .news-media, .publication-item, .apply-form-side, .application-form'
    );

    function setDefault(target) {
      target.style.setProperty('--lx', '50%');
      target.style.setProperty('--ly', '50%');
      target.style.setProperty('--la', '0.08');
    }

    targets.forEach(function (target) {
      target.classList.add('liquid-glass');
      if (target.getAttribute('data-liquid-overlay') !== '1') {
        target.setAttribute('data-liquid-overlay', '1');
        if (window.getComputedStyle(target).position === 'static') {
          target.style.position = 'relative';
        }
        var light = document.createElement('span');
        light.className = 'liquid-light';
        light.setAttribute('aria-hidden', 'true');
        target.insertBefore(light, target.firstChild);
      }
      if (disableLiquid) {
        setDefault(target);
        return;
      }
      if (target.getAttribute('data-liquid-bound') === '1') return;
      target.setAttribute('data-liquid-bound', '1');
      setDefault(target);

      target.addEventListener('pointermove', function (event) {
        var rect = target.getBoundingClientRect();
        var x = event.clientX - rect.left;
        var y = event.clientY - rect.top;
        var intensity = ((x / rect.width + (1 - y / rect.height)) * 0.5).toFixed(3);
        target.style.setProperty('--lx', x.toFixed(1) + 'px');
        target.style.setProperty('--ly', y.toFixed(1) + 'px');
        target.style.setProperty('--la', String(Math.max(0.08, Math.min(0.32, Number(intensity) * 0.38))));
      });

      target.addEventListener('pointerleave', function () {
        setDefault(target);
      });

      target.addEventListener('pointercancel', function () {
        setDefault(target);
      });
    });
  }

  function refreshDynamicEffects() {
    try {
      refreshRevealTargets();
    } catch (error) {}
    try {
      setupCardTilt();
    } catch (error) {}
    try {
      setupLiquidGlass();
    } catch (error) {}
  }

  function runSafely(task) {
    try {
      task();
    } catch (error) {}
  }

  function setFormMessage(target, text, kind) {
    if (!target) return;
    target.textContent = text || '';
    target.classList.remove('success', 'error');
    if (kind) target.classList.add(kind);
  }

  function getEvents(key) {
    try {
      var raw = window.localStorage.getItem(key);
      var list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch (error) {
      return [];
    }
  }

  function isRateLimited(key, limit, windowMs) {
    var now = Date.now();
    var events = getEvents(key).filter(function (time) {
      return typeof time === 'number' && now - time < windowMs;
    });

    try {
      window.localStorage.setItem(key, JSON.stringify(events));
    } catch (error) {}

    return events.length >= limit;
  }

  function recordEvent(key) {
    var events = getEvents(key);
    events.push(Date.now());
    try {
      window.localStorage.setItem(key, JSON.stringify(events));
    } catch (error) {}
  }

  function setupInterestForm() {
    document.querySelectorAll('.interest-form').forEach(function (form) {
      var submitBtn = form.querySelector('button[type="submit"]');
      var status = form.querySelector('.form-message');
      var input = form.querySelector('input[type="email"]');

      if (!status) {
        status = document.createElement('p');
        status.className = 'form-message';
        status.setAttribute('role', 'status');
        status.setAttribute('aria-live', 'polite');
        form.appendChild(status);
      }

      var hp = form.querySelector('input[name="company_name"]');
      if (!hp) {
        hp = document.createElement('input');
        hp.type = 'text';
        hp.name = 'company_name';
        hp.className = 'hp-field';
        hp.setAttribute('autocomplete', 'off');
        hp.setAttribute('tabindex', '-1');
        hp.setAttribute('aria-hidden', 'true');
        form.appendChild(hp);
      }

      form.addEventListener('submit', function (event) {
        event.preventDefault();

        if (hp.value.trim()) {
          setFormMessage(status, 'Submission blocked.', 'error');
          return;
        }

        if (!input || !input.value.trim()) return;
        if (isRateLimited('emdp_interest_submit', 3, 24 * 60 * 60 * 1000)) {
          setFormMessage(status, 'Too many submissions. Please try again tomorrow.', 'error');
          return;
        }

        if (submitBtn) submitBtn.disabled = true;
        setFormMessage(status, 'Submitting...', null);

        var formData = new FormData();
        formData.append('_subject', 'EMDP Lab Interest Form');
        formData.append('email', input.value.trim());
        formData.append('source_page', document.body.getAttribute('data-page') || window.location.pathname);
        formData.append('submitted_at', new Date().toISOString());

        fetch('https://formsubmit.co/ajax/hodh123@dgist.ac.kr', {
          method: 'POST',
          body: formData,
          headers: { Accept: 'application/json' }
        })
          .then(function (response) {
            if (!response.ok) throw new Error('Request failed');
            return response.json();
          })
          .then(function () {
            recordEvent('emdp_interest_submit');
            form.reset();
            setFormMessage(status, 'Thanks. Your interest has been delivered.', 'success');
          })
          .catch(function () {
            var subject = encodeURIComponent('Interest in EMDP Lab research');
            var body = encodeURIComponent(
              'Hello Prof. Dong Hae Ho,%0D%0A%0D%0AI am interested in joining EMDP Lab.%0D%0AMy email: ' + input.value.trim()
            );
            window.location.href = 'mailto:hodh123@dgist.ac.kr?subject=' + subject + '&body=' + body;
          })
          .finally(function () {
            if (submitBtn) submitBtn.disabled = false;
          });
      });
    });
  }

  function setupApplicationForm() {
    var form = byId('applicationForm');
    if (!form) return;

    var status = byId('applicationStatus');
    var submitBtn = byId('applicationSubmit');
    var startedField = byId('applicationStartedAt');
    var humanQuestion = byId('humanQuestion');
    var humanCheck = byId('humanCheck');
    var consentCheck = byId('consentCheck');
    var cvFile = byId('cvFile');
    var coverFile = byId('coverFile');
    var uploadEndpoint = (form.getAttribute('data-upload-endpoint') || '').trim();
    var hp = form.querySelector('input[name="_honey"]');
    var startedAt = Date.now();

    if (startedField) startedField.value = String(startedAt);

    var answer = 0;

    function refreshSecurityQuestion() {
      var a = Math.floor(Math.random() * 8) + 3;
      var b = Math.floor(Math.random() * 8) + 4;
      answer = a + b;
      if (humanQuestion) humanQuestion.textContent = 'Security check: ' + a + ' + ' + b + ' = ?';
      if (humanCheck) humanCheck.value = '';
    }

    refreshSecurityQuestion();

    function hasExt(file, list) {
      if (!file || !file.name) return false;
      var name = file.name.toLowerCase();
      return list.some(function (ext) {
        return name.endsWith('.' + ext);
      });
    }

    function isConfiguredEndpoint(url) {
      return (
        !!url &&
        /^https?:\/\//i.test(url) &&
        url.indexOf('REPLACE-WITH-YOUR-UPLOAD-BACKEND') === -1 &&
        url.indexOf('REPLACE-WITH-YOUR-WEB-APP-ID') === -1
      );
    }

    function isAppsScriptEndpoint(url) {
      return /script\.google\.com\/macros\/s\/.+\/exec/i.test(url);
    }

    function fileToBase64(file) {
      return new Promise(function (resolve, reject) {
        var reader = new FileReader();
        reader.onload = function () {
          var result = String(reader.result || '');
          var commaIndex = result.indexOf(',');
          resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result);
        };
        reader.onerror = function () {
          reject(new Error('File read failed'));
        };
        reader.readAsDataURL(file);
      });
    }

    form.addEventListener('submit', function (event) {
      event.preventDefault();

      if (!isConfiguredEndpoint(uploadEndpoint)) {
        setFormMessage(status, 'Upload endpoint is not configured yet. Please contact lab admin.', 'error');
        return;
      }

      if (hp && hp.value.trim()) {
        setFormMessage(status, 'Submission blocked.', 'error');
        return;
      }

      if (Date.now() - startedAt < 8000) {
        setFormMessage(status, 'Please take a little more time before submitting.', 'error');
        return;
      }

      if (!consentCheck || !consentCheck.checked) {
        setFormMessage(status, 'Please confirm the consent checkbox.', 'error');
        return;
      }

      if (!humanCheck || parseInt(humanCheck.value, 10) !== answer) {
        setFormMessage(status, 'Security check answer is incorrect.', 'error');
        return;
      }

      var cv = cvFile && cvFile.files ? cvFile.files[0] : null;
      var cover = coverFile && coverFile.files ? coverFile.files[0] : null;

      if (!cv || !hasExt(cv, ['pdf'])) {
        setFormMessage(status, 'CV must be a PDF file.', 'error');
        return;
      }

      if (!cover || !hasExt(cover, ['pdf', 'doc', 'docx'])) {
        setFormMessage(status, 'Cover letter must be PDF, DOC, or DOCX.', 'error');
        return;
      }

      var maxSizeMb = isAppsScriptEndpoint(uploadEndpoint) ? 7 : 10;
      var maxSize = maxSizeMb * 1024 * 1024;
      if (cv.size > maxSize || cover.size > maxSize) {
        setFormMessage(status, 'Each file must be ' + maxSizeMb + 'MB or smaller.', 'error');
        return;
      }

      if (submitBtn && submitBtn.disabled) return;
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Uploading...';
      }

      setFormMessage(status, 'Uploading files and application data...', null);

      var formData = new FormData(form);
      formData.set('source_page', window.location.href);
      formData.set('submitted_at', new Date().toISOString());

      var submitPromise;

      if (isAppsScriptEndpoint(uploadEndpoint)) {
        var submissionId =
          new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14) + '-' + Math.random().toString(36).slice(2, 8);
        submitPromise = Promise.all([fileToBase64(cv), fileToBase64(cover)]).then(function (encodedFiles) {
          var payload = {
            submission_id: submissionId,
            submitted_at: new Date().toISOString(),
            source_page: window.location.href,
            applicant_name: String(formData.get('applicant_name') || ''),
            applicant_email: String(formData.get('applicant_email') || ''),
            program_track: String(formData.get('program_track') || ''),
            affiliation: String(formData.get('affiliation') || ''),
            research_proposal_note: String(formData.get('research_proposal_note') || ''),
            special_note: String(formData.get('special_note') || ''),
            files: {
              cv: {
                name: cv.name,
                type: cv.type || 'application/pdf',
                base64: encodedFiles[0]
              },
              cover_letter: {
                name: cover.name,
                type: cover.type || 'application/octet-stream',
                base64: encodedFiles[1]
              }
            }
          };

          return fetch(uploadEndpoint, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
            body: JSON.stringify(payload)
          }).then(function () {
            return { queued: true, submission_id: submissionId };
          });
        });
      } else {
        submitPromise = fetch(uploadEndpoint, {
          method: 'POST',
          body: formData
        }).then(function (response) {
          return response
            .json()
            .catch(function () {
              return {};
            })
            .then(function (payload) {
              if (!response.ok || payload.success === false) {
                throw new Error(payload.error || 'Upload failed');
              }
              return payload;
            });
        });
      }

      submitPromise
        .then(function (payload) {
          recordEvent('emdp_apply_submit');
          form.reset();
          refreshSecurityQuestion();
          startedAt = Date.now();
          if (startedField) startedField.value = String(startedAt);

          var submissionId = payload && payload.submission_id ? payload.submission_id : '';
          if (payload && payload.queued) {
            setFormMessage(
              status,
              'Submission request sent. ID: ' +
                submissionId +
                '. You should receive confirmation email shortly. If not, check Apps Script Executions.',
              'success'
            );
            return;
          }
          if (submissionId) {
            setFormMessage(status, 'Application uploaded successfully. Submission ID: ' + submissionId, 'success');
            return;
          }

          setFormMessage(status, 'Application uploaded successfully. Thank you for applying.', 'success');
        })
        .catch(function (error) {
          var message = error && error.message ? error.message : 'Upload failed. Please try again.';
          setFormMessage(status, message, 'error');
        })
        .finally(function () {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Submit Application Package';
          }
        });
    });
  }

  function safeText(value) {
    if (value === null || value === undefined) return '';
    return String(value).trim();
  }

  function escapeHtml(value) {
    return safeText(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function skeletonLine(widthClass) {
    return '<span class="skeleton-line ' + widthClass + '"></span>';
  }

  function publicationSkeletonHtml() {
    return (
      '<li class="publication-item publication-item-skeleton">' +
      '<div class="pub-head">' +
      skeletonLine('w-12') +
      skeletonLine('w-18') +
      '</div>' +
      skeletonLine('w-88') +
      skeletonLine('w-72') +
      skeletonLine('w-64') +
      '</li>'
    );
  }

  function renderPublicationLoading(target, count) {
    target.innerHTML = new Array(count || 4).fill(0).map(publicationSkeletonHtml).join('');
    refreshDynamicEffects();
  }

  function instrumentSkeletonRowHtml() {
    return (
      '<tr class="skeleton-row">' +
      '<td>' + skeletonLine('w-10') + '</td>' +
      '<td>' + skeletonLine('w-70') + '</td>' +
      '<td>' + skeletonLine('w-54') + '</td>' +
      '<td>' + skeletonLine('w-46') + '</td>' +
      '<td>' + skeletonLine('w-62') + '</td>' +
      '</tr>'
    );
  }

  function renderInstrumentLoading(target, count) {
    target.innerHTML = new Array(count || 6).fill(0).map(instrumentSkeletonRowHtml).join('');
  }

  function teamSkeletonCardHtml() {
    return (
      '<article class="team-card team-card-skeleton">' +
      '<div class="team-photo skeleton-block" aria-hidden="true"></div>' +
      '<div class="team-content">' +
      skeletonLine('w-30') +
      skeletonLine('w-56') +
      skeletonLine('w-80') +
      skeletonLine('w-68') +
      '</div>' +
      '</article>'
    );
  }

  function renderTeamLoadingState(targetId, count) {
    var target = byId(targetId);
    if (!target) return;
    target.innerHTML = new Array(count || 3).fill(0).map(teamSkeletonCardHtml).join('');
    refreshDynamicEffects();
  }

  function publicationItemHtml(item) {
    var linkHtml = item.link
      ? '<a class="pub-link" href="' + item.link + '" target="_blank" rel="noopener noreferrer">View publication</a>'
      : '';
    var pagesHtml = item.pages ? '<p class="pub-pages">Pages/Article: ' + item.pages + '</p>' : '';
    return (
      '<li class="publication-item">' +
      '<div class="pub-head"><span class="pub-no">#' + item.number + '</span><span class="pub-year">' + safeText(item.year) + '</span></div>' +
      '<p class="pub-title">' + safeText(item.title) + '</p>' +
      '<p class="pub-authors">' + safeText(item.authors) + '</p>' +
      '<p class="pub-venue">' + safeText(item.venue) + '</p>' +
      pagesHtml +
      linkHtml +
      '</li>'
    );
  }

  function renderPublicationItems(target, items) {
    target.innerHTML = items.map(publicationItemHtml).join('');
    refreshDynamicEffects();
  }

  function renderPublications() {
    var target = byId('publicationsList');
    if (!target) return;

    if (Array.isArray(window.PUBLICATIONS_DATA) && window.PUBLICATIONS_DATA.length > 0) {
      renderPublicationItems(target, window.PUBLICATIONS_DATA);
      return;
    }

    renderPublicationLoading(target, 4);

    fetch('data/publications-data.json')
      .then(function (response) {
        return response.json();
      })
      .then(function (items) {
        renderPublicationItems(target, items);
      })
      .catch(function () {
        target.innerHTML = '<li class="publication-item">Publication data could not be loaded.</li>';
      });
  }

  function setupPublicationsTopButton() {
    var list = byId('publicationsList');
    if (!list) return;

    var section = list.closest('.section') || list.parentElement;
    if (!section || section.getAttribute('data-top-bound') === '1') return;
    section.setAttribute('data-top-bound', '1');

    var wrap = document.createElement('div');
    wrap.className = 'pub-top-wrap';
    wrap.innerHTML = '<button type="button" class="pub-top-btn" aria-label="Go to top of page">Back to Top</button>';
    section.appendChild(wrap);

    var button = wrap.querySelector('.pub-top-btn');
    if (!button) return;

    button.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    function refreshVisibility() {
      var threshold = section.offsetTop + 180;
      var visible = (window.pageYOffset || document.documentElement.scrollTop || 0) > threshold;
      button.classList.toggle('visible', visible);
    }

    window.addEventListener('scroll', refreshVisibility, { passive: true });
    window.addEventListener('resize', refreshVisibility);
    refreshVisibility();
  }

  function renderInstruments() {
    var target = byId('instrumentsTableBody');
    if (!target) return;

    renderInstrumentLoading(target, 6);

    fetch('data/instruments-data.json')
      .then(function (response) {
        return response.json();
      })
      .then(function (items) {
        var rows = items
          .map(function (item) {
            return (
              '<tr>' +
              '<td>' + safeText(item.number) + '</td>' +
              '<td>' + safeText(item.name) + '</td>' +
              '<td>' + safeText(item.manufacturer) + '</td>' +
              '<td>' + safeText(item.model) + '</td>' +
              '<td>' + safeText(item.spec) + '</td>' +
              '</tr>'
            );
          })
          .join('');
        target.innerHTML = rows;
      })
      .catch(function () {
        target.innerHTML = '<tr><td colspan="5">Instrument list could not be loaded.</td></tr>';
      });
  }

  function teamMemberCardHtml(item) {
    var photo = escapeHtml(item.photo || '');
    var alt = escapeHtml(item.alt || item.name || 'Team member');
    return (
      '<article class="team-card">' +
      (photo ? '<img class="team-photo" src="' + photo + '" alt="' + alt + '">' : '') +
      '<div class="team-content">' +
      '<p class="kicker">' + escapeHtml(item.role) + '</p>' +
      '<h3>' + escapeHtml(item.name) + '</h3>' +
      '<p><strong>' + escapeHtml(item.education) + '</strong></p>' +
      '<p>' + escapeHtml(item.description) + '</p>' +
      '</div>' +
      '</article>'
    );
  }

  function teamHistoryCardHtml(item, label) {
    return (
      '<article class="team-card team-card-intern">' +
      '<div class="team-content">' +
      '<p class="kicker">' + escapeHtml(label) + '</p>' +
      '<h3>' + escapeHtml(item.name) + '</h3>' +
      '<p><strong>' + escapeHtml(item.period) + '</strong></p>' +
      '<p>' + escapeHtml(item.topic) + '</p>' +
      '</div>' +
      '</article>'
    );
  }

  function renderTeamSection(targetId, items, renderer, emptyMessage) {
    var target = byId(targetId);
    if (!target) return;
    if (!Array.isArray(items) || items.length === 0) {
      target.innerHTML =
        '<article class="team-card team-card-intern"><div class="team-content"><p>' +
        escapeHtml(emptyMessage) +
        '</p></div></article>';
      refreshDynamicEffects();
      return;
    }
    target.innerHTML = items.map(renderer).join('');
    refreshDynamicEffects();
  }

  function renderTeamSections() {
    var hasTeamPageTargets =
      byId('teamPhdList') || byId('teamCombinedList') || byId('teamMscList') || byId('internshipList') || byId('alumniList');
    if (!hasTeamPageTargets) return;

    renderTeamLoadingState('teamPhdList', 1);
    renderTeamLoadingState('teamCombinedList', 2);
    renderTeamLoadingState('teamMscList', 1);
    renderTeamLoadingState('internshipList', 2);
    renderTeamLoadingState('alumniList', 2);

    fetch('data/team-data.json')
      .then(function (response) {
        return response.json();
      })
      .then(function (data) {
        renderTeamSection('teamPhdList', data.phd_course, teamMemberCardHtml, 'No PhD members listed yet.');
        renderTeamSection('teamCombinedList', data.combined_course, teamMemberCardHtml, 'No combined-course members listed yet.');
        renderTeamSection('teamMscList', data.msc_course, teamMemberCardHtml, 'No MSC members listed yet.');
        renderTeamSection(
          'internshipList',
          data.internship,
          function (item) {
            return teamHistoryCardHtml(item, 'Internship');
          },
          'No active internship members listed right now.'
        );
        renderTeamSection(
          'alumniList',
          data.alumni,
          function (item) {
            return teamHistoryCardHtml(item, 'Alumni');
          },
          'No alumni listed yet.'
        );
      })
      .catch(function () {
        renderTeamSection('teamPhdList', [], teamMemberCardHtml, 'Team data could not be loaded.');
        renderTeamSection('teamCombinedList', [], teamMemberCardHtml, 'Team data could not be loaded.');
        renderTeamSection('teamMscList', [], teamMemberCardHtml, 'Team data could not be loaded.');
        renderTeamSection('internshipList', [], teamHistoryCardHtml, 'Team data could not be loaded.');
        renderTeamSection('alumniList', [], teamHistoryCardHtml, 'Team data could not be loaded.');
      });
  }

  runSafely(setupPerformanceMode);
  runSafely(setupThemeSelector);
  runSafely(setupDeviceMode);
  runSafely(setupPageChoreography);
  runSafely(setActiveNav);
  runSafely(setupMenuToggle);
  runSafely(setupNavGlass);
  runSafely(setupInterestForm);
  runSafely(setupApplicationForm);
  runSafely(renderPublications);
  runSafely(setupPublicationsTopButton);
  runSafely(renderInstruments);
  runSafely(renderTeamSections);
  runSafely(setupScrollProgress);
  runSafely(setupScrollReveal);
  runSafely(setupCardTilt);
  runSafely(setupLiquidGlass);
  window.addEventListener('resize', function () {
    runSafely(setupCardTilt);
    runSafely(setupLiquidGlass);
    runSafely(syncThemeSwitchThumbs);
  });
  window.addEventListener('orientationchange', function () {
    runSafely(setupCardTilt);
    runSafely(setupLiquidGlass);
    runSafely(syncThemeSwitchThumbs);
  });
})();
