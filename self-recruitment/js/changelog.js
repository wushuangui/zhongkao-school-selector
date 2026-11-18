(function () {
  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  function renderChangelog() {
    const box = document.getElementById('changelog');
    if (!box) return;
    const data = window.CHANGELOG_DATA;
    if (!data || !data.releasedAt) {
      box.innerHTML = '';
      return;
    }
    const entries = Array.isArray(data.entries) ? data.entries : [];
    const items = entries.map(entry =>
      '<li><b>' + escapeHtml(entry.kind) + '</b> ' + escapeHtml(entry.text) + '</li>'
    ).join('');
    box.innerHTML =
      '<details>' +
      '<summary>更新公告 · ' + escapeHtml(data.releasedAt) + '</summary>' +
      '<ul>' + items + '</ul>' +
      '<p>' + escapeHtml(data.howToUpdate || '') + '</p>' +
      '</details>';
  }

  renderChangelog();
})();
