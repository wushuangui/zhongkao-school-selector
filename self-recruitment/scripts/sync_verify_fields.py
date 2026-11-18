"""幂等为 self-recruitment 与 history JSON 补全 verifyStatus / sourceType，并再生派生 JS。"""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parent
DATA = ROOT / "data"
HISTORY = REPO / "data" / "history"

PRODUCT_TARGET_YEAR = 2027
UNOFFICIAL_SCORE_BATCHES = frozenset({"mee"})


def status_for_app_year(year: int) -> str:
    if year < 2026:
        return "verified-history"
    if year == 2026:
        return "reference-2026"
    if year == PRODUCT_TARGET_YEAR:
        return "pending"
    return "reference-2026"


def source_type_score_batch(batch: str | None) -> str:
    return "unofficial" if batch in UNOFFICIAL_SCORE_BATCHES else "official"


def enrich_sources(sources: dict) -> None:
    for key, src in (sources or {}).items():
        if not isinstance(src, dict):
            continue
        if key in UNOFFICIAL_SCORE_BATCHES:
            src.setdefault("sourceType", "unofficial")
        else:
            src.setdefault("sourceType", "official")


def enrich_scores(data: dict) -> None:
    year = int(data.get("year") or 2026)
    vs = status_for_app_year(year)
    data.setdefault("targetYear", PRODUCT_TARGET_YEAR)
    data.setdefault("verifyStatus", vs)
    data.setdefault("sourceType", "official")
    enrich_sources(data.get("sources"))
    for school in data.get("schools") or []:
        batch = school.get("batch")
        school.setdefault("verifyStatus", vs)
        school.setdefault("sourceType", source_type_score_batch(batch))


def enrich_zzzs(data: dict) -> None:
    year = int(data.get("year") or 2026)
    vs = status_for_app_year(year)
    data.setdefault("targetYear", PRODUCT_TARGET_YEAR)
    data.setdefault("verifyStatus", vs)
    data.setdefault("sourceType", "official")
    for school in data.get("schools") or []:
        school.setdefault("verifyStatus", vs)
        school.setdefault("sourceType", "official")


def enrich_timeline(data: dict) -> None:
    year = int(data.get("year") or 2026)
    vs = status_for_app_year(year)
    data.setdefault("targetYear", PRODUCT_TARGET_YEAR)
    data.setdefault("verifyStatus", vs)
    data.setdefault("sourceType", "official")
    for node in data.get("nodes") or []:
        node.setdefault("verifyStatus", vs)
        node.setdefault("sourceType", "official")


def write_js(json_path: Path, var: str, js_path: Path, header: str) -> None:
    data = json.loads(json_path.read_text(encoding="utf-8"))
    js_path.write_text(
        header + f"window.{var} = " + json.dumps(data, ensure_ascii=False, indent=2) + ";\n",
        encoding="utf-8",
    )


def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")

    scores = DATA / "scores-2026.json"
    if scores.exists():
        doc = json.loads(scores.read_text(encoding="utf-8"))
        enrich_scores(doc)
        scores.write_text(json.dumps(doc, ensure_ascii=False, indent=2), encoding="utf-8")
        write_js(
            scores,
            "SCORES_DATA",
            DATA / "scores-data.js",
            "// 由 scripts/sync_verify_fields.py 根据 scores-*.json 生成，请勿手改\n",
        )
        subprocess.run([sys.executable, str(ROOT / "scripts" / "split_scores.py")], check=True)

    zzzs = DATA / "zzzs-2026.json"
    if zzzs.exists():
        doc = json.loads(zzzs.read_text(encoding="utf-8"))
        enrich_zzzs(doc)
        zzzs.write_text(json.dumps(doc, ensure_ascii=False, indent=2), encoding="utf-8")
        write_js(
            zzzs,
            "ZZZS_DATA",
            DATA / "zzzs-data.js",
            "// 由 scripts/sync_verify_fields.py 根据 zzzs-*.json 生成，请勿手改\n",
        )

    for year, var, js_name in (
        (2026, "TIMELINE_DATA", "timeline-data.js"),
        (2027, "TIMELINE_DATA_2027", "timeline-2027-data.js"),
    ):
        tl = DATA / f"timeline-{year}.json"
        if not tl.exists():
            continue
        doc = json.loads(tl.read_text(encoding="utf-8"))
        enrich_timeline(doc)
        tl.write_text(json.dumps(doc, ensure_ascii=False, indent=2), encoding="utf-8")
        write_js(
            tl,
            var,
            DATA / js_name,
            f"/* 与 data/timeline-{year}.json 内容一致，供页面同步加载，避免运行时请求。 */\n",
        )

    print("sync_verify_fields: JSON / JS 已更新")
    return 0


if __name__ == "__main__":
    sys.exit(main())