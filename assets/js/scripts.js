(function () {
  'use strict';

  function byId(id) {
    return document.getElementById(id);
  }

  function reportError(name, error) {
    console.error('[EMDP]', name, error);
  }

  function setActiveNavigation() {
    var page = document.body.getAttribute('data-page');
    if (!page) return;
    document.querySelectorAll('.nav-link').forEach(function (link) {
      var active = link.getAttribute('data-nav') === page;
      link.classList.toggle('active', active);
      if (active) link.setAttribute('aria-current', 'page');
    });
  }

  function setupNavigation() {
    var toggle = byId('menuToggle');
    var navigation = byId('siteNav');
    if (!toggle || !navigation) return;

    function setOpen(open) {
      var korean = document.documentElement.lang === 'ko';
      navigation.classList.toggle('open', open);
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      toggle.textContent = open ? (korean ? '닫기' : 'Close') : (korean ? '메뉴' : 'Menu');
    }

    toggle.addEventListener('click', function () {
      setOpen(!navigation.classList.contains('open'));
    });
    navigation.addEventListener('click', function (event) {
      if (event.target.closest('a')) setOpen(false);
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') setOpen(false);
    });
    window.addEventListener('resize', function () {
      if (window.matchMedia('(min-width: 961px)').matches) setOpen(false);
    });
  }

  function setupDeviceMode() {
    var media = window.matchMedia('(max-width: 860px)');
    function apply() {
      document.body.setAttribute('data-device', media.matches ? 'mobile' : 'desktop');
    }
    apply();
    if (typeof media.addEventListener === 'function') media.addEventListener('change', apply);
  }

  function prefersReducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function setupReveal() {
    var targets = document.querySelectorAll(
      '.hero, .section, .contact, .ref-hero, .ref-section, .ref-board, .ref-contact, .team-card, .publication-item'
    );
    if (!targets.length) return;

    if (prefersReducedMotion() || !('IntersectionObserver' in window)) {
      targets.forEach(function (target) {
        target.classList.add('revealed');
      });
      return;
    }

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('revealed');
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.08, rootMargin: '0px 0px -5% 0px' }
    );

    targets.forEach(function (target, index) {
      target.classList.add('reveal-ready');
      target.style.setProperty('--reveal-delay', String(Math.min(index % 5, 4) * 35) + 'ms');
      observer.observe(target);
    });
  }

  function readEvents(key) {
    try {
      var values = JSON.parse(localStorage.getItem(key) || '[]');
      return Array.isArray(values) ? values : [];
    } catch (error) {
      return [];
    }
  }

  function isRateLimited(key, limit) {
    var cutoff = Date.now() - 24 * 60 * 60 * 1000;
    return readEvents(key).filter(function (time) { return time > cutoff; }).length >= limit;
  }

  function recordEvent(key) {
    try {
      localStorage.setItem(key, JSON.stringify(readEvents(key).concat(Date.now())));
    } catch (error) {}
  }

  function setFormMessage(target, text, kind) {
    if (!target) return;
    target.textContent = text || '';
    target.classList.remove('success', 'error', 'pending');
    if (kind) target.classList.add(kind);
  }

  function setupInterestForms() {
    document.querySelectorAll('.interest-form').forEach(function (form) {
      if (form.getAttribute('data-interest-bound') === 'true') return;
      form.setAttribute('data-interest-bound', 'true');

      var button = form.querySelector('button[type="submit"]');
      var input = form.querySelector('input[type="email"]');
      var status = form.querySelector('.form-message');
      if (!status) {
        status = document.createElement('p');
        status.className = 'form-message';
        status.setAttribute('role', 'status');
        status.setAttribute('aria-live', 'polite');
        form.appendChild(status);
      }

      var honeypot = document.createElement('input');
      honeypot.type = 'text';
      honeypot.name = 'company_name';
      honeypot.className = 'hp-field';
      honeypot.tabIndex = -1;
      honeypot.setAttribute('aria-hidden', 'true');
      honeypot.setAttribute('autocomplete', 'off');
      form.appendChild(honeypot);

      form.addEventListener('submit', function (event) {
        event.preventDefault();
        if (!input || !input.value.trim() || honeypot.value.trim()) return;
        if (isRateLimited('emdp_interest_submit_v2', 3)) {
          setFormMessage(status, 'Too many submissions today. Please email the lab directly.', 'error');
          return;
        }

        button.disabled = true;
        setFormMessage(status, 'Sending...', 'pending');
        var formData = new FormData();
        formData.append('_subject', 'EMDP Lab Interest Form');
        formData.append('email', input.value.trim());
        formData.append('source_page', document.body.getAttribute('data-page') || location.pathname);

        fetch('https://formsubmit.co/ajax/hodh123@dgist.ac.kr', {
          method: 'POST',
          body: formData,
          headers: { Accept: 'application/json' }
        })
          .then(function (response) {
            if (!response.ok) throw new Error('Interest form request failed');
            recordEvent('emdp_interest_submit_v2');
            form.reset();
            setFormMessage(status, 'Thanks. Your message has been delivered.', 'success');
          })
          .catch(function () {
            setFormMessage(status, 'The form is unavailable. Please email hodh123@dgist.ac.kr.', 'error');
          })
          .finally(function () {
            button.disabled = false;
          });
      });
    });
  }

  function setupPublicationArchive() {
    var list = byId('publicationsList');
    if (!list) return;

    list.querySelectorAll('.pub-year-group').forEach(function (group) {
      group.addEventListener('toggle', function () {
        if (!group.open) return;
        list.querySelectorAll('.pub-year-group').forEach(function (other) {
          if (other !== group) other.open = false;
        });
      });
    });

    var section = list.closest('.section');
    if (!section) return;
    var wrap = document.createElement('div');
    wrap.className = 'pub-top-wrap';
    wrap.innerHTML = '<button type="button" class="pub-top-btn" aria-label="Go to top of page">Back to Top</button>';
    section.appendChild(wrap);
    var button = wrap.querySelector('button');
    button.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    });

    function update() {
      button.classList.toggle('visible', window.scrollY > section.offsetTop + 180);
    }
    window.addEventListener('scroll', update, { passive: true });
    update();
  }

  function initialize() {
    document.documentElement.classList.add('js');
    [
      ['active navigation', setActiveNavigation],
      ['navigation', setupNavigation],
      ['device mode', setupDeviceMode],
      ['interest forms', setupInterestForms],
      ['publication archive', setupPublicationArchive],
      ['reveal', setupReveal]
    ].forEach(function (entry) {
      try {
        entry[1]();
      } catch (error) {
        reportError(entry[0], error);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize, { once: true });
  } else {
    initialize();
  }
})();
