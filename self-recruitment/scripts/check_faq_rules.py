"""规则与 FAQ 同源校验（V1-P0-04）。

条文只写在 self-recruitment/js/rules-data.js 的 window.ZZZS_RULES。
js/rules.js 用它画「规则说明」；js/guide.js 用它画填报指南「常见问答」。
改规则时只改 rules-data.js，FAQ 会跟着变，不要在 guide.js 再抄一份问答。

本脚本确认：
- ZZZS_RULES 至少 8 条（标题 + 说明）
- rules.js 与 guide.js 都读取 window.ZZZS_RULES
- guide.js 不再声明 FAQ / MYTHS 第二份数组
- 页面在 guide.js 之前加载 rules-data.js

用法：python self-recruitment/scripts/check_faq_rules.py
"""

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = (ROOT / "js" / "rules-data.js").read_text(encoding="utf-8")
RULES = (ROOT / "js" / "rules.js").read_text(encoding="utf-8")
GUIDE = (ROOT / "js" / "guide.js").read_text(encoding="utf-8")
HTML = (ROOT / "index.html").read_text(encoding="utf-8")


def fail(msg):
    print("FAIL:", msg)
    sys.exit(1)


pairs = re.findall(r"\['[^']+',\s*'[^']+'\]", DATA)
if len(pairs) < 8:
    fail(f"ZZZS_RULES 只有 {len(pairs)} 条，需要至少 8 条")
if "window.ZZZS_RULES" not in DATA:
    fail("rules-data.js 未导出 window.ZZZS_RULES")
if "window.ZZZS_RULES" not in RULES:
    fail("rules.js 未读取 window.ZZZS_RULES")
if "window.ZZZS_RULES" not in GUIDE:
    fail("guide.js 未读取 window.ZZZS_RULES")
if re.search(r"\b(?:const|let|var)\s+(?:FAQ|MYTHS)\b", GUIDE):
    fail("guide.js 含独立 FAQ/MYTHS，会与规则分叉")
if 'id="faq-' not in GUIDE and "id=\"faq-" not in GUIDE and "'#faq-" not in GUIDE and '"#faq-' not in GUIDE:
    if "#faq-" not in GUIDE:
        fail("guide.js 未生成 #faq- 锚点")
data_at = HTML.find('src="js/rules-data.js"')
guide_at = HTML.find('src="js/guide.js"')
rules_at = HTML.find('src="js/rules.js"')
if data_at < 0 or guide_at < 0 or not (data_at < guide_at < rules_at or data_at < rules_at):
    fail("index.html 须在 guide.js 与 rules.js 之前加载 rules-data.js")
if data_at > guide_at:
    fail("rules-data.js 必须排在 guide.js 之前")

print(f"OK: {len(pairs)} rule rows shared with FAQ")
