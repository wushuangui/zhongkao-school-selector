(function () {
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function day(iso) {
    if (!iso) return null;
    const p = iso.split('-');
    if (p.length < 3) return null;
    return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  }

  function fmt(iso) {
    const d = day(iso);
    if (!d) return '';
    return (d.getMonth() + 1) + '月' + d.getDate() + '日';
  }

  function rangeText(node) {
    if (!node.start) return '见当年招考公告';
    if (!node.end || node.end === node.start) return fmt(node.start);
    return fmt(node.start) + '—' + fmt(node.end);
  }

  function phase(node, today) {
    const start = day(node.start);
    const end = day(node.end || node.start);
    if (!start || !end) return 'open';
    const t = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    if (t > end.getTime()) return 'past';
    if (t < start.getTime()) return 'future';
    return 'now';
  }

  const PHASE_LABEL = { past: '已结束', now: '进行中', future: '未开始', open: '见公告' };
  const VERIFY_LABEL = {
    'verified-history': '历史已核实',
    'reference-2026': '2026 参考',
    'verified-2027': '2027 已核实',
    pending: '待发布',
  };

  function renderTimeline() {
    const box = document.getElementById('timeline');
    if (!box) return;
    const data = window.TIMELINE_DATA;
    if (!data || !data.nodes) {
      box.innerHTML = '';
      return;
    }
    const today = new Date();
    const items = data.nodes.map(node => {
      const kind = phase(node, today);
      const guide = node.guide ? '<a href="#' + esc(node.guide) + '" data-guide-jump="' + esc(node.guide) + '">对应路径</a>' : '';
      return '<li class="tl-item tl-' + kind + '">' +
        '<div class="tl-top"><span class="name">' + esc(node.title) + '</span>' +
        '<span class="basis raw">' + PHASE_LABEL[kind] + '</span></div>' +
        '<p class="tl-when">' + esc(rangeText(node)) + '</p>' +
        '<p class="detail">' + esc(node.note || '') + '</p>' +
        (guide ? '<div class="img-links">' + guide + '</div>' : '') +
        '</li>';
    }).join('');
    const vs = data.verifyStatus && VERIFY_LABEL[data.verifyStatus]
      ? ' <span class="tag verify">' + esc(VERIFY_LABEL[data.verifyStatus]) + '</span>' : '';
    const un = data.sourceType === 'unofficial' ? ' <span class="tag unofficial">非官方</span>' : '';
    box.innerHTML =
      '<h3 class="name" id="timeline-title">' + esc(data.title || '关键节点') + vs + un + '</h3>' +
      '<p class="note">' + esc(data.disclaimer || '以教育局最新通知为准。') + '</p>' +
      '<ol class="timeline">' + items + '</ol>';
  }

  window.renderTimeline = renderTimeline;

  document.getElementById('view-guide')?.addEventListener('click', (e) => {
    const jump = e.target.closest('[data-guide-jump]');
    if (!jump) return;
    const target = document.getElementById(jump.getAttribute('data-guide-jump'));
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ block: 'nearest' });
    }
  });

  renderTimeline();
})();
