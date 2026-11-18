# 校名归一与 supplement 运营 SOP（V1-P0-07）

## 文件

| 文件 | 作用 |
|------|------|
| `data/school-aliases.json` | 仓库级别名。`fetch_data.py`、`fetch_scores.py`、`check_school_links.py` 都会读取。 |
| `self-recruitment/data/supplement.json` | 按**官方附件校名**补充区域、细分项目。别名只用于关联，不要把 supplement 的键改成简称除非附件原文就是简称。 |

## 提交流程

1. 在简章或招考网核对校名，与 `zzzs-*.json` 里的 `name` 完全一致后，再写入 `supplement.json`。
2. 若分数线表校名不同，把两边都写入 `data/school-aliases.json` 的同一条 `aliases`（含 canonical）。
3. 确认暂时对不上、且不是录入错误的，写入 `knownUnlinked` 并写明原因。不要用它藏新的录入错误。
4. 运行 `python self-recruitment/scripts/check_school_links.py`。默认失败退出；仅排障时可 `set LINK_CHECK=warn`（PowerShell：`$env:LINK_CHECK='warn'`）。
5. 重新运行 `fetch_data.py` 后抽检。

## QA 抽检 10 校

每次发版至少核对 10 所：深圳中学、深圳实验学校（高中部）、红岭中学、育才中学、高级中学、外国语学校、深中龙岗、宝安中学、市二高、一所民办。核对项：自招校名、分数线表是否关联、`supplement` 项目人数是否仍与简章一致、二类是否仍分体育/艺术控制分。
