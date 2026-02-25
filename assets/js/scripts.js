(function () {
  function byId(id) {
    return document.getElementById(id);
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

  function refreshDynamicEffects() {
    refreshRevealTargets();
    setupCardTilt();
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

  function renderInstruments() {
    var target = byId('instrumentsTableBody');
    if (!target) return;

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
      return;
    }
    target.innerHTML = items.map(renderer).join('');
    refreshDynamicEffects();
  }

  function renderTeamSections() {
    var hasTeamPageTargets =
      byId('teamPhdList') || byId('teamCombinedList') || byId('teamMscList') || byId('internshipList') || byId('alumniList');
    if (!hasTeamPageTargets) return;

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

  setupDeviceMode();
  setActiveNav();
  setupMenuToggle();
  setupNavGlass();
  setupScrollProgress();
  setupScrollReveal();
  setupCardTilt();
  window.addEventListener('resize', setupCardTilt);
  window.addEventListener('orientationchange', setupCardTilt);
  setupInterestForm();
  setupApplicationForm();
  renderPublications();
  renderInstruments();
  renderTeamSections();
})();
