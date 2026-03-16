(function () {
  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatNumber(value) {
    if (value >= 1000) {
      return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value);
    }
    if (value >= 10) {
      return new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(value);
    }
    if (value >= 1) {
      return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value);
    }
    if (value === 0) {
      return '0';
    }
    return value.toExponential(2).replace('e', ' × 10^');
  }

  function renderPropertyExplorer() {
    var data = window.STUDY_DATA;
    var root = document.querySelector('[data-study-dashboard]');
    if (!root || !data || !Array.isArray(data.properties) || !Array.isArray(data.materials)) return;

    var buttonWrap = root.querySelector('[data-property-buttons]');
    var detail = root.querySelector('[data-property-detail]');
    if (!buttonWrap || !detail) return;

    var currentPropertyId = data.properties[0].id;

    function propertyById(id) {
      return data.properties.find(function (property) {
        return property.id === id;
      });
    }

    function labelForValue(property, materialId) {
      if (property.displayValues && property.displayValues[materialId]) {
        return property.displayValues[materialId];
      }
      return formatNumber(property.values[materialId]);
    }

    function barRowsHtml(property) {
      var maxValue = Math.max.apply(
        null,
        data.materials.map(function (material) {
          return property.values[material.id];
        })
      );

      return data.materials
        .map(function (material) {
          var value = property.values[material.id];
          var width = maxValue > 0 ? Math.max((value / maxValue) * 100, value > 0 ? 3.5 : 0) : 0;
          return (
            '<div class="study-chart-row">' +
            '<div class="study-chart-material"><span class="study-swatch" style="--swatch:' +
            escapeHtml(material.color) +
            ';"></span><div><strong>' +
            escapeHtml(material.label) +
            '</strong><span>' +
            escapeHtml(material.note) +
            '</span></div></div>' +
            '<div class="study-chart-track"><span class="study-chart-bar" style="width:' +
            width.toFixed(2) +
            '%; --bar-color:' +
            escapeHtml(material.color) +
            ';"></span></div>' +
            '<div class="study-chart-value">' +
            escapeHtml(labelForValue(property, material.id)) +
            '<span>' +
            escapeHtml(property.unit) +
            '</span></div>' +
            '</div>'
          );
        })
        .join('');
    }

    function updateDetail(property) {
      detail.innerHTML =
        '<div class="study-detail-head">' +
        '<p class="kicker">Property Explorer</p>' +
        '<h2 class="section-title">' +
        escapeHtml(property.label) +
        '</h2>' +
        '<div class="study-meta-row"><span class="study-pill">' +
        escapeHtml(property.category) +
        '</span><span class="study-pill study-pill-muted">' +
        escapeHtml(property.source) +
        '</span></div>' +
        '</div>' +
        '<p class="page-intro">' +
        escapeHtml(property.comparisonNote) +
        '</p>' +
        '<div class="study-chart-card">' +
        barRowsHtml(property) +
        '</div>' +
        '<div class="study-property-note">' +
        '<h3>Why it matters</h3>' +
        '<p>' +
        escapeHtml(property.implication) +
        '</p>' +
        '</div>';
    }

    function renderButtons() {
      buttonWrap.innerHTML = data.properties
        .map(function (property) {
          var active = property.id === currentPropertyId ? ' is-active' : '';
          return (
            '<button class="study-property-tab' +
            active +
            '" type="button" data-property-id="' +
            escapeHtml(property.id) +
            '">' +
            escapeHtml(property.label) +
            '</button>'
          );
        })
        .join('');
    }

    buttonWrap.addEventListener('click', function (event) {
      var button = event.target.closest('[data-property-id]');
      if (!button) return;
      currentPropertyId = button.getAttribute('data-property-id');
      renderButtons();
      updateDetail(propertyById(currentPropertyId));
    });

    renderButtons();
    updateDetail(propertyById(currentPropertyId));
  }

  renderPropertyExplorer();
})();
