(function () {
  const DATA = window.ZZZS_DATA;
  if (!DATA) {
    document.getElementById('list').innerHTML =
      '<div class="empty">未找到数据，请先运行 <code>python scripts/fetch_data.py</code></div>';
    return;
  }

  const TRACKS = ['全部', '理工科技', '人文社科'];
  const SUBJECTS = {
    '全部': ['全部'],
    '理工科技': ['全部', '数学', '物理', '化学', '生物', '信息', '科创', '综合'],
    '人文社科': ['全部', '语文', '英语', '小语种', '人文综合'],
  };
  // (lo, hi]：控制线落在区间内
  const SEGMENTS = {
    '一类': [['530分以上', 530, Infinity], ['510-530', 510, 530], ['490-510', 490, 510], ['470-490', 470, 490],
             ['450-470', 450, 470], ['430-450', 430, 450], ['430以下', -Infinity, 430]],
    '二类': [['450分以上', 450, Infinity], ['420-450', 420, 450], ['390-420', 390, 420], ['360-390', 360, 390],
             ['330-360', 330, 360], ['300-330', 300, 330], ['300以下', -Infinity, 300]],
  };
  const COLORS = ['#2f6bff', '#13a8a8', '#e0663b', '#7a5af8', '#1f9d55', '#c2410c', '#0e7490', '#be185d'];
  const CAT_ORDER = { AC: 0, D: 1, ACD: 2 };
  const BATCH_NAME = { mee: '名额分配', batch1: '第一批', batch2: '第二批', second: '二次划线', batch3: '第三批' };
  const SCORE_SEG_HIGH = [
    ['580分以上', 580, Infinity], ['560-580', 560, 580], ['540-560', 540, 560], ['520-540', 520, 540],
    ['500-520', 500, 520], ['480-500', 480, 500], ['460-480', 460, 480], ['460以下', -Infinity, 460],
  ];
  const SCORE_SEG_VOC = [
    ['400分以上', 400, Infinity], ['350-400', 350, 400], ['300-350', 300, 350], ['250-300', 250, 300],
    ['200-250', 200, 250], ['150-200', 150, 200], ['150以下', -Infinity, 150],
  ];
  const SCORE_SEGMENTS = { mee: SCORE_SEG_HIGH, batch1: SCORE_SEG_HIGH, batch2: SCORE_SEG_VOC, second: SCORE_SEG_HIGH };

  const state = {
    category: '一类', track: '全部', subject: '全部', segment: null,
    ownership: '', district: '', keyword: '', sort: 'score', boarding: '', projectView: false,
    filtersOpen: false,
  };
  const fee = { ownership: '', type: '普高', district: '', keyword: '', sort: 'tuition-asc', filtersOpen: false };
  const scoreState = {
    batch: 'mee', type: '', category: '', district: '', keyword: '',
    segment: null, noteOpen: false, filtersOpen: false, sort: 'score', boarding: '',
  };
  const BRAND_DISCLAIMER = '本站整理公开招生信息，不构成录取承诺；以教育局、招考网及学校简章为准。';
  const PRODUCT_TARGET_YEAR = 2027;
  const VERIFY_STATUS_LABEL = {
    'verified-history': '历史已核实',
    'reference-2026': '2026 参考',
    'verified-2027': '2027 已核实',
    pending: '待发布',
  };
  const SCORE_KINDS = ['资格线', '录取线', '控制线'];
  const shared = { myScore: null, onlyReach: false, budget: null };
  function myNum() {
    if (!window.Reco) return typeof shared.myScore === 'number' ? shared.myScore : null;
    return window.Reco.compareScore(shared.myScore);
  }
  let allowUrlWrite = false;
  let compareOpen = false;
  const lineCache = new Map();
  const $ = (id) => document.getElementById(id);
  const PROFILES = DATA.profiles || [];
  function assembleScores() {
    if (window.SCORES_DATA) return window.SCORES_DATA;
    const meta = window.SCORES_META;
    if (!meta) return null;
    const schools = [];
    const parts = window.SCORES_PARTS || {};
    Object.keys(parts).forEach(key => {
      (parts[key] || []).forEach(row => schools.push(row));
    });
    return Object.assign({}, meta, { schools: schools });
  }
  let SCORES = assembleScores();
  const scoreBatchFailed = {};
  function ensureScoreBatch(batch, done) {
    SCORES = assembleScores();
    if (window.SCORES_DATA || (window.SCORES_PARTS && window.SCORES_PARTS[batch]) || scoreBatchFailed[batch]) {
      done();
      return;
    }
    const el = document.createElement('script');
    el.src = 'data/scores-batch-' + batch + '.js';
    el.onload = function () { SCORES = assembleScores(); done(); };
    el.onerror = function () { scoreBatchFailed[batch] = true; done(); };
    document.body.appendChild(el);
  }
  const yuan = (v) => v == null ? null : v.toLocaleString();

  const districts = [...new Set(DATA.schools.map(s => s.district).filter(Boolean))].sort();
  const boardingModes = [...new Set(PROFILES.map(p => String(p.boardingMode || '').trim()).filter(v => v && v !== '无'))]
    .sort((a, b) => a.localeCompare(b, 'zh'));
  const feeTypes = [...new Set(PROFILES.map(p => p.type).filter(Boolean))];
  const feeDistricts = [...new Set(PROFILES.map(p => p.district).filter(Boolean))];
  let compareNames = loadCompare();

  function lsGet(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }
  function lsSet(key, value) {
    try { localStorage.setItem(key, value); } catch (e) {}
  }
  function lsDel(key) {
    try { localStorage.removeItem(key); } catch (e) {}
  }
  function loadCompare() {
    try {
      const arr = JSON.parse(lsGet('zzzs.compare') || '[]');
      if (!Array.isArray(arr)) return [];
      const out = [];
      for (const n of arr) {
        if (typeof n !== 'string' || !n || out.includes(n)) continue;
        out.push(n);
        if (out.length >= 3) break;
      }
      return out;
    } catch (e) {
      return [];
    }
  }
  function saveCompare() {
    lsSet('zzzs.compare', JSON.stringify(compareNames));
  }

  function normSchoolName(s) {
    return String(s ?? '')
      .replace(/[（(]\s*[一二三四五六七八九十\d]+[)）]\s*$/g, '')
      .replace(/[（(].*?[)）]/g, '')
      .replace(/\s+/g, '');
  }

  function recordsByStrictName(records, needle) {
    const list = records || [];
    const name = needle == null ? '' : String(needle);
    if (!name) return [];
    const exact = list.filter(r => r && r.name === name);
    if (exact.length) return exact;
    const key = normSchoolName(name);
    if (!key) return [];
    const hits = list.filter(r => {
      if (!r) return false;
      if (normSchoolName(r.name) === key) return true;
      return !!(r.rawName && normSchoolName(r.rawName) === key);
    });
    if (new Set(hits.map(r => r.name)).size !== 1) return [];
    return hits;
  }

  function lineBundle(name) {
    if (lineCache.has(name)) return lineCache.get(name);
    const scores = SCORES && SCORES.schools ? SCORES.schools : [];
    const bundle = {
      zzzs: recordsByStrictName(DATA.schools, name),
      mee: recordsByStrictName(scores.filter(s => s.batch === 'mee'), name),
      batch1: recordsByStrictName(scores.filter(s => s.batch === 'batch1'), name),
    };
    lineCache.set(name, bundle);
    return bundle;
  }

  function profileOf(s) {
    return s && s.profileIndex != null && DATA.profiles ? DATA.profiles[s.profileIndex] : null;
  }

  function acceptedProfileForZzzs(school) {
    const profile = profileOf(school);
    if (!profile || !school) return null;
    if (profile.name === school.name) return profile;
    const a = normSchoolName(profile.name);
    const b = normSchoolName(school.name);
    if (a && b && a === b) return profile;
    return null;
  }

  function findProfile(name, rawName) {
    if (!PROFILES.length) return null;
    const needles = [];
    if (name) needles.push(name);
    if (rawName && rawName !== name) needles.push(rawName);
    for (const n of needles) {
      const exact = PROFILES.find(p => p.name === n);
      if (exact) return exact;
    }
    const keys = [];
    for (const n of needles) {
      const key = normSchoolName(n);
      if (key && !keys.includes(key)) keys.push(key);
    }
    if (!keys.length) return null;
    const hits = PROFILES.filter(p => keys.some(key => normSchoolName(p.name) === key));
    const names = [...new Set(hits.map(p => p.name))];
    if (names.length !== 1) return null;
    return hits[0];
  }

  function acceptedProfileForScore(school) {
    if (!school) return null;
    return findProfile(school.name, school.rawName);
  }

  function showText(v) {
    const compact = String(v ?? '').replace(/\s+/g, '');
    if (!compact || compact === '无') return '';
    return String(v).trim();
  }

  function gapText(score, my) {
    const d = my - score;
    if (d > 0) return '高出' + d;
    if (d < 0) return '还差' + (-d);
    return '持平';
  }

  function withGaps(text, my) {
    if (my == null || text == null || text === '—') return text == null ? '—' : text;
    return String(text).replace(/\d+(?:\.\d+)?/g, (num) => num + '（' + gapText(Number(num), my) + '）');
  }

  function reaches(scores, my) {
    if (my == null) return false;
    return scores.some(v => v <= my);
  }

  function reachGroup(scores) {
    if (myNum() == null) return 0;
    return reaches(scores, myNum()) ? 0 : 1;
  }

  function threeYear(feeObj) {
    if (!feeObj || !Number.isFinite(feeObj.tuition)) return null;
    if (Number.isFinite(feeObj.boarding)) return (feeObj.tuition + feeObj.boarding) * 6;
    return feeObj.tuition * 6;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function linkify(text) {
    if (!text) return '—';
    const m = text.match(/(https?:\/\/\S+|www\.\S+|[\w-]+\.[\w.-]+\.(?:cn|com|net)\S*)/);
    if (!m) return escapeHtml(text);
    const url = m[0].startsWith('http') ? m[0] : 'http://' + m[0];
    return escapeHtml(text.slice(0, m.index)) + '<a href="' + escapeHtml(url) + '" target="_blank" rel="noopener">' + escapeHtml(m[0]) + '</a>';
  }

  function shortName(name) {
    const base = name.replace(/[（(].*?[)）]/g, '');
    const stripped = base.replace(/^深圳市?/, '');
    return (stripped.length >= 4 ? stripped : base).slice(0, 2);
  }

  function scoreLabel(s) {
    if (s.scores.length <= 1) return s.scores[0] ? String(s.scores[0].score) : s.scoreText || '—';
    return s.scores.map(x => (x.label ? x.label.slice(0, 2) : '') + x.score).join(' / ');
  }

  function zzzsGapInner(s) {
    if (myNum() == null || !s.scores.length) return '';
    const my = myNum();
    if (s.scores.length === 1) return gapText(s.scores[0].score, my);
    return s.scores.map(x => (x.label ? x.label.slice(0, 2) : '') + gapText(x.score, my)).join(' / ');
  }

  function gapSpan(text) {
    if (!text) return '';
    return '<span class="gap">' + escapeHtml(text) + '</span>';
  }

  function feeBrief(feeObj) {
    if (!feeObj || !Number.isFinite(feeObj.tuition)) return '见公示原文';
    let text = '学费 ' + feeObj.tuition.toLocaleString() + ' 元/学期';
    if (Number.isFinite(feeObj.boarding)) text += '，住宿费 ' + feeObj.boarding.toLocaleString() + ' 元/学期';
    return text;
  }

  function feeSurfaceHtml(profile) {
    if (!profile || !Number.isFinite(profile.fee && profile.fee.tuition)) return '';
    return '<div class="fee-brief">' + escapeHtml(feeBrief(profile.fee)) + '</div>';
  }

  function feeDetailHtml(profile) {
    if (!profile || !Number.isFinite(profile.fee && profile.fee.tuition)) return '';
    return '<div>收费：' + escapeHtml(feeBrief(profile.fee)) +
      ' <span class="fee-link" data-fee="' + escapeHtml(profile.name) + '">查看收费标准</span></div>';
  }

  function websiteHtml(website) {
    const t = showText(website);
    return t ? linkify(t) : '—';
  }

  function profileInfoHtml(p) {
    if (!p) return '';
    const rows = [];
    if (showText(p.summary)) rows.push('<div class="school-summary">' + escapeHtml(p.summary) + '</div>');
    rows.push('<div>地址：' + escapeHtml(showText(p.address) || '—') + '</div>');
    if (showText(p.postalCode)) rows.push('<div>邮编：' + escapeHtml(String(p.postalCode).trim()) + '</div>');
    rows.push('<div>电话：' + escapeHtml(showText(p.phone) || '—') + '</div>');
    rows.push('<div>官网：' + websiteHtml(p.website) + '</div>');
    if (p.url) rows.push('<div>学校介绍：<a href="' + escapeHtml(p.url) + '" target="_blank" rel="noopener">深圳招考网</a></div>');
    return '<div class="school-info">' + rows.join('') + '</div>';
  }

  function zzzsScoreText(r) {
    if (r.scoreText) return r.scoreText;
    if (!r.scores || !r.scores.length) return '';
    return r.scores.map(x => (x.label ? x.label + ' ' : '') + x.score).join('、');
  }

  function formatZzzsFull(records) {
    if (!records.length) return '—';
    const parts = [];
    for (const cat of ['一类', '二类']) {
      const rows = records.filter(r => r.category === cat);
      if (!rows.length) continue;
      const text = rows.map(zzzsScoreText).filter(Boolean).join('、');
      if (text) parts.push(cat + ' ' + text);
    }
    if (parts.length) return parts.join('；');
    return records.map(zzzsScoreText).filter(Boolean).join('、') || '—';
  }

  function formatZzzsShort(records) {
    const parts = [];
    for (const cat of ['一类', '二类']) {
      const nums = records.filter(r => r.category === cat)
        .flatMap(r => (r.scores || []).map(x => x.score))
        .filter(n => typeof n === 'number');
      if (!nums.length) continue;
      const body = nums.length > 1 ? Math.min(...nums) + '～' + Math.max(...nums) : String(nums[0]);
      parts.push(cat + body);
    }
    return parts.join('/');
  }

  function sortByCat(records) {
    return [...records].sort((a, b) => (CAT_ORDER[a.category] ?? 9) - (CAT_ORDER[b.category] ?? 9));
  }

  function formatMeeFull(records) {
    if (!records.length) return '—';
    return sortByCat(records).map(r => {
      const score = r.scores && r.scores[0] && r.scores[0].score != null ? r.scores[0].score : '—';
      return (r.category ? r.category + ' ' : '') + score;
    }).join(' / ');
  }

  function formatMeeShort(records) {
    if (!records.length) return '';
    return sortByCat(records).map(r => (r.category || '') + (r.scores && r.scores[0] && r.scores[0].score != null ? r.scores[0].score : '')).join('/');
  }

  function batch1Scores(records) {
    const items = [];
    for (const r of records) {
      for (const x of r.scores || []) {
        if (x && typeof x.score === 'number') items.push(x);
      }
    }
    return items;
  }

  function formatBatch1Full(records) {
    const items = batch1Scores(records);
    if (!items.length) return '—';
    return items.map(x => (x.label ? x.label + ' ' : '') + x.score).join('、');
  }

  function formatBatch1Short(records) {
    const items = batch1Scores(records);
    if (!items.length) return '';
    if (items.length <= 2) return items.map(x => (x.label ? x.label + ' ' : '') + x.score).join('、');
    const nums = items.map(x => x.score);
    return Math.min(...nums) + '～' + Math.max(...nums) + '（' + items.length + '条）';
  }

  function lineHint(name, skip) {
    const b = lineBundle(name);
    const parts = [];
    if (skip !== 'zzzs') {
      const body = formatZzzsShort(b.zzzs);
      if (body && DATA.year != null) parts.push('自招' + DATA.year + '资格线 ' + body);
    }
    if (skip !== 'mee') {
      const body = formatMeeShort(b.mee);
      if (body && SCORES && SCORES.year != null) parts.push('名额' + SCORES.year + '资格线 ' + body);
    }
    if (skip !== 'batch1') {
      const body = formatBatch1Short(b.batch1);
      if (body && SCORES && SCORES.year != null) parts.push('一批' + SCORES.year + '录取线 ' + body);
    }
    if (!parts.length) return '';
    return '<div class="line-hint">' + escapeHtml(parts.join(' · ')) + '</div>';
  }

  function linesTable(name) {
    const b = lineBundle(name);
    const rows = [
      ['自招控制线', '资格线', b.zzzs, DATA.year, formatZzzsFull],
      ['名额分配控制线', '资格线', b.mee, SCORES ? SCORES.year : null, formatMeeFull],
      ['第一批录取线', '当年录取线', b.batch1, SCORES ? SCORES.year : null, formatBatch1Full],
    ];
    return '<table class="lines">' + rows.map(([label, kind, recs, year, fmt]) => {
      const has = recs && recs.length;
      const srcTag = has && recs[0] && recs[0].sourceType === 'unofficial' ? unofficialTag('unofficial') : '';
      const yearCell = has && year != null ? year + '年' + srcTag : '—';
      const scoreCell = has ? withGaps(fmt(recs), myNum()) : '—';
      return '<tr><th>' + label + '</th><td>' + kind + '</td><td>' + yearCell + '</td><td>' + escapeHtml(scoreCell) + '</td></tr>';
    }).join('') + '</table>';
  }

  function trackPlan(s, track) {
    return s.projects.filter(p => p.track === track).reduce((n, p) => n + p.plan, 0);
  }

  function displayPlan(s) {
    if (state.category !== '一类' || !s.projects.length) return s.plan || 0;
    const ps = s.projects.filter(p =>
      (state.track === '全部' || p.track === state.track) &&
      (state.subject === '全部' || p.subject === state.subject));
    return ps.reduce((n, p) => n + p.plan, 0);
  }

  function visibleProjects(s) {
    const kw = state.keyword.trim();
    const nameHit = !kw || s.name.includes(kw);
    return (s.projects || []).filter(p => {
      if (state.track !== '全部' && p.track !== state.track) return false;
      if (state.subject !== '全部' && p.subject !== state.subject) return false;
      if (kw && !nameHit && !String(p.name || '').includes(kw)) return false;
      return true;
    });
  }

  function projLineHtml(s) {
    if (state.category !== '一类' || !state.projectView || !(s.projects || []).length) return '';
    const ps = visibleProjects(s);
    if (!ps.length) return '';
    return '<div class="proj-line">' + escapeHtml(ps.map(p => p.name + ' · 计划' + p.plan).join('、')) + '</div>';
  }

  function projectsHtml(s) {
    if (s.category !== '一类') return '';
    if (!s.projects.length) return '<div>官方汇总表未细分项目，具体项目与人数见学校简章。</div>';
    const kw = state.keyword.trim();
    const rows = s.projects.map(p => {
      const hit = kw && String(p.name || '').includes(kw) ? ' class="hit"' : '';
      return '<tr' + hit + '><td>' + escapeHtml(p.track) + '</td><td>' + escapeHtml(p.name) + '</td><td>' + p.plan + '</td></tr>';
    }).join('');
    return '<div>控制分是这所学校的自招资格线，项目没有单独的分数。</div><table><tr><th>类型</th><th>项目</th><th>计划</th></tr>' + rows + '</table>';
  }

  function cmpBtn(name) {
    const on = compareNames.includes(name);
    const full = !on && compareNames.length >= 3;
    return '<button type="button" class="cmp-btn" data-cmp="' + escapeHtml(name) + '"' +
      (full ? ' disabled title="最多对比 3 所"' : '') + '>' + (on ? '已对比' : '对比') + '</button>';
  }

  function filtered() {
    const seg = state.segment && SEGMENTS[state.category].find(x => x[0] === state.segment);
    const kw = state.keyword.trim();
    const my = myNum();
    const list = DATA.schools.filter(s => {
      if (s.category !== state.category) return false;
      if (state.ownership && s.ownership !== state.ownership) return false;
      if (state.district && s.district !== state.district) return false;
      if (state.boarding) {
        const p = acceptedProfileForZzzs(s);
        if (!p || String(p.boardingMode || '').trim() !== state.boarding) return false;
      }
      if (kw && !s.name.includes(kw) && !(s.projects || []).some(p => String(p.name || '').includes(kw))) return false;
      const scores = s.scores.map(x => x.score);
      if (seg && !scores.some(v => v > seg[1] && v <= seg[2])) return false;
      if (my != null && shared.onlyReach && !reaches(scores, my)) return false;
      if (state.category === '一类' && (state.track !== '全部' || state.subject !== '全部')) {
        if (!s.projects.length) return state.subject === '全部';
        return displayPlan(s) > 0;
      }
      return true;
    });
    list.sort((a, b) => {
      const ga = reachGroup(a.scores.map(x => x.score));
      const gb = reachGroup(b.scores.map(x => x.score));
      if (ga !== gb) return ga - gb;
      if (state.sort === 'plan') return displayPlan(b) - displayPlan(a);
      if (state.sort === 'gap' && my != null) {
        const gapA = a.scores.length ? Math.max(...a.scores.map(x => my - x.score)) : -Infinity;
        const gapB = b.scores.length ? Math.max(...b.scores.map(x => my - x.score)) : -Infinity;
        return gapB - gapA;
      }
      return Math.max(...b.scores.map(x => x.score), 0) - Math.max(...a.scores.map(x => x.score), 0);
    });
    return list;
  }

  function recoAcked() {
    try { return sessionStorage.getItem('zzzs.recoAck') === '1'; } catch (e) { return false; }
  }

  function tierTag(lines) {
    if (!recoAcked() || !shared.myScore || typeof shared.myScore !== 'object' || !window.Reco) return '';
    const nums = (lines || []).filter(n => typeof n === 'number');
    if (!nums.length) return '';
    const line = Math.min.apply(null, nums);
    const t = window.Reco.tier(shared.myScore, line);
    if (!t) return '';
    return '<span class="tag tier" title="' + escapeHtml(t.ruleId + ' · ' + t.field) + '">' + escapeHtml(t.label) + '</span>';
  }

  function cardHtml(s, i) {
    const color = COLORS[[...s.name].reduce((n, c) => n + c.charCodeAt(0), 0) % COLORS.length];
    const scores = s.scores.map(x => x.score);
    const miss = myNum() != null && !reaches(scores, myNum());
    const kw = state.keyword.trim();
    const forceOpen = state.category === '一类' && kw && !s.name.includes(kw) &&
      (s.projects || []).some(p => String(p.name || '').includes(kw));
    const profile = acceptedProfileForZzzs(s);
    const bits = [s.ownership, s.district, showText(profile && profile.rank), showText(profile && profile.boardingMode)].filter(Boolean);
    let meta = escapeHtml(bits.join(' | '));
    if (s.category === '一类' && !s.projects.length) meta += '<span class="tag">项目未细分</span>';
    if (miss) meta += '<span class="tag">未达线</span>';
    meta += recordSourceTags(s);
    meta += tierTag(scores);
    let stats;
    if (s.category === '一类' && s.projects.length) {
      stats = '<div><b>' + trackPlan(s, '理工科技') + '</b><span>理工科技</span></div>' +
        '<div><b>' + trackPlan(s, '人文社科') + '</b><span>人文社科</span></div>';
    } else {
      stats = '<div><b>' + (s.plan ?? '—') + '</b><span>计划数</span></div>';
    }
    stats += '<div><b>' + escapeHtml(scoreLabel(s)) + gapSpan(zzzsGapInner(s)) + '</b><span>控制分</span></div>';
    const cls = ['card', miss ? 'miss' : '', forceOpen ? 'open' : ''].filter(Boolean).join(' ');
    return '<div class="' + cls + '" data-i="' + i + '">' +
      '<div class="card-head">' +
        '<div class="logo" style="background:' + color + '">' + escapeHtml(shortName(s.name)) + '</div>' +
        '<div><div class="name">' + escapeHtml(s.name) + '</div>' +
          '<div class="meta">' + meta + '</div>' +
          lineHint(s.name, 'zzzs') + projLineHtml(s) + feeSurfaceHtml(profile) +
        '</div>' + cmpBtn(s.name) +
      '</div>' +
      '<div class="stats">' + stats + '</div>' +
      '<div class="detail">' + linesTable(s.name) + projectsHtml(s) +
        '<div>中考成绩控制线：' + escapeHtml(s.scoreText || '—') + '</div>' +
        '<div>招生范围：' + escapeHtml(s.scope || '—') + '</div>' +
        '<div>招生简章：' + linkify(s.brochure) + '</div>' +
        feeDetailHtml(profile) +
        profileInfoHtml(profile) +
      '</div></div>';
  }

  function scoreBatchItems(batch) {
    if (!SCORES || !SCORES.schools) return [];
    return SCORES.schools.filter(s => s.batch === batch);
  }
  function scoreItems() {
    return scoreBatchItems(scoreState.batch);
  }
  function scoreCategoryToken(label) {
    const m = String(label || '').match(/ACD|AC|D/);
    return m ? m[0] : '';
  }
  function scoreValues(s) {
    if (scoreState.category) {
      const focused = s.scores.filter(x => scoreCategoryToken(x.label) === scoreState.category).map(x => x.score);
      if (focused.length) return focused;
      if (s.category === scoreState.category) return s.scores.map(x => x.score);
    }
    return s.scores.map(x => x.score);
  }
  function filteredScores() {
    const kw = scoreState.keyword.trim();
    const segs = SCORE_SEGMENTS[scoreState.batch] || SCORE_SEG_HIGH;
    const seg = scoreState.segment && segs.find(x => x[0] === scoreState.segment);
    const my = myNum();
    const list = scoreItems().filter(s => {
      if (scoreState.type && s.type !== scoreState.type) return false;
      if (scoreState.district && s.district !== scoreState.district) return false;
      if (scoreState.boarding) {
        const p = acceptedProfileForScore(s);
        if (!p || String(p.boardingMode || '').trim() !== scoreState.boarding) return false;
      }
      if (kw && !s.name.includes(kw) && !(s.rawName || '').includes(kw)) return false;
      if (scoreState.category) {
        const hitCat = (s.category && s.category === scoreState.category) ||
          (!s.category && s.scores.some(x => scoreCategoryToken(x.label) === scoreState.category));
        if (!hitCat) return false;
      }
      const vals = scoreValues(s);
      if (seg && !vals.some(v => v > seg[1] && v <= seg[2])) return false;
      if (my != null && shared.onlyReach && !reaches(vals, my)) return false;
      return true;
    });
    list.sort((a, b) => {
      const va = scoreValues(a);
      const vb = scoreValues(b);
      const ga = reachGroup(va);
      const gb = reachGroup(vb);
      if (ga !== gb) return ga - gb;
      if (scoreState.sort === 'plan') {
        const an = a.plan == null;
        const bn = b.plan == null;
        if (an !== bn) return an ? 1 : -1;
        if (!an && a.plan !== b.plan) return b.plan - a.plan;
        return a.name.localeCompare(b.name, 'zh');
      }
      if (scoreState.sort === 'gap' && my != null) {
        const gapA = va.length ? Math.max(...va.map(v => my - v)) : -Infinity;
        const gapB = vb.length ? Math.max(...vb.map(v => my - v)) : -Infinity;
        if (gapA !== gapB) return gapB - gapA;
        return a.name.localeCompare(b.name, 'zh');
      }
      const sa = Math.max(...va, 0);
      const sb = Math.max(...vb, 0);
      if (sa !== sb) return sb - sa;
      return a.name.localeCompare(b.name, 'zh');
    });
    return list;
  }

  function scoreCardHtml(s) {
    const color = COLORS[[...s.name].reduce((n, c) => n + c.charCodeAt(0), 0) % COLORS.length];
    const kindLabel = (s.scoreKind && SCORE_KINDS.indexOf(s.scoreKind) >= 0) ? s.scoreKind : '待标注';
    const vals = scoreValues(s);
    const miss = myNum() != null && !reaches(vals, myNum());
    const my = myNum();
    let stats = '<div><b>' + (s.plan ?? '—') + '</b><span>计划数</span></div>';
    if (s.scores.length <= 2) {
      stats += s.scores.map(x => {
        const g = my == null ? '' : gapSpan(gapText(x.score, my));
        return '<div><b>' + x.score + g + '</b><span>' + escapeHtml(x.label || kindLabel) + '</span></div>';
      }).join('');
    } else {
      const compact = s.scores.map(x => {
        const tag = (x.label || '').replace(/类.*/, '类').slice(0, 4);
        return (tag || '') + x.score;
      }).join(' / ');
      const g = my == null ? '' : gapSpan(s.scores.map(x => {
        const tag = (x.label || '').replace(/类.*/, '类').slice(0, 4);
        return (tag || '') + gapText(x.score, my);
      }).join(' / '));
      stats += '<div><b>' + escapeHtml(compact) + g + '</b><span>' + escapeHtml(kindLabel) + '</span></div>';
    }
    const profile = acceptedProfileForScore(s);
    const bits = [s.ownership, s.district, showText(profile && profile.rank), showText(profile && profile.boardingMode)].filter(Boolean);
    const tags = [s.type, s.category && (s.category + '类')].filter(Boolean)
      .map(t => '<span class="tag">' + escapeHtml(t) + '</span>').join('');
    const meta = escapeHtml(bits.join(' | ')) + tags + (miss ? '<span class="tag">未达线</span>' : '') +
      recordSourceTags(s) + tierTag(vals);
    const skip = s.batch === 'mee' ? 'mee' : s.batch === 'batch1' ? 'batch1' : null;
    return '<div class="card' + (miss ? ' miss' : '') + '">' +
      '<div class="card-head">' +
        '<div class="logo" style="background:' + color + '">' + escapeHtml(shortName(s.name)) + '</div>' +
        '<div><div class="name">' + escapeHtml(s.name) + '</div>' +
          '<div class="meta">' + meta + '</div>' +
          lineHint(s.name, skip) + feeSurfaceHtml(profile) +
        '</div>' + cmpBtn(s.name) +
      '</div>' +
      '<div class="stats">' + stats + '</div>' +
      '<div class="detail">' + linesTable(s.name) +
        (s.rawName && s.rawName !== s.name ? '<div>原始名称：' + escapeHtml(s.rawName) + '</div>' : '') +
        (s.boardingMode ? '<div>住宿：' + escapeHtml(s.boardingMode) + '</div>' : '') +
        (s.code ? '<div>学校代码：' + escapeHtml(s.code) + '</div>' : '') +
        '<div>' + escapeHtml(kindLabel) + '：' + escapeHtml(s.scores.map(x => (x.label ? x.label + ' ' : '') + x.score).join('、') || '—') + '</div>' +
        '<div>批次：' + escapeHtml(BATCH_NAME[s.batch] || s.batch) + '</div>' +
        feeDetailHtml(profile) +
        profileInfoHtml(profile) +
      '</div></div>';
  }

  function basisTag(f) {
    if (f.tuition == null) return '<span class="basis raw">见公示原文</span>';
    if (f.basis && f.basis.startsWith('按市发改委')) return '<span class="basis derived">' + escapeHtml(f.basis) + '</span>';
    return '<span class="basis official">学校公示</span>';
  }

  function feeCardHtml(p) {
    const f = p.fee;
    const stat = (v, label) => '<div><b class="' + (v == null ? 'na' : '') + '">' + (v == null ? '—' : yuan(v)) + '</b><span>' + label + '</span></div>';
    const meta = [p.ownership, p.district, p.rank && p.rank !== '无' ? p.rank : '', p.boardingMode].filter(Boolean).join(' | ');
    return '<div class="card fee-card">' +
      '<div class="card-head"><div>' +
        '<div class="name">' + escapeHtml(p.name) + '</div>' +
        '<div class="meta">' + escapeHtml(meta) + basisTag(f) + '</div>' +
      '</div></div>' +
      '<div class="stats">' + stat(f.tuition, '学费/学期') + stat(f.boarding, '住宿费/学期') + stat(f.meals, '伙食费/学期') + '</div>' +
      '<div class="detail">' +
        '<div>公示收费标准：' + escapeHtml(f.text || '—') + '</div>' +
        (f.tuition != null ? '<div>三年学费合计约：' + yuan(f.tuition * 6) + ' 元' + (f.boarding != null ? '；含住宿约：' + yuan((f.tuition + f.boarding) * 6) + ' 元' : '') + '</div>' : '') +
        profileInfoHtml(p) +
      '</div></div>';
  }

  function filteredFees() {
    const kw = fee.keyword.trim();
    const list = PROFILES.filter(p =>
      (!fee.ownership || p.ownership === fee.ownership) &&
      (!fee.type || p.type === fee.type) &&
      (!fee.district || p.district === fee.district) &&
      (!kw || p.name.includes(kw)));
    const byName = (a, b) => a.name.localeCompare(b.name, 'zh');
    if (fee.sort === 'name') return list.sort(byName);
    if (fee.sort === 'total3-asc' || fee.sort === 'total3-desc') {
      const dir = fee.sort === 'total3-desc' ? -1 : 1;
      return list.sort((a, b) => {
        const ta = threeYear(a.fee);
        const tb = threeYear(b.fee);
        const an = ta == null;
        const bn = tb == null;
        if (an !== bn) return an ? 1 : -1;
        if (!an && ta !== tb) return dir * (ta - tb);
        return byName(a, b);
      });
    }
    const t = (p) => p.fee.tuition;
    const dir = fee.sort === 'tuition-desc' ? -1 : 1;
    return list.sort((a, b) => (t(a) == null) - (t(b) == null) || dir * (t(a) - t(b)) || byName(a, b));
  }

  function currentView() {
    if (!$('view-guide').hidden) return 'guide';
    if (!$('view-fee').hidden) return 'fee';
    if (!$('view-scores').hidden) return 'scores';
    return 'zzzs';
  }

  function viewHash() {
    const view = currentView();
    if (view === 'guide') return '#guide';
    if (view === 'fee') return '#fee';
    if (view === 'scores') return '#scores';
    if (location.hash === '#rules') return '#rules';
    return '';
  }

  function buildQuery() {
    const p = new URLSearchParams();
    if (myNum() != null) {
      p.set('my', String(myNum()));
      if (shared.myScore && typeof shared.myScore === 'object') {
        const src = { final: 'e', mock1: '1', mock2: '2', direct: 'd' }[shared.myScore.source] || 'd';
        const pre = { conservative: 'c', neutral: 'n', optimistic: 'o' }[shared.myScore.riskPreset] || 'c';
        p.set('est', [shared.myScore.point, shared.myScore.low, shared.myScore.high, src, pre].join('.'));
      }
    }
    if (shared.onlyReach) p.set('reach', '1');
    if (state.category === '二类') p.set('zcat', '二类');
    if (state.track === '理工科技' || state.track === '人文社科') p.set('ztrack', state.track);
    if (state.subject && state.subject !== '全部') p.set('zsub', state.subject);
    if (state.ownership === '公办' || state.ownership === '民办') p.set('zown', state.ownership);
    if (state.district) p.set('zdist', state.district);
    if (state.segment) p.set('zseg', state.segment);
    if (state.keyword.trim()) p.set('zq', state.keyword);
    if (state.sort === 'plan' || state.sort === 'gap') p.set('zsort', state.sort);
    if (state.boarding) p.set('zboard', state.boarding);
    if (state.projectView) p.set('zview', 'project');
    if (scoreState.batch === 'batch1' || scoreState.batch === 'batch2' || scoreState.batch === 'second' || scoreState.batch === 'batch3') {
      p.set('sbatch', scoreState.batch);
    }
    if (scoreState.type) p.set('stype', scoreState.type);
    if (scoreState.category === 'AC' || scoreState.category === 'D' || scoreState.category === 'ACD') p.set('scat', scoreState.category);
    if (scoreState.district) p.set('sdist', scoreState.district);
    if (scoreState.segment) p.set('sseg', scoreState.segment);
    if (scoreState.keyword.trim()) p.set('sq', scoreState.keyword);
    if (scoreState.sort === 'plan' || scoreState.sort === 'gap') p.set('ssort', scoreState.sort);
    if (scoreState.boarding) p.set('sboard', scoreState.boarding);
    if (fee.ownership === '公办' || fee.ownership === '民办') p.set('fown', fee.ownership);
    if (fee.type === '') p.set('ftype', 'all');
    else if (fee.type !== '普高') p.set('ftype', fee.type);
    if (fee.district) p.set('fdist', fee.district);
    if (fee.sort === 'tuition-desc' || fee.sort === 'name' || fee.sort === 'total3-asc' || fee.sort === 'total3-desc') p.set('fsort', fee.sort);
    if (fee.keyword.trim()) p.set('fq', fee.keyword);
    return p.toString();
  }

  function writeUrl() {
    if (!allowUrlWrite) return;
    const q = buildQuery();
    history.replaceState(null, '', location.pathname + (q ? '?' + q : '') + viewHash());
  }

  function setIdleValue(el, value) {
    if (!el || document.activeElement === el) return;
    if (el.value !== value) el.value = value;
  }

  function sortOptions(current) {
    const opts = [['score', '分数从高到低'], ['plan', '计划人数从多到少']];
    if (myNum() != null) opts.push(['gap', '按与我的分的差距']);
    return opts.map(([v, lab]) => '<option value="' + v + '">' + lab + '</option>').join('');
  }

  function fillSort(el, current) {
    el.innerHTML = sortOptions(current);
    el.value = current;
  }

  function syncSharedControls() {
    if (myNum() == null) {
      if (state.sort === 'gap') state.sort = 'score';
      if (scoreState.sort === 'gap') scoreState.sort = 'score';
    }
    const shown = myNum() == null ? '' : String(myNum());
    ['myScore', 'scoreMy', 'feeMy'].forEach(id => setIdleValue($(id), shown));
    $('onlyReach').checked = shared.onlyReach;
    $('onlyReach').disabled = myNum() == null;
    $('scoreOnlyReach').checked = shared.onlyReach;
    $('scoreOnlyReach').disabled = myNum() == null;
    fillSort($('zzzsSort'), state.sort);
    fillSort($('scoreSort'), scoreState.sort);
    setIdleValue($('keyword'), state.keyword);
    setIdleValue($('scoreKeyword'), scoreState.keyword);
    setIdleValue($('feeKeyword'), fee.keyword);
    setIdleValue($('ownership'), state.ownership);
    setIdleValue($('district'), state.district);
    setIdleValue($('boarding'), state.boarding);
    setIdleValue($('feeSort'), fee.sort);
    setIdleValue($('feeType'), fee.type);
    setIdleValue($('feeDistrict'), fee.district);
  }

  function tagButton(key, label) {
    return '<button type="button" class="filter-tag" data-k="' + key + '">' + escapeHtml(label) + ' ×</button>';
  }
  function renderTagBox(id, tags) {
    const el = $(id);
    if (!tags.length) {
      el.hidden = true;
      el.innerHTML = '';
      return;
    }
    el.hidden = false;
    el.innerHTML = tags.map(([k, lab]) => tagButton(k, lab)).join('');
  }
  function renderZzzsTags() {
    const tags = [];
    if (state.ownership === '公办' || state.ownership === '民办') tags.push(['own', state.ownership]);
    if (state.district) tags.push(['dist', state.district]);
    if (state.track === '理工科技' || state.track === '人文社科') tags.push(['track', state.track]);
    if (state.subject && state.subject !== '全部') tags.push(['sub', state.subject]);
    if (state.segment) tags.push(['seg', state.segment]);
    if (state.keyword.trim()) tags.push(['q', '搜索：' + state.keyword.trim()]);
    if (state.boarding) tags.push(['board', '住宿：' + state.boarding]);
    if (shared.onlyReach && myNum() != null) tags.push(['reach', '只看达到我的分数']);
    if (state.projectView && state.category === '一类') tags.push(['view', '按项目看']);
    renderTagBox('zzzsTags', tags);
  }
  function renderScoreTags() {
    const tags = [];
    if (scoreState.type) tags.push(['type', scoreState.type]);
    if (scoreState.category === 'AC' || scoreState.category === 'D' || scoreState.category === 'ACD') tags.push(['cat', scoreState.category + '类']);
    if (scoreState.district) tags.push(['dist', scoreState.district]);
    if (scoreState.segment) tags.push(['seg', scoreState.segment]);
    if (scoreState.keyword.trim()) tags.push(['q', '搜索：' + scoreState.keyword.trim()]);
    if (scoreState.boarding) tags.push(['board', '住宿：' + scoreState.boarding]);
    if (shared.onlyReach && myNum() != null) tags.push(['reach', '只看达到我的分数']);
    renderTagBox('scoreTags', tags);
  }
  function renderFeeTags() {
    const tags = [];
    if (fee.ownership === '公办' || fee.ownership === '民办') tags.push(['own', fee.ownership]);
    if (fee.type !== '普高') tags.push(['type', '类型：' + (fee.type || '全部')]);
    if (fee.district) tags.push(['dist', fee.district]);
    if (fee.keyword.trim()) tags.push(['q', '搜索：' + fee.keyword.trim()]);
    renderTagBox('feeTags', tags);
  }

  function refreshCompareButtons() {
    document.querySelectorAll('.cmp-btn[data-cmp]').forEach(btn => {
      const name = btn.getAttribute('data-cmp');
      const on = compareNames.includes(name);
      const full = !on && compareNames.length >= 3;
      btn.textContent = on ? '已对比' : '对比';
      btn.disabled = full;
      btn.title = full ? '最多对比 3 所' : '';
    });
  }

  function uniqueDists(rows) {
    const out = [];
    for (const s of rows) {
      const d = s.district == null ? '' : String(s.district).trim();
      if (d && !out.includes(d)) out.push(d);
    }
    return out;
  }

  function compareProfile(b) {
    for (const s of b.zzzs) {
      const p = acceptedProfileForZzzs(s);
      if (p) return p;
    }
    for (const s of b.mee) {
      const p = acceptedProfileForScore(s);
      if (p) return p;
    }
    for (const s of b.batch1) {
      const p = acceptedProfileForScore(s);
      if (p) return p;
    }
    return null;
  }

  function compareZzzsText(b) {
    if (!b.zzzs.length || DATA.year == null) return '—';
    const body = formatZzzsFull(b.zzzs);
    if (!body || body === '—') return '—';
    return DATA.year + '年 ' + withGaps(body, myNum());
  }
  function compareMeeText(b) {
    if (!b.mee.length || !SCORES || SCORES.year == null) return '—';
    const body = formatMeeFull(b.mee);
    if (!body || body === '—') return '—';
    return SCORES.year + '年 ' + withGaps(body, myNum());
  }
  function compareBatch1Text(b) {
    if (!b.batch1.length || !SCORES || SCORES.year == null) return '—';
    const body = formatBatch1Full(b.batch1);
    if (!body || body === '—') return '—';
    return SCORES.year + '年 ' + withGaps(body, myNum());
  }
  function comparePlanCell(b) {
    const parts = [];
    for (const cat of ['一类', '二类']) {
      const rows = b.zzzs.filter(s => s.category === cat);
      if (!rows.length) continue;
      const nums = rows.map(s => s.plan).filter(n => typeof n === 'number');
      parts.push(nums.length ? cat + nums.reduce((a, c) => a + c, 0) + '人' : cat + '—人');
    }
    if (b.mee.length) {
      const body = sortByCat(b.mee).map(r => (r.category || '') + (typeof r.plan === 'number' ? r.plan : '—') + '人').join('/');
      parts.push('名额分配 ' + body);
    }
    return parts.length ? parts.join('；') : '—';
  }
  function compareDistrictCell(b, profile) {
    const z = uniqueDists(b.zzzs);
    if (z.length) return z.join('、');
    const first = uniqueDists(b.batch1);
    if (first.length) return first.join('、');
    const pd = profile && profile.district != null ? String(profile.district).trim() : '';
    if (!pd || pd.includes(',') || pd.includes('，')) return '—';
    return pd;
  }
  function compareProjectCell(b) {
    const one = b.zzzs.filter(s => s.category === '一类');
    if (!one.length) return '—';
    return one.some(s => s.projects && s.projects.length) ? '已细分' : '项目未细分';
  }
  function compareFeeCell(profile) {
    if (!profile || !Number.isFinite(profile.fee && profile.fee.tuition)) return '—';
    return feeBrief(profile.fee);
  }
  function compareBoardCell(profile) {
    return showText(profile && profile.boardingMode) || '—';
  }

  function renderCompareDock() {
    const dock = $('compareDock');
    const app = document.querySelector('.app');
    if (!compareNames.length) {
      dock.hidden = true;
      dock.innerHTML = '';
      app.classList.remove('has-compare');
      compareOpen = false;
      return;
    }
    dock.hidden = false;
    app.classList.add('has-compare');
    const cols = compareNames.map(name => ({ name, b: lineBundle(name), profile: null }));
    cols.forEach(c => { c.profile = compareProfile(c.b); });
    const head = cols.map(c => '<th>' + escapeHtml(c.name) + ' <button type="button" class="cmp-btn" data-remove="' + escapeHtml(c.name) + '">移除</button></th>').join('');
    const row = (label, fn) => '<tr><th>' + label + '</th>' + cols.map(c => '<td>' + escapeHtml(fn(c)) + '</td>').join('') + '</tr>';
    const sheet = compareOpen ? '<div class="sheet"><table><thead><tr><th></th>' + head + '</tr></thead><tbody>' +
      row('自招控制线（资格线）', c => compareZzzsText(c.b)) +
      row('名额分配控制线（资格线）', c => compareMeeText(c.b)) +
      row('第一批录取线（当年录取线）', c => compareBatch1Text(c.b)) +
      row('计划', c => comparePlanCell(c.b)) +
      row('学费', c => compareFeeCell(c.profile)) +
      row('住宿', c => compareBoardCell(c.profile)) +
      row('区域', c => compareDistrictCell(c.b, c.profile)) +
      row('地址', c => showText(c.profile && c.profile.address) || '—') +
      row('官网', c => showText(c.profile && c.profile.website) || '—') +
      row('项目', c => compareProjectCell(c.b)) +
      '</tbody></table></div>' : '';
    dock.innerHTML = sheet + '<div class="bar"><b>对比 ' + compareNames.length + '/3</b><span class="grow"></span>' +
      '<button type="button" class="cmp-btn" data-act="toggle">' + (compareOpen ? '收起' : '展开') + '</button>' +
      '<button type="button" class="cmp-btn" data-act="clear">清空</button></div>';
  }

  function renderControls() {
    document.querySelectorAll('#categorySeg button').forEach(b => b.classList.toggle('active', b.dataset.v === state.category));
    const isOne = state.category === '一类';
    $('trackTabs').style.display = isOne ? '' : 'none';
    $('subjectChips').style.display = isOne && state.track !== '全部' ? '' : 'none';
    $('trackTabs').innerHTML = TRACKS.map(t =>
      '<button data-v="' + t + '" class="' + (t === state.track ? 'active' : '') + '">' + t + '</button>').join('');
    $('subjectChips').innerHTML = (SUBJECTS[state.track] || SUBJECTS['全部']).map(t =>
      '<button class="chip ' + (t === state.subject ? 'active' : '') + '" data-v="' + t + '">' + t + '</button>').join('');
    $('side').innerHTML = '<div class="title">' + DATA.year + '年<small>控制线分段</small></div>' +
      '<button data-v="" class="' + (state.segment ? '' : 'active') + '">重置</button>' +
      SEGMENTS[state.category].map(([label]) =>
        '<button data-v="' + label + '" class="' + (label === state.segment ? 'active' : '') + '">' + label + '</button>').join('');
    const proj = $('projectViewBtn');
    proj.style.display = isOne ? '' : 'none';
    proj.classList.toggle('active', isOne && state.projectView);
    syncZzzsFold();
  }

  function renderList() {
    syncSharedControls();
    const items = filtered();
    const total = items.reduce((n, s) => n + displayPlan(s), 0);
    let extra = '';
    if (state.district) {
      const nums = items.flatMap(s => s.scores.map(x => x.score)).filter(n => typeof n === 'number');
      if (nums.length) extra = '，该区控制分 <b>' + Math.min(...nums) + '</b>～<b>' + Math.max(...nums) + '</b>';
    }
    $('summary').innerHTML = '👤 共<b>' + items.length + '</b>所高中，共<b>' + total + '</b>个自招名额' + extra;
    $('list').innerHTML = (items.length ? items.map(cardHtml).join('') : '<div class="empty">没有符合条件的学校</div>') +
      '<footer>' + $('footer').innerHTML + '</footer>';
    $('list').scrollTop = 0;
    renderZzzsTags();
    renderCompareDock();
    writeUrl();
    syncZzzsFold();
  }

  function render() { renderControls(); renderList(); }

  function renderFeeStandard() {
    const std = DATA.publicFeeStandard;
    if (!std) return;
    $('feeStandard').innerHTML = '<table class="std-table">' +
        '<tr><th>学校等级</th>' + Object.keys(std.tuition).map(k => '<th>' + escapeHtml(k.replace('学校', '')) + '</th>').join('') + '</tr>' +
        '<tr><td>学费（元/学期）</td>' + Object.values(std.tuition).map(v => '<td><b>' + yuan(v) + '</b></td>').join('') + '</tr>' +
      '</table>' +
      '<div class="note">住宿费 ' + yuan(std.boarding) + ' 元/学期。伙食费、校车费等服务性收费和代收费，由学校按非营利、学生自愿原则据实收取。' +
        '来源：<a href="' + escapeHtml(std.source) + '" target="_blank" rel="noopener">深圳市发展和改革委员会</a></div>';
  }

  function renderFee() {
    syncSharedControls();
    document.querySelectorAll('#feeOwnership button').forEach(b => b.classList.toggle('active', b.dataset.v === fee.ownership));
    const items = filteredFees();
    const priced = items.filter(p => p.fee.tuition != null).map(p => p.fee.tuition);
    let range = '';
    if (priced.length) {
      const a = yuan(Math.min(...priced));
      const b = yuan(Math.max(...priced));
      range = '，' + (fee.district ? '该区学费' : '学费') + ' <b>' + a + '</b>～<b>' + b + '</b> 元/学期';
    }
    $('feeSummary').innerHTML = '共<b>' + items.length + '</b>所学校' + range;
    $('feeList').innerHTML = items.length ? items.map(feeCardHtml).join('') : '<div class="empty">没有符合条件的学校</div>';
    $('feeList').scrollTop = 0;
    renderFeeTags();
    renderCompareDock();
    writeUrl();
    syncFeeFold();
  }

  const FEE_SORT_LABEL = {
    'tuition-asc': '学费从低到高',
    'tuition-desc': '学费从高到低',
    name: '按名称',
    'total3-asc': '三年含住宿从低到高',
    'total3-desc': '三年含住宿从高到低',
  };

  function feeFoldSummary() {
    const parts = [];
    if (fee.ownership) parts.push(fee.ownership);
    if (fee.type === '') parts.push('全部类型');
    else if (fee.type && fee.type !== '普高') parts.push(fee.type);
    if (fee.district) parts.push(fee.district);
    if (fee.sort && fee.sort !== 'tuition-asc') parts.push(FEE_SORT_LABEL[fee.sort] || fee.sort);
    if (myNum() != null) parts.push('我的分 ' + myNum());
    const onlyDefault = !parts.length;
    return onlyDefault ? '筛选与说明' : parts.join(' · ');
  }

  function syncFeeFold() {
    const open = fee.filtersOpen;
    $('feeFold').hidden = !open;
    const btn = $('feeFoldToggle');
    btn.classList.toggle('open', open);
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    $('feeFoldHint').textContent = open ? '收起' : '展开';
    $('feeFoldLabel').textContent = open ? '筛选与说明' : feeFoldSummary();
  }

  function zzzsFoldSummary() {
    const parts = [state.category];
    if (state.category === '一类') {
      if (state.track !== '全部') parts.push(state.track);
      if (state.subject !== '全部') parts.push(state.subject);
      if (state.projectView) parts.push('按项目看');
    }
    if (state.ownership) parts.push(state.ownership);
    if (state.district) parts.push(state.district);
    if (state.boarding) parts.push(state.boarding);
    if (myNum() != null) parts.push('我的分 ' + myNum());
    if (shared.onlyReach) parts.push('只看达到');
    if (state.segment) parts.push(state.segment);
    const onlyDefault = parts.length === 1 && (parts[0] === '一类' || parts[0] === '二类');
    return onlyDefault ? '筛选与说明' : parts.join(' · ');
  }

  function syncZzzsFold() {
    const open = state.filtersOpen;
    $('zzzsFold').hidden = !open;
    const btn = $('zzzsFoldToggle');
    btn.classList.toggle('open', open);
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    $('zzzsFoldHint').textContent = open ? '收起' : '展开';
    $('zzzsFoldLabel').textContent = open ? '筛选与说明' : zzzsFoldSummary();
  }

  function scoreFoldSummary() {
    if (scoreState.batch === 'batch3') return '第三批说明';
    const parts = [];
    if (scoreState.type) parts.push(scoreState.type);
    if (scoreState.category) parts.push(scoreState.category + '类');
    if (scoreState.district) parts.push(scoreState.district);
    if (scoreState.boarding) parts.push(scoreState.boarding);
    if (myNum() != null) parts.push('我的分 ' + myNum());
    if (shared.onlyReach) parts.push('只看达到');
    return parts.length ? parts.join(' · ') : '筛选与说明';
  }

  function syncScoreFold() {
    const open = scoreState.filtersOpen;
    $('scoreFold').hidden = !open;
    const btn = $('scoreFoldToggle');
    btn.classList.toggle('open', open);
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    $('scoreFoldHint').textContent = open ? '收起' : '展开';
    $('scoreFoldLabel').textContent = open ? '筛选与说明' : scoreFoldSummary();
  }

  function syncScoreNoteToggle(summary, detailHint) {
    const wrap = $('scoreNoteWrap');
    wrap.classList.toggle('open', scoreState.noteOpen);
    $('scoreNoteToggle').setAttribute('aria-expanded', scoreState.noteOpen ? 'true' : 'false');
    $('scoreNoteLabel').textContent = summary || '说明与原图';
    $('scoreNoteHint').textContent = scoreState.noteOpen ? '收起' : (detailHint || '展开');
  }

  function renderScoreNote() {
    if (!SCORES) {
      $('scoreNote').innerHTML = '未找到分数线数据，请先运行 <code>python scripts/fetch_scores.py</code>';
      syncScoreNoteToggle('说明与原图', '展开');
      return;
    }
    if (scoreState.batch === 'batch3') {
      const n = SCORES.batch3Note || SCORES.sources.batch3;
      $('scoreNote').innerHTML = escapeHtml(n.note) + ' 查询入口：<a href="' + escapeHtml(n.url) + '" target="_blank" rel="noopener">深圳招考网</a>';
      syncScoreNoteToggle(n.note || '第三批说明', '展开');
      return;
    }
    const srcNote = SCORES.sources[scoreState.batch];
    const imgs = (SCORES.images && SCORES.images[scoreState.batch]) || [];
    let extra = '';
    if (scoreState.batch === 'second') {
      extra = '<div>本页列表为<strong>资格线</strong>（填报门槛）。实际录取分数线 ≥ 资格线，详见官方公告图片。</div>';
      if (srcNote.planUrl) extra += '<div>计划原文：<a href="' + escapeHtml(srcNote.planUrl) + '" target="_blank" rel="noopener">第二次划线录取计划 PDF</a></div>';
    }
    const imgHtml = imgs.length
      ? '<div class="img-links">官方分数线原图：' + imgs.map((im, i) =>
          '<a href="' + escapeHtml(im.url) + '" target="_blank" rel="noopener">图' + (i + 1) + '</a>').join('') + '</div>'
      : '';
    $('scoreNote').innerHTML = '<div>' + escapeHtml(srcNote.note) + '</div>' +
      '<div>来源：<a href="' + escapeHtml(srcNote.url) + '" target="_blank" rel="noopener">' + escapeHtml(srcNote.title) + '</a></div>' +
      extra + imgHtml;
    syncScoreNoteToggle(srcNote.title || srcNote.note || '说明与原图', imgs.length ? '展开（' + imgs.length + '张原图）' : '展开');
  }

  function renderScoreSide() {
    const segs = SCORE_SEGMENTS[scoreState.batch] || SCORE_SEG_HIGH;
    const kind = scoreState.batch === 'mee' || scoreState.batch === 'second' ? '分数分段' : '录取线分段';
    $('scoreSide').innerHTML = '<div class="title">' + (SCORES && SCORES.year ? SCORES.year : '') + '<small>' + kind + '</small></div>' +
      '<button data-v="" class="' + (scoreState.segment ? '' : 'active') + '">重置</button>' +
      segs.map(([label]) =>
        '<button data-v="' + label + '" class="' + (label === scoreState.segment ? 'active' : '') + '">' + label + '</button>').join('');
  }

  function refreshScoreFilters() {
    const items = scoreItems();
    const types = [...new Set(items.map(s => s.type).filter(Boolean))];
    const dists = [...new Set(items.map(s => s.district).filter(Boolean))].sort();
    if (!types.includes(scoreState.type)) scoreState.type = '';
    if (!dists.includes(scoreState.district)) scoreState.district = '';
    if (!boardingModes.includes(scoreState.boarding)) scoreState.boarding = '';
    $('scoreType').innerHTML = '<option value="">全部类型</option>' +
      types.map(t => '<option value="' + escapeHtml(t) + '"' + (t === scoreState.type ? ' selected' : '') + '>' + escapeHtml(t) + '</option>').join('');
    $('scoreDistrict').innerHTML = '<option value="">全部区域</option>' +
      dists.map(d => '<option value="' + escapeHtml(d) + '"' + (d === scoreState.district ? ' selected' : '') + '>' + escapeHtml(d) + '</option>').join('');
    $('scoreType').value = scoreState.type;
    $('scoreDistrict').value = scoreState.district;
    $('scoreCategory').value = scoreState.category;
    $('scoreBoarding').value = scoreState.boarding;
  }

  function renderScores() {
    if (scoreState.batch !== 'batch3' && !window.SCORES_DATA && !(window.SCORES_PARTS && window.SCORES_PARTS[scoreState.batch]) && !scoreBatchFailed[scoreState.batch]) {
      if ($('scoreList')) $('scoreList').innerHTML = '<div class="empty">正在加载本批次分数线…</div>';
      ensureScoreBatch(scoreState.batch, function () { renderScores(); });
      return;
    }
    SCORES = assembleScores();
    renderScoreMeta();
    syncSharedControls();
    document.querySelectorAll('#scoreBatch button').forEach(b => b.classList.toggle('active', b.dataset.v === scoreState.batch));
    renderScoreNote();
    syncScoreFold();
    const isBatch3 = scoreState.batch === 'batch3';
    $('scoreFilters').style.display = isBatch3 ? 'none' : '';
    $('scorePanel').style.display = isBatch3 ? 'none' : '';
    if (isBatch3) {
      $('scoreTags').hidden = true;
      renderCompareDock();
      writeUrl();
      return;
    }
    if (!SCORES) {
      $('scoreSummary').innerHTML = '';
      $('scoreList').innerHTML = '<div class="empty">没有分数线数据</div>';
      renderScoreTags();
      renderCompareDock();
      writeUrl();
      return;
    }
    if (SCORES.verifyStatus === 'pending') {
      $('scoreSummary').innerHTML = '';
      $('scoreList').innerHTML = '<div class="empty">' + escapeHtml(String(SCORES.targetYear || PRODUCT_TARGET_YEAR)) +
        '年分数线' + escapeHtml(VERIFY_STATUS_LABEL.pending) + '，暂未收录可比对数据。</div>';
      renderScoreTags();
      renderScoreSide();
      renderCompareDock();
      writeUrl();
      return;
    }
    refreshScoreFilters();
    renderScoreSide();
    const items = filteredScores();
    const vals = items.flatMap(s => scoreValues(s)).filter(n => typeof n === 'number');
    const kind = (items[0] && SCORE_KINDS.indexOf(items[0].scoreKind) >= 0) ? items[0].scoreKind : '待标注';
    let range = '';
    if (vals.length) {
      const lo = Math.min(...vals);
      const hi = Math.max(...vals);
      range = scoreState.district
        ? '，该区' + escapeHtml(kind) + ' <b>' + lo + '</b>～<b>' + hi + '</b>'
        : '，分数 <b>' + lo + '</b>～<b>' + hi + '</b>（' + escapeHtml(kind) + '）';
    }
    $('scoreSummary').innerHTML = '👤 共<b>' + items.length + '</b>所学校' + range;
    $('scoreList').innerHTML = (items.length ? items.map(scoreCardHtml).join('') : '<div class="empty">没有符合条件的学校</div>') +
      '<footer>' + $('footer').innerHTML + '</footer>';
    $('scoreList').scrollTop = 0;
    renderScoreTags();
    renderCompareDock();
    writeUrl();
  }

  function renderCurrent() {
    const view = currentView();
    if (view === 'fee') renderFee();
    else if (view === 'scores') renderScores();
    else render();
  }

  function directEstimate(v) {
    return { point: v, low: v, high: v, source: 'direct', riskPreset: 'conservative' };
  }

  function setMyScore(raw) {
    const text = String(raw ?? '').trim();
    const v = parseInt(text, 10);
    if (text !== '' && Number.isFinite(v)) {
      shared.myScore = directEstimate(v);
      lsSet('zzzs.myScore', JSON.stringify(shared.myScore));
    } else {
      shared.myScore = null;
      lsDel('zzzs.myScore');
    }
    if (myNum() == null) {
      if (state.sort === 'gap') state.sort = 'score';
      if (scoreState.sort === 'gap') scoreState.sort = 'score';
    }
    const shown = myNum() == null ? '' : String(myNum());
    ['myScore', 'scoreMy', 'feeMy'].forEach(id => {
      const el = $(id);
      if (el && document.activeElement !== el) el.value = shown;
    });
    renderCurrent();
  }

  function applyStoredScore() {
    const stored = lsGet('zzzs.myScore');
    if (stored == null || stored === '') return;
    if (stored.charAt(0) === '{') {
      try {
        const obj = JSON.parse(stored);
        if (obj && typeof obj.point === 'number') {
          shared.myScore = obj;
          if (!shared.myScore.riskPreset) shared.myScore.riskPreset = 'conservative';
          return;
        }
      } catch (e) { /* 旧版纯数字 */ }
    }
    const v = parseInt(stored, 10);
    if (Number.isFinite(v)) shared.myScore = directEstimate(v);
  }

  function parseEst(raw) {
    const parts = String(raw || '').split('.');
    if (parts.length < 5) return null;
    const point = parseInt(parts[0], 10);
    const low = parseInt(parts[1], 10);
    const high = parseInt(parts[2], 10);
    if (![point, low, high].every(Number.isFinite)) return null;
    const source = { e: 'final', '1': 'mock1', '2': 'mock2', d: 'direct' }[parts[3]] || 'direct';
    const riskPreset = { c: 'conservative', n: 'neutral', o: 'optimistic' }[parts[4]] || 'conservative';
    return { point: point, low: low, high: high, source: source, riskPreset: riskPreset };
  }

  function readUrl() {
    const p = new URLSearchParams(location.search);
    if (p.has('est')) {
      const est = parseEst(p.get('est'));
      if (est) {
        shared.myScore = est;
        lsSet('zzzs.myScore', JSON.stringify(est));
      } else applyStoredScore();
    } else if (p.has('my')) {
      const raw = (p.get('my') || '').trim();
      const v = parseInt(raw, 10);
      if (raw !== '' && Number.isFinite(v)) {
        shared.myScore = directEstimate(v);
        lsSet('zzzs.myScore', JSON.stringify(shared.myScore));
      } else applyStoredScore();
    } else applyStoredScore();
    shared.onlyReach = p.get('reach') === '1';
    if (p.get('zcat') === '二类') state.category = '二类';
    const ztrack = p.get('ztrack');
    if (ztrack === '理工科技' || ztrack === '人文社科') state.track = ztrack;
    const subjects = SUBJECTS[state.track] || SUBJECTS['全部'];
    const zsub = p.get('zsub');
    if (zsub && zsub !== '全部' && subjects.includes(zsub)) state.subject = zsub;
    const zown = p.get('zown');
    if (zown === '公办' || zown === '民办') state.ownership = zown;
    const zdist = p.get('zdist');
    if (zdist && districts.includes(zdist)) state.district = zdist;
    const zseg = p.get('zseg');
    if (zseg && (SEGMENTS[state.category] || []).some(x => x[0] === zseg)) state.segment = zseg;
    if (p.get('zq')) state.keyword = p.get('zq');
    const zsort = p.get('zsort');
    if (zsort === 'plan' || zsort === 'gap') state.sort = zsort;
    const zboard = p.get('zboard');
    if (zboard && boardingModes.includes(zboard)) state.boarding = zboard;
    if (p.get('zview') === 'project') state.projectView = true;

    const sbatch = p.get('sbatch');
    if (sbatch === 'batch1' || sbatch === 'batch2' || sbatch === 'second' || sbatch === 'batch3') scoreState.batch = sbatch;
    const batchItems = scoreBatchItems(scoreState.batch);
    const typeOpts = [...new Set(batchItems.map(s => s.type).filter(Boolean))];
    const stype = p.get('stype');
    if (stype && typeOpts.includes(stype)) scoreState.type = stype;
    const scat = p.get('scat');
    if (scat === 'AC' || scat === 'D' || scat === 'ACD') scoreState.category = scat;
    const distOpts = [...new Set(batchItems.map(s => s.district).filter(Boolean))];
    const sdist = p.get('sdist');
    if (sdist && distOpts.includes(sdist)) scoreState.district = sdist;
    const segTable = SCORE_SEGMENTS[scoreState.batch];
    const sseg = p.get('sseg');
    if (sseg && segTable && segTable.some(x => x[0] === sseg)) scoreState.segment = sseg;
    if (p.get('sq')) scoreState.keyword = p.get('sq');
    const ssort = p.get('ssort');
    if (ssort === 'plan' || ssort === 'gap') scoreState.sort = ssort;
    const sboard = p.get('sboard');
    if (sboard && boardingModes.includes(sboard)) scoreState.boarding = sboard;

    const fown = p.get('fown');
    if (fown === '公办' || fown === '民办') fee.ownership = fown;
    if (p.has('ftype')) {
      const ft = p.get('ftype');
      if (ft === 'all') fee.type = '';
      else if (feeTypes.includes(ft)) fee.type = ft;
    }
    const fdist = p.get('fdist');
    if (fdist && feeDistricts.includes(fdist)) fee.district = fdist;
    const fsort = p.get('fsort');
    if (fsort === 'tuition-desc' || fsort === 'name' || fsort === 'total3-asc' || fsort === 'total3-desc') fee.sort = fsort;
    if (p.get('fq')) fee.keyword = p.get('fq');
    if (myNum() == null) {
      if (state.sort === 'gap') state.sort = 'score';
      if (scoreState.sort === 'gap') scoreState.sort = 'score';
    }
  }

  function switchView(view) {
    document.querySelectorAll('#nav button').forEach(b => b.classList.toggle('active', b.dataset.view === view));
    $('view-zzzs').hidden = view !== 'zzzs';
    $('view-fee').hidden = view !== 'fee';
    $('view-scores').hidden = view !== 'scores';
    $('view-guide').hidden = view !== 'guide';
    document.querySelector('.app').classList.toggle('fixed', view === 'zzzs' || view === 'scores' || view === 'fee' || view === 'guide');
    if (view === 'fee') renderFee();
    else if (view === 'scores') renderScores();
    else if (view === 'guide') {
      if (typeof window.renderTimeline === 'function') window.renderTimeline();
      if (typeof window.renderGuide === 'function') window.renderGuide();
      writeUrl();
    } else render();
    window.scrollTo(0, 0);
  }

  function handleResultClick(e) {
    const cmp = e.target.closest('.cmp-btn');
    if (cmp) {
      if (!cmp.disabled && cmp.dataset.cmp) toggleCompare(cmp.dataset.cmp);
      return;
    }
    if (e.target.closest('a')) return;
    const feeLink = e.target.closest('.fee-link');
    if (feeLink) {
      Object.assign(fee, { ownership: '', type: '', district: '', keyword: feeLink.dataset.fee || '' });
      switchView('fee');
      return;
    }
    const head = e.target.closest('.card-head, .stats');
    if (head && head.parentElement) head.parentElement.classList.toggle('open');
  }

  function toggleCompare(name) {
    const i = compareNames.indexOf(name);
    if (i >= 0) compareNames.splice(i, 1);
    else if (compareNames.length >= 3) return;
    else compareNames.push(name);
    saveCompare();
    refreshCompareButtons();
    renderCompareDock();
  }

  function clearZzzsTag(key) {
    if (key === 'own') state.ownership = '';
    else if (key === 'dist') state.district = '';
    else if (key === 'track') { state.track = '全部'; state.subject = '全部'; }
    else if (key === 'sub') state.subject = '全部';
    else if (key === 'seg') state.segment = null;
    else if (key === 'q') state.keyword = '';
    else if (key === 'board') state.boarding = '';
    else if (key === 'reach') shared.onlyReach = false;
    else if (key === 'view') state.projectView = false;
    else return;
    render();
  }
  function clearScoreTag(key) {
    if (key === 'type') scoreState.type = '';
    else if (key === 'cat') scoreState.category = '';
    else if (key === 'dist') scoreState.district = '';
    else if (key === 'seg') scoreState.segment = null;
    else if (key === 'q') scoreState.keyword = '';
    else if (key === 'board') scoreState.boarding = '';
    else if (key === 'reach') shared.onlyReach = false;
    else return;
    renderScores();
  }
  function clearFeeTag(key) {
    if (key === 'own') fee.ownership = '';
    else if (key === 'type') fee.type = '普高';
    else if (key === 'dist') fee.district = '';
    else if (key === 'q') fee.keyword = '';
    else return;
    renderFee();
  }

  const boardHtml = '<option value="">住宿不限</option>' +
    boardingModes.map(m => '<option value="' + escapeHtml(m) + '">' + escapeHtml(m) + '</option>').join('');
  $('district').insertAdjacentHTML('beforeend', districts.map(d => '<option>' + escapeHtml(d) + '</option>').join(''));
  $('boarding').innerHTML = boardHtml;
  $('scoreBoarding').innerHTML = boardHtml;
  $('feeType').innerHTML = '<option value="">全部类型</option>' +
    feeTypes.map(t => '<option>' + escapeHtml(t) + '</option>').join('');
  $('feeDistrict').insertAdjacentHTML('beforeend',
    [...feeDistricts].sort().map(d => '<option>' + escapeHtml(d) + '</option>').join(''));

  $('zzzsFoldToggle').addEventListener('click', () => {
    state.filtersOpen = !state.filtersOpen;
    syncZzzsFold();
  });
  $('categorySeg').addEventListener('click', e => {
    const v = e.target.closest('button')?.dataset.v;
    if (!v || v === state.category) return;
    Object.assign(state, { category: v, track: '全部', subject: '全部', segment: null });
    render();
  });
  $('trackTabs').addEventListener('click', e => {
    const v = e.target.closest('button')?.dataset.v;
    if (!v) return;
    Object.assign(state, { track: v, subject: '全部' });
    render();
  });
  $('subjectChips').addEventListener('click', e => {
    const v = e.target.closest('button')?.dataset.v;
    if (!v) return;
    state.subject = v;
    render();
  });
  $('side').addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    state.segment = b.dataset.v || null;
    render();
  });
  $('ownership').addEventListener('change', e => { state.ownership = e.target.value; renderList(); });
  $('district').addEventListener('change', e => { state.district = e.target.value; renderList(); });
  $('boarding').addEventListener('change', e => {
    state.boarding = boardingModes.includes(e.target.value) ? e.target.value : '';
    renderList();
  });
  $('zzzsSort').addEventListener('change', e => {
    state.sort = e.target.value === 'plan' || e.target.value === 'gap' ? e.target.value : 'score';
    renderList();
  });
  $('keyword').addEventListener('input', e => { state.keyword = e.target.value; renderList(); });
  $('myScore').addEventListener('input', e => setMyScore(e.target.value));
  $('onlyReach').addEventListener('change', e => { shared.onlyReach = e.target.checked; renderCurrent(); });
  $('projectViewBtn').addEventListener('click', () => {
    if (state.category !== '一类') return;
    state.projectView = !state.projectView;
    render();
  });
  $('zzzsTags').addEventListener('click', e => {
    const key = e.target.closest('.filter-tag')?.dataset.k;
    if (key) clearZzzsTag(key);
  });
  $('list').addEventListener('click', handleResultClick);

  $('nav').addEventListener('click', e => {
    const v = e.target.closest('button')?.dataset.view;
    if (v) switchView(v);
  });
  $('feeFoldToggle').addEventListener('click', () => {
    fee.filtersOpen = !fee.filtersOpen;
    syncFeeFold();
  });
  $('feeOwnership').addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    fee.ownership = b.dataset.v;
    renderFee();
  });
  $('feeType').addEventListener('change', e => { fee.type = e.target.value; renderFee(); });
  $('feeDistrict').addEventListener('change', e => { fee.district = e.target.value; renderFee(); });
  $('feeSort').addEventListener('change', e => { fee.sort = e.target.value; renderFee(); });
  $('feeKeyword').addEventListener('input', e => { fee.keyword = e.target.value; renderFee(); });
  $('feeMy').addEventListener('input', e => setMyScore(e.target.value));
  $('feeTags').addEventListener('click', e => {
    const key = e.target.closest('.filter-tag')?.dataset.k;
    if (key) clearFeeTag(key);
  });
  $('feeList').addEventListener('click', e => {
    if (e.target.closest('a')) return;
    const head = e.target.closest('.card-head, .stats');
    if (head && head.parentElement) head.parentElement.classList.toggle('open');
  });

  $('scoreBatch').addEventListener('click', e => {
    const v = e.target.closest('button')?.dataset.v;
    if (!v) return;
    scoreState.batch = v;
    scoreState.keyword = '';
    scoreState.segment = null;
    scoreState.noteOpen = false;
    $('scoreKeyword').value = '';
    renderScores();
  });
  $('scoreFoldToggle').addEventListener('click', () => {
    scoreState.filtersOpen = !scoreState.filtersOpen;
    syncScoreFold();
  });
  $('scoreNoteToggle').addEventListener('click', () => {
    scoreState.noteOpen = !scoreState.noteOpen;
    renderScoreNote();
  });
  $('scoreSide').addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    scoreState.segment = b.dataset.v || null;
    renderScores();
  });
  $('scoreType').addEventListener('change', e => { scoreState.type = e.target.value; renderScores(); });
  $('scoreCategory').addEventListener('change', e => { scoreState.category = e.target.value; renderScores(); });
  $('scoreDistrict').addEventListener('change', e => { scoreState.district = e.target.value; renderScores(); });
  $('scoreBoarding').addEventListener('change', e => {
    scoreState.boarding = boardingModes.includes(e.target.value) ? e.target.value : '';
    renderScores();
  });
  $('scoreSort').addEventListener('change', e => {
    scoreState.sort = e.target.value === 'plan' || e.target.value === 'gap' ? e.target.value : 'score';
    renderScores();
  });
  $('scoreKeyword').addEventListener('input', e => { scoreState.keyword = e.target.value; renderScores(); });
  $('scoreMy').addEventListener('input', e => setMyScore(e.target.value));
  $('scoreOnlyReach').addEventListener('change', e => { shared.onlyReach = e.target.checked; renderCurrent(); });
  $('scoreTags').addEventListener('click', e => {
    const key = e.target.closest('.filter-tag')?.dataset.k;
    if (key) clearScoreTag(key);
  });
  $('scoreList').addEventListener('click', handleResultClick);
  $('compareDock').addEventListener('click', e => {
    const t = e.target.closest('[data-act], [data-remove]');
    if (!t) return;
    if (t.dataset.act === 'toggle') {
      compareOpen = !compareOpen;
      renderCompareDock();
      return;
    }
    if (t.dataset.act === 'clear') {
      compareNames = [];
      compareOpen = false;
      saveCompare();
      refreshCompareButtons();
      renderCompareDock();
      return;
    }
    if (t.dataset.remove) {
      compareNames = compareNames.filter(n => n !== t.dataset.remove);
      if (!compareNames.length) compareOpen = false;
      saveCompare();
      refreshCompareButtons();
      renderCompareDock();
    }
  });

  function unofficialTag(sourceType) {
    return sourceType === 'unofficial' ? ' <span class="tag unofficial">非官方</span>' : '';
  }

  function verifyStatusLabel(status) {
    return (status && VERIFY_STATUS_LABEL[status]) ? VERIFY_STATUS_LABEL[status] : '';
  }

  function verifyStatusTag(status) {
    const label = verifyStatusLabel(status);
    return label ? ' <span class="tag verify">' + escapeHtml(label) + '</span>' : '';
  }

  function sourceAnchor(url, title, sourceType) {
    if (!url) return '来源链接缺失';
    return unofficialTag(sourceType) +
      '<a href="' + escapeHtml(url) + '" target="_blank" rel="noopener">' + escapeHtml(title || '官方来源') + '</a>';
  }

  function freshnessBits(obj) {
    if (!obj) return '数据未加载';
    const vs = obj.verifyStatus;
    if (vs === 'pending') {
      const y = obj.targetYear || PRODUCT_TARGET_YEAR;
      return escapeHtml(String(y)) + '年 · ' + escapeHtml(VERIFY_STATUS_LABEL.pending);
    }
    const year = obj.year != null && String(obj.year) !== '' ? escapeHtml(String(obj.year)) + '年' : '年份缺失';
    const at = obj.fetchedAt ? '抓取 ' + escapeHtml(String(obj.fetchedAt)) : '抓取时间缺失';
    const vsLabel = verifyStatusLabel(vs);
    const ref = vsLabel ? ' · ' + escapeHtml(vsLabel) : '';
    return year + ' · ' + at + ref;
  }

  function recordSourceTags(item) {
    if (!item) return '';
    return unofficialTag(item.sourceType) + verifyStatusTag(item.verifyStatus);
  }

  function scoreSourceLinks() {
    if (!SCORES || !SCORES.sources) return '来源链接缺失';
    return Object.keys(SCORES.sources).map(key => {
      const item = SCORES.sources[key];
      return sourceAnchor(item && item.url, item && item.title, item && item.sourceType);
    }).join('、');
  }

  function renderProvenance() {
    const zSrc = DATA && DATA.source;
    const feeUrl = DATA && DATA.publicFeeStandard && DATA.publicFeeStandard.source;
    $('zzzsMeta').innerHTML = '自主招生 ' + freshnessBits(DATA) + verifyStatusTag(DATA.verifyStatus) + ' · ' +
      sourceAnchor(zSrc && zSrc.url, zSrc && zSrc.title, DATA.sourceType);
    $('feeMeta').innerHTML = '收费依据 ' + freshnessBits(DATA) + verifyStatusTag(DATA.verifyStatus) + ' · ' +
      sourceAnchor(feeUrl, '市发改委收费标准', 'official');
    $('guideMeta').innerHTML = '自主招生 ' + freshnessBits(DATA) + verifyStatusTag(DATA.verifyStatus) + ' · ' +
      sourceAnchor(zSrc && zSrc.url, '教育局通知', DATA.sourceType) +
      '<br>录取分数线 ' + freshnessBits(SCORES) + verifyStatusTag(SCORES && SCORES.verifyStatus) + ' · ' + scoreSourceLinks();
    const attach = zSrc && zSrc.attachments && zSrc.attachments.length
      ? '附件：' + zSrc.attachments.map(a => sourceAnchor(a.url, a.name, 'official')).join('、') + '。<br>'
      : '';
    $('footer').innerHTML = '自主招生：' + freshnessBits(DATA) + verifyStatusTag(DATA.verifyStatus) + ' · ' +
      sourceAnchor(zSrc && zSrc.url, zSrc && zSrc.title, DATA.sourceType) +
      (zSrc && zSrc.publishedAt ? '（' + escapeHtml(zSrc.publishedAt) + '）' : '') + '<br>' + attach +
      (DATA.profileSource ? '区域与办学介绍：' + sourceAnchor(DATA.profileSource.url, DATA.profileSource.title, 'official') + '。<br>' : '') +
      '录取分数线：' + freshnessBits(SCORES) + verifyStatusTag(SCORES && SCORES.verifyStatus) + ' · ' + scoreSourceLinks() + '<br>' +
      (feeUrl ? '公办收费标准：' + sourceAnchor(feeUrl, '市发改委', 'official') + '。<br>' : '') +
      '自招控制线、名额分配控制线、第一批录取分数线含义不同，请勿混用；收费以学校公示原文为准。<br>' +
      escapeHtml(BRAND_DISCLAIMER);
    renderScoreMeta();
  }

  function renderScoreMeta() {
    const src = SCORES && SCORES.sources && SCORES.sources[scoreState.batch];
    $('scoreMeta').innerHTML = '录取分数线 ' + freshnessBits(SCORES) + verifyStatusTag(SCORES && SCORES.verifyStatus) + ' · ' +
      (src ? sourceAnchor(src.url, src.title, src.sourceType) : '来源链接缺失');
  }

  function syncPresetButtons() {
    const cur = (shared.myScore && shared.myScore.riskPreset) || (window.MAPPING_V1 && window.MAPPING_V1.defaultPreset) || 'conservative';
    document.querySelectorAll('#presetRow button').forEach(b => b.classList.toggle('active', b.dataset.preset === cur));
  }

  function fillEstimator() {
    const m = window.MAPPING_V1;
    if (!m || !$('mockType')) return;
    $('mockType').innerHTML = Object.keys(m.mockTypes).map(k =>
      '<option value="' + escapeHtml(k) + '">' + escapeHtml(m.mockTypes[k].label) + '</option>').join('');
    $('presetRow').innerHTML = Object.keys(m.presets).map(k =>
      '<button type="button" data-preset="' + escapeHtml(k) + '">' + escapeHtml(m.presets[k].label) + '</button>').join('');
    syncPresetButtons();
  }

  function showRecoModal() {
    if (recoAcked() || !$('recoMask')) return;
    $('recoMask').classList.add('show');
  }

  function poolMarkdown(result) {
    function lines(title, rows) {
      if (!rows.length) return '### ' + title + '\n\n（本档不足）\n';
      return '### ' + title + '\n\n' + rows.map(r => '- ' + r.name + ' · ' + (r.line != null ? r.line : r.control)).join('\n') + '\n';
    }
    return '# 志愿池草稿（' + (result.preset || 'conservative') + '）\n\n' +
      '若自招录取则后续批次作废。本表不是官方志愿表，档位不是录取概率。\n\n' +
      lines('冲（最多 2）', result.chong) + '\n' +
      lines('稳（最多 3）', result.wen) + '\n' +
      lines('保（最多 2）', result.bao) + '\n' +
      lines('自招备选（最多 1）', result.zzzs.map(z => ({ name: z.name, control: z.control }))) + '\n' +
      (result.rejected.length ? '### 未纳入\n\n' + result.rejected.slice(0, 8).map(r => '- ' + r.name + '：' + r.reason + '（' + r.ruleId + '）').join('\n') : '');
  }

  function openPool() {
    if (!recoAcked()) { showRecoModal(); return; }
    ensureScoreBatch('batch1', function () {
      SCORES = assembleScores();
      const est = shared.myScore && typeof shared.myScore === 'object' ? shared.myScore : null;
      if (!est || !window.Reco) {
        $('poolSheet').textContent = '请先填写中考分，或用平时分估算。';
        $('poolMask').classList.add('show');
        return;
      }
      const batch1 = ((SCORES && SCORES.schools) || []).filter(s => s.batch === 'batch1').map(s => {
        const nums = (s.scores || []).map(x => x.score).filter(n => typeof n === 'number');
        return { name: s.name, category: s.category, line: nums.length ? Math.min.apply(null, nums) : null, fee3: null };
      });
      const zzzsPicks = (DATA.schools || []).filter(s => s.category === state.category).filter(s => {
        const nums = (s.scores || []).map(x => x.score).filter(n => typeof n === 'number');
        const control = nums.length ? Math.min.apply(null, nums) : null;
        return control != null && myNum() != null && myNum() >= control;
      }).slice(0, 1).map(s => {
        const nums = s.scores.map(x => x.score);
        return { name: s.name, control: Math.min.apply(null, nums) };
      });
      const budget = parseInt(($('budgetYuan') && $('budgetYuan').value) || '', 10);
      shared.budget = Number.isFinite(budget) ? budget : null;
      const result = window.Reco.pool({
        estimate: est,
        category: scoreState.category,
        budget: shared.budget,
        zzzsPicks: zzzsPicks,
        batch1: batch1,
      });
      const md = poolMarkdown(result);
      $('poolSheet').innerHTML = '<pre>' + escapeHtml(md) + '</pre>';
      $('poolSheet').dataset.md = md;
      $('poolMask').classList.add('show');
    });
  }

  fillEstimator();
  if ($('mockApply')) {
    $('mockApply').addEventListener('click', () => {
      if (!window.Reco) return;
      const est = window.Reco.estimate($('mockType').value, $('mockScore').value);
      if (!est) return;
      est.riskPreset = 'conservative';
      shared.myScore = est;
      lsSet('zzzs.myScore', JSON.stringify(est));
      syncPresetButtons();
      showRecoModal();
      renderCurrent();
    });
  }
  if ($('presetRow')) {
    $('presetRow').addEventListener('click', e => {
      const preset = e.target.closest('button') && e.target.closest('button').dataset.preset;
      if (!preset || !shared.myScore || typeof shared.myScore !== 'object') return;
      if (preset !== 'conservative') {
        const ok = window.confirm('切换到中性或乐观会抬高用来对照的分数，可能高估可达学校。档位不是录取概率。确定切换？');
        if (!ok) return;
      }
      shared.myScore.riskPreset = preset;
      lsSet('zzzs.myScore', JSON.stringify(shared.myScore));
      syncPresetButtons();
      renderCurrent();
      if ($('poolMask').classList.contains('show')) openPool();
    });
  }
  if ($('openPool')) $('openPool').addEventListener('click', openPool);
  if ($('closePool')) $('closePool').addEventListener('click', () => $('poolMask').classList.remove('show'));
  if ($('recoAck')) $('recoAck').addEventListener('click', () => {
    try { sessionStorage.setItem('zzzs.recoAck', '1'); } catch (e) { /* 忽略 */ }
    $('recoMask').classList.remove('show');
    renderCurrent();
  });
  if ($('copyPool')) $('copyPool').addEventListener('click', () => {
    const md = $('poolSheet').dataset.md || '';
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(md);
  });
  if ($('printPool')) $('printPool').addEventListener('click', () => window.print());
  ['myScore', 'scoreMy', 'feeMy'].forEach(id => {
    const el = $(id);
    if (!el) return;
    el.addEventListener('change', () => { if (el.value.trim()) showRecoModal(); });
  });

  renderProvenance();
  readUrl();
  renderFeeStandard();
  render();
  if (location.hash === '#guide') switchView('guide');
  else if (location.hash === '#fee') switchView('fee');
  else if (location.hash === '#scores') switchView('scores');
  allowUrlWrite = true;
  writeUrl();
})();
