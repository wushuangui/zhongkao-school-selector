# 品牌与设计令牌（D-4）

本仓库目前只有「深圳普高自主招生选校」一个可部署子应用。下列令牌是兄弟应用要对齐的同一份来源，不要另起主色或免责声明。

| 令牌 | 位置 | 值 |
|------|------|----|
| 产品标题 | `self-recruitment/index.html` `<title>` | 深圳普高自主招生选校 |
| `theme-color` | 同文件 meta | `#4d86ff`（与页头渐变起点一致） |
| `--blue` | `self-recruitment/css/style.css` `:root` | `#2f6bff` |
| `--blue-light` | 同上 | `#eaf1ff` |
| `--text` / `--sub` / `--bg` / `--line` | 同上 | 见文件 |
| 页脚免责声明句 | `js/app.js` 常量 `BRAND_DISCLAIMER` | 本站整理公开招生信息，不构成录取承诺；以教育局、招考网及学校简章为准。 |

使用方式：改颜色只改 `:root` 与 `theme-color`；改免责声明只改 `BRAND_DISCLAIMER`，并保持与本文件表格一致。主标题保持「深圳普高自主招生选校」。
