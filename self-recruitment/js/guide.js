(function () {
  const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const pathTpl = (title, bodyHtml, myth, rulesHint, linksHtml) =>
    '<section class="guide-path">' +
    '<h3>' + esc(title) + '</h3>' +
  bodyHtml +
  '<p class="guide-myth"><strong>常见误区</strong>' + esc(myth) + '</p>' +
  '<p class="guide-actions">' +
  '<button type="button" class="guide-rules-btn" data-open-rules="1">打开规则说明（' + esc(rulesHint) + '）→</button>' +
  (linksHtml ? '<span class="guide-links">' + linksHtml + '</span>' : '') +
  '</p></section>';

  const extLink = (href, label) =>
    '<a href="' + esc(href) + '" target="_blank" rel="noopener">' + esc(label) + '</a>';

  function renderGuide() {
    const box = document.getElementById('guideBody');
    if (!box) return;
    const ZZZS = window.ZZZS_DATA;
    const SCORES = window.SCORES_DATA;
    const src = ZZZS && ZZZS.source;
    const sources = SCORES && SCORES.sources;

    let selfRegLinks = '';
    if (src && src.url) {
      selfRegLinks = extLink(src.url, '教育局自招通知');
      if (src.attachments && src.attachments[0]) {
        selfRegLinks += ' · ' + extLink(src.attachments[0].url, '公办自招计划附件');
      }
    }

    const batchLinks = [];
    if (sources) {
      if (sources.batch1) batchLinks.push(extLink(sources.batch1.url, '第一批分数线公告'));
      if (sources.mee) batchLinks.push(extLink(sources.mee.url, '名额分配报考手册'));
    }

    const makeupLinks = [];
    if (sources) {
      if (sources.batch2) makeupLinks.push(extLink(sources.batch2.url, '第二批分数线'));
      if (sources.second) {
        makeupLinks.push(extLink(sources.second.url, '二次划线公告'));
        if (sources.second.planUrl) makeupLinks.push(extLink(sources.second.planUrl, '补录招生计划'));
      }
      if (sources.batch3) makeupLinks.push(extLink(sources.batch3.url, '第三批查询指引'));
    }

    const intro =
      '<p class="guide-intro">帮助理清深圳中考<strong>统招、自招、名额分配、补录</strong>先后关系。本站「录取分数线」Tab 可查各校分数，本页侧重<strong>路径</strong>，名词与顶部「规则说明」一致。</p>' +
      '<p class="guide-disclaimer">以深圳市教育局、深圳招考网最新文件为准；下列内容不构成录取承诺。</p>';

    const p1 = pathTpl(
      '统招批次结构',
      '<p>录取按当年招考文件分阶段进行，常见顺序为：<strong>自主招生</strong>单独投档 → <strong>名额分配</strong> → <strong>第一批</strong>（普通高中统招及少量中职试点专业）→ <strong>第二批</strong>（本市中职、技工，除第一批试点外）→ <strong>二次划线</strong>（补录相关）→ <strong>第三批</strong>（部省属及跨市中职，由省考试院组织）。自招录取后不再参与后续批次，详见规则「录取后」条款。</p>',
      '把「第一批录取分数线」当成所有志愿、所有批次的唯一参考，忽视名额分配资格线与补录批次。',
      '录取分数线（非自招）',
      batchLinks.join(' · ')
    );

    const p2 = pathTpl(
      '自招报名渠道（一类平台 / 二类现场）',
      '<p><strong>一类自主招生</strong>（理工科技、人文社科）：公办与民办均在「深圳市普通高中学校自主招生管理平台」<strong>网上报名</strong>。<strong>二类自主招生</strong>（体育、艺术）：<strong>公办学校须到招生学校现场报名</strong>，按各校工作方案执行；报名时间、审核节点以当年通知为准。</p>',
      '同时报名多所学校的自招项目，或一类、二类兼报——政策要求只能报 1 所学校的 1 个项目。',
      '报名规则',
      selfRegLinks
    );

    const meeLink = sources && sources.mee ? extLink(sources.mee.url, '名额分配指导手册 PDF') : '';
    const p3 = pathTpl(
      '名额分配资格线含义',
      '<p><strong>名额分配控制线</strong>是填报名额分配志愿、参与该批次投档的<strong>最低资格线</strong>，按前三年同类录取线均值降 20 分划定。它是<strong>资格线</strong>，与当年<strong>第一批录取分数线</strong>不是同一条线，不能互相替代。</p>',
      '用名额分配控制线判断「一批能不能上某校」，或用第一批线去填名额分配志愿。',
      '名额分配控制线',
      meeLink
    );

    const p4 = pathTpl(
      '补录 / 二批 / 三批查询指引',
      '<p><strong>第二批</strong>为本市中等职业学校及技工院校录取线（除第一批试点专业外）。<strong>二次划线</strong>阶段公布的<strong>资格线</strong>是补录填报门槛，<strong>不是</strong>最终录取线；实际投档录取线 ≥ 资格线，以教育局公告图片为准。<strong>第三批</strong>由广东省教育考试院组织，请到深圳招考网或省考试院查询当期学校与分数线。</p>',
      '把二次划线的「资格线」当作已经产生的录取线，或低于资格线也能投档录取。',
      '第二次划线资格线',
      makeupLinks.join(' · ')
    );

    box.innerHTML = intro + p1 + p2 + p3 + p4;
  }

  window.renderGuide = renderGuide;

  document.getElementById('view-guide')?.addEventListener('click', (e) => {
    if (e.target.closest('[data-open-rules]')) {
      e.preventDefault();
      document.getElementById('openRules')?.click();
    }
  });

  renderGuide();
})();