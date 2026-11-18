(function () {
  const RULES = window.ZZZS_RULES || [];

  const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const src = window.ZZZS_DATA && window.ZZZS_DATA.source;

  document.getElementById('rulesBody').innerHTML = RULES.map(sec =>
    `<h3>${esc(sec.title)}</h3><dl>${sec.items.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>`
  ).join('') + `<div class="src">以上内容依据${src
    ? `<a href="${esc(src.url)}" target="_blank" rel="noopener">${esc(src.title)}</a>（${esc(src.publishedAt || '')}）`
    : '深圳市教育局自主招生通知'}整理，如有出入以官方文件和学校简章为准。</div>`;

  document.getElementById('rulesBody').insertAdjacentHTML('beforeend', `<div class="calc" id="scoreCalc">
      <h3>合成总分</h3>
      <p>各折百分制，中考 60% + 考核 40%。这只说明排序规则，不表示一定录取。满分由你填写。</p>
      <div class="filters">
        <input id="calcExam" type="number" inputmode="decimal" step="any" placeholder="中考原始分">
        <input id="calcExamMax" type="number" inputmode="decimal" step="any" placeholder="中考满分">
        <input id="calcAssess" type="number" inputmode="decimal" step="any" placeholder="考核分">
        <input id="calcAssessMax" type="number" inputmode="decimal" step="any" placeholder="考核满分">
      </div>
      <div class="result" id="calcResult"></div>
    </div>`);
  const readCalc = (id) => {
    const raw = document.getElementById(id).value.trim();
    if (raw === '') return NaN;
    return Number(raw);
  };
  const updateCalc = () => {
    const exam = readCalc('calcExam');
    const examMax = readCalc('calcExamMax');
    const assess = readCalc('calcAssess');
    const assessMax = readCalc('calcAssessMax');
    const nums = [exam, examMax, assess, assessMax];
    const box = document.getElementById('calcResult');
    if (nums.some(n => !Number.isFinite(n)) || nums.some(n => n < 0) || !(examMax > 0) || !(assessMax > 0)) {
      box.textContent = '四项都要填，且为不小于 0 的数字，满分要大于 0。';
      return;
    }
    const total = (exam / examMax) * 60 + (assess / assessMax) * 40;
    let text = total.toFixed(2);
    if (exam > examMax || assess > assessMax) text += ' 有分数超过所填满分，请核对。';
    box.textContent = text;
  };
  ['calcExam', 'calcExamMax', 'calcAssess', 'calcAssessMax'].forEach(id => {
    document.getElementById(id).addEventListener('input', updateCalc);
  });
  updateCalc();

  const mask = document.getElementById('rulesMask');
  const open = () => { mask.classList.add('show'); document.body.style.overflow = 'hidden'; };
  const close = () => { mask.classList.remove('show'); document.body.style.overflow = ''; };
  document.getElementById('openRules').addEventListener('click', open);
  document.getElementById('closeRules').addEventListener('click', close);
  mask.addEventListener('click', e => { if (e.target === mask) close(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  if (location.hash === '#rules') open();
})();
