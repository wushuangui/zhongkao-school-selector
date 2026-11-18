# 升学季数据发版 Runbook

政策发布后目标在 24–72 小时内完成静态发版。无订阅后端（D-1）。更新说明写入 `data/changelog.json`，由页面「更新公告」展示；触达靠公众号、社群和 Pages，不在站内做推送。

## 1. 监测

升学季（约 5–7 月报名填报、7–8 月补录）每日看深圳市教育局通知与深圳招考网。只采用已在 `timeline-2026.json` 或规则条文里出现的节点，不新编官方日期。

## 2. 抓取

```text
python self-recruitment/scripts/fetch_data.py
python self-recruitment/scripts/fetch_scores.py
python self-recruitment/scripts/split_scores.py
```

或 `self-recruitment/deploy.ps1 -Refresh`（会抓取；拆分需在抓取后执行 `split_scores.py`）。

## 3. QA

- `python self-recruitment/scripts/check_score_schema.py`：每条学校记录有 `scoreKind`（资格线 / 录取线 / 控制线），文件有 `year`。
- `python self-recruitment/scripts/check_school_links.py`：无法关联的校名会列出；未登记则阻断。
- `python self-recruitment/scripts/check_faq_rules.py`
- 样本：二类至少 1 所核对体育、艺术两个控制分；民办至少 1 所核对收费公示；三线对照至少 1 所同时看自招控制分、名额分配控制线、第一批录取线，三者不得混用。
- 抽检校名见 `docs/sop-school-supplement.md`（10 校）。

## 4. 发布

更新 `data/changelog.json` 后合入主分支。GitHub Actions（`.github/workflows/deploy-pages.yml`）部署 Pages。社群单文件：

```text
python self-recruitment/scripts/build_single.py
python self-recruitment/scripts/build_single.py --lazy
```

默认打入全量 `scores-data.js`。`--lazy` 不打入全量，页面按批次加载 `scores-batch-*.js`。

## 5. 回滚

JSON 与生成的 JS 都在 Git 中。回滚到上一提交后重新跑工作流。保留上一年度 `scores-YYYY.json` / `zzzs-YYYY.json`，不要覆盖历史文件。

## 首屏与懒加载（V2-P0-06）

Pages 的 `index.html` 不引用全量 `scores-data.js`，只引用 `scores-meta.js`。打开「录取分数线」才请求当前批次的 `data/scores-batch-<batch>.js`。目标：4G 网络、约 4GB 内存的中端安卓机，首屏（自主招生列表）可交互 &lt; 3 秒。全量单文件仍用 `build_single.py`（不加 `--lazy`）。
