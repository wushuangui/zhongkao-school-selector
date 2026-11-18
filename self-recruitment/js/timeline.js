(function () {
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const TIMELINE_BY_YEAR = {};
  if (window.TIMELINE_DATA_2027 && window.TIMELINE_DATA_2027.year) {
    TIMELINE_BY_YEAR[window.TIMELINE_DATA_2027.year] = window.TIMELINE_DATA_2027;
  }
  if (window.TIMELINE_DATA && window.TIMELINE_DATA.year) {
    TIMELINE_BY_YEAR[window.TIMELINE_DATA.year] = window.TIMELINE_DATA;
  }

  const PREFERRED_YEAR = TIMELINE_BY_YEAR[2027] ? 2027 : (TIMELINE_BY_YEAR[2026] ? 2026 : null);
  let activeYear = PREFERRED_YEAR;

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

  function rangeText(node, bundleYear) {
    const useRef = node.verifyStatus === 'pending' || (!node.start && node.reference2026);
    if (useRef && node.reference2026) {
      const suffix = node.verifyStatus === 'pending' ? ' · 需核实' : '';
      return '参考 2026 年为 ' + node.reference2026 + suffix;
    }
    if (!node.start) {
      return bundleYear === 2027 ? '待发布' : '见当年招考公告';
    }
    if (!node.end || node.end === node.start) return fmt(node.start);
    return fmt(node.start) + '—' + fmt(node.end);
  }

  function phase(node, today) {
    const start = day(node.start);
    const end = day(node.end || node.start);
    if (!start || !end) return node.verifyStatus === 'pending' ? 'future' : 'open';
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

  function sourceLink(node) {
    const src = node.source;
    if (!src || !src.url) return '';
    const title = src.title || '官方来源';
    return '<a href="' + esc(src.url) + '" target="_blank" rel="noopener noreferrer">' + esc(title) + '</a>';
  }

  function yearSwitchHtml() {
    const years = Object.keys(TIMELINE_BY_YEAR).map(Number).sort((a, b) => b - a);
    if (years.length < 2) return '';
    return '<div class="tl-year-switch" role="tablist" aria-label="年度时间轴">' +
      years.map(y => {
        const on = y === activeYear;
        return '<button type="button" class="tl-year-btn' + (on ? ' active' : '') + '" data-tl-year="' + y + '" role="tab" aria-selected="' + on + '">' +
          esc(y + ' 届') + '</button>';
      }).join('') +
      '</div>';
  }

  function renderTimeline() {
    const box = document.getElementById('timeline');
    if (!box) return;
    const data = activeYear != null ? TIMELINE_BY_YEAR[activeYear] : null;
    if (!data || !data.nodes) {
      box.innerHTML = '';
      return;
    }
    const today = new Date();
    const bundleYear = data.year;
    const items = data.nodes.map(node => {
      const kind = phase(node, today);
      const guide = node.guide ? '<a href="#' + esc(node.guide) + '" data-guide-jump="' + esc(node.guide) + '">对应路径</a>' : '';
      const nvs = node.verifyStatus && VERIFY_LABEL[node.verifyStatus]
        ? ' <span class="tag verify">' + esc(VERIFY_LABEL[node.verifyStatus]) + '</span>' : '';
      const src = sourceLink(node);
      return '<li class="tl-item tl-' + kind + '">' +
        '<div class="tl-top"><span class="name">' + esc(node.title) + '</span>' +
        nvs +
        '<span class="basis raw">' + esc(PHASE_LABEL[kind]) + '</span></div>' +
        '<p class="tl-when">' + esc(rangeText(node, bundleYear)) + '</p>' +
        '<p class="detail">' + esc(node.note || '') + '</p>' +
        (src ? '<p class="tl-source">' + src + '</p>' : '') +
        (guide ? '<div class="img-links">' + guide + '</div>' : '') +
        '</li>';
    }).join('');
    const vs = data.verifyStatus && VERIFY_LABEL[data.verifyStatus]
      ? ' <span class="tag verify">' + esc(VERIFY_LABEL[data.verifyStatus]) + '</span>' : '';
    const un = data.sourceType === 'unofficial' ? ' <span class="tag unofficial">非官方</span>' : '';
    box.innerHTML =
      yearSwitchHtml() +
      '<h3 class="name" id="timeline-title">' + esc(data.title || '关键节点') + vs + un + '</h3>' +
      '<p class="note">' + esc(data.disclaimer || '以教育局最新通知为准。') + '</p>' +
      '<ol class="timeline">' + items + '</ol>';
  }

  window.renderTimeline = renderTimeline;

  document.getElementById('view-guide')?.addEventListener('click', (e) => {
    const yearBtn = e.target.closest('[data-tl-year]');
    if (yearBtn) {
      const y = Number(yearBtn.getAttribute('data-tl-year'));
      if (TIMELINE_BY_YEAR[y]) {
        activeYear = y;
        renderTimeline();
      }
      return;
    }
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