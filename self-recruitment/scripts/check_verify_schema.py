"""校验 verifyStatus / sourceType 四值与二值枚举；derivedFields 非空仅 warn。"""

from __future__ import annotations

import json
import sys
from pathlib import Path

VERIFY_STATUSES = frozenset({"verified-history", "reference-2026", "verified-2027", "pending"})
SOURCE_TYPES = frozenset({"official", "unofficial"})

ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parent
HISTORY = REPO / "data" / "history"


def _bad(msg: str) -> None:
    print(f"FAIL: {msg}")


def _check_enum(field: str, value, path: str) -> bool:
    allowed = VERIFY_STATUSES if field == "verifyStatus" else SOURCE_TYPES
    if value not in allowed:
        _bad(f"{path} {field}={value!r}")
        return False
    return True


def _warn_derived(where: str, obj: dict) -> None:
    df = obj.get("derivedFields")
    if df:
        print(f"WARN derivedFields: {where} → {df}")


def validate_scores(path: Path) -> bool:
    data = json.loads(path.read_text(encoding="utf-8"))
    ok = True
    loc = path.name
    for key in ("verifyStatus", "sourceType"):
        if key not in data:
            _bad(f"{loc} 根缺少 {key}")
            ok = False
        elif not _check_enum(key, data[key], loc):
            ok = False
    for src_key, src in (data.get("sources") or {}).items():
        if isinstance(src, dict) and src.get("sourceType") and not _check_enum(
            "sourceType", src["sourceType"], f"{loc} sources.{src_key}"
        ):
            ok = False
    for i, school in enumerate(data.get("schools") or []):
        for key in ("verifyStatus", "sourceType"):
            if key not in school:
                _bad(f"{loc} schools[{i}] {school.get('name')} 缺少 {key}")
                ok = False
            elif not _check_enum(key, school[key], f"{loc} schools[{i}]"):
                ok = False
        _warn_derived(f"{loc} schools[{i}] {school.get('name')}", school)
    return ok


def validate_zzzs(path: Path) -> bool:
    data = json.loads(path.read_text(encoding="utf-8"))
    ok = True
    loc = path.name
    for key in ("verifyStatus", "sourceType"):
        if key not in data:
            _bad(f"{loc} 根缺少 {key}")
            ok = False
        elif not _check_enum(key, data[key], loc):
            ok = False
    for i, school in enumerate(data.get("schools") or []):
        for key in ("verifyStatus", "sourceType"):
            if key not in school:
                _bad(f"{loc} schools[{i}] {school.get('name')} 缺少 {key}")
                ok = False
            elif not _check_enum(key, school[key], f"{loc} schools[{i}]"):
                ok = False
        _warn_derived(f"{loc} schools[{i}] {school.get('name')}", school)
    return ok


def validate_timeline(path: Path) -> bool:
    data = json.loads(path.read_text(encoding="utf-8"))
    ok = True
    loc = path.name
    for key in ("verifyStatus", "sourceType"):
        if key not in data:
            _bad(f"{loc} 根缺少 {key}")
            ok = False
        elif not _check_enum(key, data[key], loc):
            ok = False
    for i, node in enumerate(data.get("nodes") or []):
        for key in ("verifyStatus", "sourceType"):
            if key not in node:
                _bad(f"{loc} nodes[{i}] {node.get('id')} 缺少 {key}")
                ok = False
            elif not _check_enum(key, node[key], f"{loc} nodes[{i}]"):
                ok = False
    return ok


def validate_history(path: Path) -> bool:
    data = json.loads(path.read_text(encoding="utf-8"))
    ok = True
    loc = path.name
    meta = data.get("meta") or {}
    for key in ("verifyStatus", "sourceType"):
        if key not in meta:
            _bad(f"{loc} meta 缺少 {key}")
            ok = False
        elif not _check_enum(key, meta[key], f"{loc} meta"):
            ok = False
    for i, rec in enumerate(data.get("records") or []):
        for key in ("verifyStatus", "sourceType"):
            if key not in rec:
                _bad(f"{loc} records[{i}] 缺少 {key}")
                ok = False
            elif not _check_enum(key, rec[key], f"{loc} records[{i}]"):
                ok = False
        _warn_derived(f"{loc} records[{i}] {rec.get('schoolName')}", rec)
    return ok


def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")

    ok = True
    for pattern in ("scores-*.json", "zzzs-*.json", "timeline-*.json"):
        for path in sorted((ROOT / "data").glob(pattern)):
            if pattern.startswith("scores"):
                ok = validate_scores(path) and ok
            elif pattern.startswith("zzzs"):
                ok = validate_zzzs(path) and ok
            else:
                ok = validate_timeline(path) and ok

    if HISTORY.is_dir():
        for path in sorted(HISTORY.glob("first-batch-*.json")):
            ok = validate_history(path) and ok
    else:
        print("WARN: 未找到 data/history/，跳过 history 校验")

    if ok:
        print("OK: verifyStatus / sourceType 校验通过")
        return 0
    return 1


if __name__ == "__main__":
    sys.exit(main())