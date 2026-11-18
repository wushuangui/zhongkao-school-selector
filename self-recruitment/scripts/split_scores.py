"""把 scores-YYYY.json 拆成首屏用的 meta 与按 batch 加载的 JS。不访问网络。"""

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"


def main():
    files = sorted(DATA.glob("scores-*.json"))
    if not files:
        raise SystemExit("缺少 scores-*.json")
    data = json.loads(files[-1].read_text(encoding="utf-8"))
    schools = data.get("schools") or []
    meta = {k: v for k, v in data.items() if k != "schools"}
    meta_js = "// 由 scripts/split_scores.py 生成，请勿手改\nwindow.SCORES_META = " + json.dumps(
        meta, ensure_ascii=False
    ) + ";\n"
    (DATA / "scores-meta.js").write_text(meta_js, encoding="utf-8")
    batches = {}
    for school in schools:
        batches.setdefault(school.get("batch") or "unknown", []).append(school)
    for batch, rows in batches.items():
        body = (
            "// 由 scripts/split_scores.py 生成，请勿手改\n"
            "window.SCORES_PARTS = window.SCORES_PARTS || {};\n"
            "window.SCORES_PARTS[" + json.dumps(batch) + "] = "
            + json.dumps(rows, ensure_ascii=False)
            + ";\n"
        )
        (DATA / f"scores-batch-{batch}.js").write_text(body, encoding="utf-8")
        print(f"{batch}: {len(rows)}")
    print(f"meta {DATA / 'scores-meta.js'}")


if __name__ == "__main__":
    main()
