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
    var nextField = byId('applicationNext');
    var applicantEmail = byId('applicantEmail');
    var humanQuestion = byId('humanQuestion');
    var humanCheck = byId('humanCheck');
    var consentCheck = byId('consentCheck');
    var cvFile = byId('cvFile');
    var coverFile = byId('coverFile');
    var hp = form.querySelector('input[name="_honey"]');
    var startedAt = Date.now();

    if (startedField) startedField.value = String(startedAt);
    if (nextField) nextField.value = window.location.origin + window.location.pathname + '?submitted=1';

    var query = new URLSearchParams(window.location.search);
    if (query.get('submitted') === '1') {
      setFormMessage(status, 'Application sent successfully. Thank you for applying.', 'success');
    }

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

    form.addEventListener('submit', function (event) {
      if (hp && hp.value.trim()) {
        event.preventDefault();
        setFormMessage(status, 'Submission blocked.', 'error');
        return;
      }

      if (Date.now() - startedAt < 8000) {
        event.preventDefault();
        setFormMessage(status, 'Please take a little more time before submitting.', 'error');
        return;
      }

      if (isRateLimited('emdp_apply_submit', 2, 24 * 60 * 60 * 1000)) {
        event.preventDefault();
        setFormMessage(status, 'Submission limit reached. Please try again later.', 'error');
        return;
      }

      if (!consentCheck || !consentCheck.checked) {
        event.preventDefault();
        setFormMessage(status, 'Please confirm the consent checkbox.', 'error');
        return;
      }

      if (!humanCheck || parseInt(humanCheck.value, 10) !== answer) {
        event.preventDefault();
        setFormMessage(status, 'Security check answer is incorrect.', 'error');
        return;
      }

      var cv = cvFile && cvFile.files ? cvFile.files[0] : null;
      var cover = coverFile && coverFile.files ? coverFile.files[0] : null;

      if (!cv || !hasExt(cv, ['pdf'])) {
        event.preventDefault();
        setFormMessage(status, 'CV must be a PDF file.', 'error');
        return;
      }

      if (!cover || !hasExt(cover, ['pdf', 'doc', 'docx'])) {
        event.preventDefault();
        setFormMessage(status, 'Cover letter must be PDF, DOC, or DOCX.', 'error');
        return;
      }

      var maxSize = 10 * 1024 * 1024;
      if (cv.size > maxSize || cover.size > maxSize) {
        event.preventDefault();
        setFormMessage(status, 'Each file must be 10MB or smaller.', 'error');
        return;
      }

      if (submitBtn && submitBtn.disabled) return;
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Submitting...';
      }
      var emailValue = applicantEmail ? applicantEmail.value.trim() : '';
      if (emailValue) {
        var replyTo = form.querySelector('input[name="_replyto"]');
        if (!replyTo) {
          replyTo = document.createElement('input');
          replyTo.type = 'hidden';
          replyTo.name = '_replyto';
          form.appendChild(replyTo);
        }
        replyTo.value = emailValue;
      }

      var submittedAt = form.querySelector('input[name="submitted_at"]');
      if (!submittedAt) {
        submittedAt = document.createElement('input');
        submittedAt.type = 'hidden';
        submittedAt.name = 'submitted_at';
        form.appendChild(submittedAt);
      }
      submittedAt.value = new Date().toISOString();

      setFormMessage(status, 'Opening FormSubmit confirmation in a new tab...', null);
      recordEvent('emdp_apply_submit');

      window.setTimeout(function () {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Submit Application Package';
        }
      }, 4000);
    });
  }

  function safeText(value) {
    if (value === null || value === undefined) return '';
    return String(value).trim();
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
  }

  function renderPublications() {
    var target = byId('publicationsList');
    if (!target) return;

    if (Array.isArray(window.PUBLICATIONS_DATA) && window.PUBLICATIONS_DATA.length > 0) {
      renderPublicationItems(target, window.PUBLICATIONS_DATA);
      return;
    }

    fetch('publications-data.json')
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

    fetch('instruments-data.json')
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

  function renderAlumni() {
    var target = byId('alumniList');
    if (!target) return;

    fetch('alumni-data.json')
      .then(function (response) {
        return response.json();
      })
      .then(function (items) {
        target.innerHTML = items
          .map(function (item) {
            return (
              '<article class="card">' +
              '<h3>' + safeText(item.name) + '</h3>' +
              '<p><strong>' + safeText(item.period) + '</strong></p>' +
              '<p>' + safeText(item.topic) + '</p>' +
              '</article>'
            );
          })
          .join('');
      })
      .catch(function () {
        target.innerHTML = '<article class="card"><p>Alumni data could not be loaded.</p></article>';
      });
  }

  setupDeviceMode();
  setActiveNav();
  setupMenuToggle();
  setupNavGlass();
  setupInterestForm();
  setupApplicationForm();
  renderPublications();
  renderInstruments();
  renderAlumni();
})();
