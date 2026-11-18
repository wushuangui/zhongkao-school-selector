"""用仓库级 data/school-aliases.json 检查自招校名能否关联到分数线表。

默认失败（阻断发版）。LINK_CHECK=warn 时只打印报告并以 0 退出。
knownUnlinked 中的校名会列入报告，但不算新的阻断项。
"""

import json
import os
import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
DATA = REPO / "self-recruitment" / "data"
ALIAS_PATH = REPO / "data" / "school-aliases.json"


def norm(name: str) -> str:
    return re.sub(r"[（）()\s·]|^深圳市?", "", name or "")


def groups(alias_doc):
    mapped = {}
    for row in alias_doc.get("aliases") or []:
        names = [row.get("canonical") or ""] + list(row.get("aliases") or [])
        names = [n for n in names if n]
        for n in names:
            mapped.setdefault(n, set()).update(names)
    return mapped


def main():
    mode = os.environ.get("LINK_CHECK", "fail").strip().lower()
    alias_doc = json.loads(ALIAS_PATH.read_text(encoding="utf-8"))
    mapped = groups(alias_doc)
    known = {row["name"] for row in alias_doc.get("knownUnlinked") or []}
    zzzs_files = sorted(DATA.glob("zzzs-*.json"))
    score_files = sorted(DATA.glob("scores-*.json"))
    if not zzzs_files or not score_files:
        print("FAIL: 缺少 zzzs 或 scores json")
        return 1
    zzzs = json.loads(zzzs_files[-1].read_text(encoding="utf-8"))
    scores = json.loads(score_files[-1].read_text(encoding="utf-8"))
    score_norms = {norm(s.get("name")) for s in scores.get("schools") or []}
    missing = []
    seen = set()
    for school in zzzs.get("schools") or []:
        name = school.get("name") or ""
        if name in seen:
            continue
        seen.add(name)
        cands = mapped.get(name, {name})
        if any(norm(c) in score_norms for c in cands):
            continue
        missing.append(name)
    fresh = [n for n in missing if n not in known]
    print(f"别名组 {len(alias_doc.get('aliases') or [])}；无法关联 {len(missing)}；其中未登记 {len(fresh)}")
    for n in missing:
        mark = "已知" if n in known else "未登记"
        print(f"  - [{mark}] {n}")
    if fresh and mode != "warn":
        print("FAIL: 存在未登记的无法关联校名")
        return 1
    if mode == "warn" and fresh:
        print("WARN: LINK_CHECK=warn，未阻断")
    print("OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
