# Layer 1 硬约束样例（V2-P0-04）

模块：`self-recruitment/js/reco.js` 的 `Reco.layer1`。校验脚本：`self-recruitment/scripts/check_reco_fixtures.py`（与 JS 使用同一组输入输出）。

不实现 D 类简版。类别只按调用方传入的 AC / D / ACD 过滤。

| 样例 | 输入要点 | 期望 |
|------|----------|------|
| one-project | 两所自招且分数都超过控制分 | 只保留第 1 所；第 2 所拒绝，原因含「只能报 1 所学校的 1 个项目」 |
| below-control | 自招控制分 500，比较分 480 | 拒绝，规则 `R-CTRL` |
| category | 用户选 AC，学校为 D | 拒绝，规则 `R-ACD` |
| budget | 预算 10000，三年费用 20000 | 拒绝，规则 `R-BUDGET` |
| keep | AC、无预算、分数达到控制分 | `kept` 含该校 |

文案与 `rules-data.js` 中「只能报 1 所学校的 1 个项目」「控制分（中考成绩控制线）」一致。
