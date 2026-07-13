(function () {
  var STORAGE_KEY = 'emdp_lang';
  var currentLanguage = 'ko', catalog = {}, reverseCatalog = {}, observer;

  function readCatalog() {
    var node = document.getElementById('i18nCatalog');
    if (!node) return {};
    try {
      return JSON.parse(node.textContent || '{}');
    } catch {
      return {};
    }
  }

  function preferredLanguage() {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'en' ? 'en' : 'ko';
    } catch {
      return 'ko';
    }
  }

  function translatedValue(value, language) {
    var lookup = language === 'ko' ? catalog : reverseCatalog;
    return lookup[value] || value;
  }

  function translateTextNode(node, language) {
    var parent = node.parentElement;
    if (!parent || parent.closest('script, style, code, [data-language-toggle]')) return;
    var value = node.nodeValue || '';
    var trimmed = value.trim();
    if (!trimmed) return;
    var translated = translatedValue(trimmed, language);
    if (translated === trimmed) return;
    node.nodeValue = value.replace(trimmed, translated);
  }

  function translateAttributes(element, language) {
    if (element.closest('[data-language-toggle]')) return;
    ['alt', 'aria-label', 'placeholder', 'title', 'content'].forEach(function (name) {
      if (!element.hasAttribute(name)) return;
      var value = element.getAttribute(name);
      var translated = translatedValue(value, language);
      if (translated !== value) element.setAttribute(name, translated);
    });
  }

  function translateElement(element, language) {
    if (element.closest('[data-language-toggle]')) return;
    translateAttributes(element, language);
    element.querySelectorAll('*').forEach(function (child) {
      translateAttributes(child, language);
    });

    var walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    var nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(function (node) { translateTextNode(node, language); });
  }

  function updateToggle(language) {
    var toggle = document.getElementById('languageToggle');
    var toEnglish = language === 'ko';
    toggle.textContent = toEnglish ? 'EN' : '한글';
    toggle.setAttribute('aria-label', toEnglish ? '영어로 전환' : 'Switch to Korean');
  }

  function applyLanguage(language, persist) {
    currentLanguage = language === 'en' ? 'en' : 'ko';
    if (observer) observer.disconnect();
    translateElement(document.documentElement, currentLanguage);
    document.documentElement.lang = currentLanguage;
    updateToggle(currentLanguage);
    if (persist) {
      try { localStorage.setItem(STORAGE_KEY, currentLanguage); } catch {}
    }
    if (observer) observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    document.dispatchEvent(new CustomEvent('emdp-languagechange', { detail: { language: currentLanguage } }));
  }

  function initialize() {
    catalog = readCatalog();
    reverseCatalog = Object.keys(catalog).reduce(function (result, english) {
      result[catalog[english]] = english;
      return result;
    }, {});

    observer = new MutationObserver(function (mutations) {
      mutations.forEach(function (mutation) {
        if (mutation.type === 'characterData') {
          translateTextNode(mutation.target, currentLanguage);
          return;
        }
        mutation.addedNodes.forEach(function (node) {
          if (node.nodeType === Node.TEXT_NODE) translateTextNode(node, currentLanguage);
          if (node.nodeType === Node.ELEMENT_NODE) translateElement(node, currentLanguage);
        });
      });
    });

    var toggle = document.getElementById('languageToggle');
    if (toggle) {
      toggle.addEventListener('click', function () {
        applyLanguage(currentLanguage === 'ko' ? 'en' : 'ko', true);
      });
    }
    applyLanguage(preferredLanguage(), false);
  }

  window.EMDP_I18N = {
    language: function () { return currentLanguage; },
    translate: function (value) { return translatedValue(value, currentLanguage); }
  };

  document.addEventListener('DOMContentLoaded', initialize, { once: true });
})();
