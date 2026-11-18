"""把 index.html、样式、页面脚本与数据 JS 合并成一个独立 HTML，便于通过微信等直接发送。

用法：
    python scripts/build_single.py            # 输出 dist/深圳自主招生选校.html
    python scripts/build_single.py --refresh  # 先重新抓取官方数据再打包
"""

import argparse
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
# (页面中的标签, 源文件, style 或 script)
ASSETS = [
    ('<link rel="stylesheet" href="css/style.css">', ROOT / "css" / "style.css", "style"),
    ('<script src="js/app.js"></script>', ROOT / "js" / "app.js", "script"),
    ('<script src="js/changelog.js"></script>', ROOT / "js" / "changelog.js", "script"),
    ('<script src="data/changelog-data.js"></script>', ROOT / "data" / "changelog-data.js", "script"),
    ('<script src="js/timeline.js"></script>', ROOT / "js" / "timeline.js", "script"),
    ('<script src="js/rules-data.js"></script>', ROOT / "js" / "rules-data.js", "script"),
    ('<script src="js/guide.js"></script>', ROOT / "js" / "guide.js", "script"),
    ('<script src="js/rules.js"></script>', ROOT / "js" / "rules.js", "script"),
    ('<script src="data/timeline-data.js"></script>', ROOT / "data" / "timeline-data.js", "script"),
    ('<script src="data/zzzs-data.js"></script>', ROOT / "data" / "zzzs-data.js", "script"),
    ('<script src="data/scores-meta.js"></script>', ROOT / "data" / "scores-meta.js", "script"),
    ('<script src="data/mapping-data.js"></script>', ROOT / "data" / "mapping-data.js", "script"),
    ('<script src="js/reco.js"></script>', ROOT / "js" / "reco.js", "script"),
]


def require_fetched_at(path):
    """构建失败：数据 JS 须含非空 fetchedAt（V1-P0-03）。"""
    text = path.read_text(encoding="utf-8")
    match = re.search(r'"fetchedAt"\s*:\s*"([^"]*)"', text)
    if not match or not match.group(1).strip():
        raise SystemExit(f"构建失败：{path.name} 缺少有效 fetchedAt")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--refresh", action="store_true", help="打包前先运行 fetch_data.py 与 fetch_scores.py")
    ap.add_argument("--lazy", action="store_true", help="不内嵌全量 scores-data.js，保留按批次加载")
    ap.add_argument("--out", default=str(ROOT / "dist" / "深圳自主招生选校.html"))
    args = ap.parse_args()

    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")

    if args.refresh:
        subprocess.run([sys.executable, str(ROOT / "scripts" / "fetch_data.py")], check=True)
        subprocess.run([sys.executable, str(ROOT / "scripts" / "fetch_scores.py")], check=True)

    for name in ("zzzs-data.js", "scores-meta.js"):
        require_fetched_at(ROOT / "data" / name)
    subprocess.run([sys.executable, str(ROOT / "scripts" / "check_score_schema.py")], check=True)
    subprocess.run([sys.executable, str(ROOT / "scripts" / "check_verify_schema.py")], check=True)
    subprocess.run([sys.executable, str(ROOT / "scripts" / "check_school_links.py")], check=True)

    page = (ROOT / "index.html").read_text(encoding="utf-8")
    full_tag = "<!--SCORES_FULL-->"
    if full_tag not in page:
        raise SystemExit("index.html 中未找到 <!--SCORES_FULL-->")
    if args.lazy:
        page = page.replace(full_tag, "")
    else:
        score_js = (ROOT / "data" / "scores-data.js").read_text(encoding="utf-8").replace("</", "<\\/")
        page = page.replace(full_tag, "<script>\n" + score_js + "</script>")
    for tag, path, kind in ASSETS:
        if not path.exists():
            raise SystemExit(f"缺少 {path}")
        if tag not in page:
            raise SystemExit(f"index.html 中未找到 {tag}")
        data = path.read_text(encoding="utf-8").replace("</", "<\\/")
        if kind == "style":
            page = page.replace(tag, f"<style>\n{data}</style>")
        else:
            page = page.replace(tag, f"<script>\n{data}</script>")

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(page, encoding="utf-8")
    print(f"已生成 {out}（{out.stat().st_size / 1024:.0f} KB）")


if __name__ == "__main__":
    main()
