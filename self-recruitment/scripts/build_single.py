"""把 index.html 与数据 JS 合并成一个独立 HTML，便于通过微信等直接发送。

用法：
    python scripts/build_single.py            # 输出 dist/深圳自主招生选校.html
    python scripts/build_single.py --refresh  # 先重新抓取官方数据再打包
"""

import argparse
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TAGS = [
    ('<script src="data/zzzs-data.js"></script>', ROOT / "data" / "zzzs-data.js"),
    ('<script src="data/scores-data.js"></script>', ROOT / "data" / "scores-data.js"),
]


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--refresh", action="store_true", help="打包前先运行 fetch_data.py 与 fetch_scores.py")
    ap.add_argument("--out", default=str(ROOT / "dist" / "深圳自主招生选校.html"))
    args = ap.parse_args()

    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")

    if args.refresh:
        subprocess.run([sys.executable, str(ROOT / "scripts" / "fetch_data.py")], check=True)
        subprocess.run([sys.executable, str(ROOT / "scripts" / "fetch_scores.py")], check=True)

    page = (ROOT / "index.html").read_text(encoding="utf-8")
    for tag, path in TAGS:
        if not path.exists():
            raise SystemExit(f"缺少 {path}，请先运行对应抓取脚本")
        if tag not in page:
            raise SystemExit(f"index.html 中未找到 {tag}")
        data = path.read_text(encoding="utf-8").replace("</", "<\\/")
        page = page.replace(tag, f"<script>\n{data}</script>")

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(page, encoding="utf-8")
    print(f"已生成 {out}（{out.stat().st_size / 1024:.0f} KB）")


if __name__ == "__main__":
    main()
