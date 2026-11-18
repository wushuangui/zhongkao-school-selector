/* 预估分、档位、Layer 1。系数只读 window.MAPPING_V1。 */
(function () {
  const ONE_SCHOOL = '只能报 1 所学校的 1 个项目';
  const CTRL = '考生中考成绩不得低于此分数才能参与该校自主招生录取排序';

  function mapping() {
    return window.MAPPING_V1 || null;
  }

  function round(n) {
    return Math.round(n);
  }

  function estimate(mockType, raw) {
    const m = mapping();
    const spec = m && m.mockTypes && m.mockTypes[mockType];
    const score = Number(raw);
    if (!spec || !Number.isFinite(score)) return null;
    const mu = spec.a * score + spec.b;
    const sigma = spec.sigma;
    return {
      point: round(mu),
      low: round(mu - sigma),
      high: round(mu + sigma),
      source: mockType,
      riskPreset: (m && m.defaultPreset) || 'conservative',
    };
  }

  function compareScore(est) {
    if (est == null || est === '') return null;
    if (typeof est === 'number') return est;
    const m = mapping();
    const preset = (m && m.presets && m.presets[est.riskPreset]) || { use: 'low' };
    const key = preset.use || 'low';
    const n = est[key];
    return typeof n === 'number' ? n : null;
  }

  function tier(est, line) {
    const m = mapping();
    const rule = (m && m.tierRules) || { id: 'R-TIER-1', field: 'scores.score' };
    const field = rule.field;
    if (!est || typeof line !== 'number') return null;
    if (est.high < line) return { label: '不推荐', ruleId: rule.id, field: field };
    if (est.low >= line) return { label: '保', ruleId: rule.id, field: field };
    if (est.point >= line) return { label: '稳', ruleId: rule.id, field: field };
    if (est.high >= line) return { label: '冲', ruleId: rule.id, field: field };
    return { label: '不推荐', ruleId: rule.id, field: field };
  }

  function layer1(ctx) {
    const rejected = [];
    const kept = [];
    const score = ctx.score;
    (ctx.zzzsPicks || []).forEach((p, i) => {
      if (i > 0) {
        rejected.push({ name: p.name, ruleId: 'R-ONE', reason: ONE_SCHOOL });
        return;
      }
      if (score != null && p.control != null && score < p.control) {
        rejected.push({ name: p.name, ruleId: 'R-CTRL', reason: CTRL });
        return;
      }
      kept.push(p);
    });
    (ctx.batch1 || []).forEach(s => {
      if (ctx.category && s.category && s.category !== ctx.category) {
        rejected.push({ name: s.name, ruleId: 'R-ACD', reason: '不在所选考生类别筛选范围内' });
        return;
      }
      if (ctx.budget != null && s.fee3 != null && s.fee3 > ctx.budget) {
        rejected.push({ name: s.name, ruleId: 'R-BUDGET', reason: '超过预算上限' });
        return;
      }
      kept.push(s);
    });
    return { kept: kept, rejected: rejected };
  }

  function pool(ctx) {
    const filtered = layer1({
      score: compareScore(ctx.estimate),
      category: ctx.category || '',
      budget: ctx.budget,
      zzzsPicks: ctx.zzzsPicks || [],
      batch1: ctx.batch1 || [],
    });
    const buckets = { '冲': [], '稳': [], '保': [] };
    filtered.kept.forEach(s => {
      if (s.control != null && s.line == null) return;
      const line = s.line;
      if (typeof line !== 'number') return;
      const t = tier(ctx.estimate, line);
      if (t && buckets[t.label]) buckets[t.label].push(Object.assign({ tier: t }, s));
    });
    function take(label, n) {
      return buckets[label]
        .sort((a, b) => Math.abs(a.line - ctx.estimate.point) - Math.abs(b.line - ctx.estimate.point))
        .slice(0, n);
    }
    const zzzs = filtered.kept.filter(s => s.control != null).slice(0, 1);
    return {
      preset: ctx.estimate && ctx.estimate.riskPreset,
      chong: take('冲', 2),
      wen: take('稳', 3),
      bao: take('保', 2),
      zzzs: zzzs,
      rejected: filtered.rejected,
    };
  }

  window.Reco = { estimate: estimate, compareScore: compareScore, tier: tier, layer1: layer1, pool: pool };
})();
