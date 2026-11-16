"""抓取深圳市 2026 年中考各批次分数线 / 控制线，生成 scores-*.json 与 scores-data.js。

数据源：
  - 名额分配控制线：《考生报考指导手册》附件 2（PDF）
  - 第一批 / 第二批录取分数线：本地宝中考分数线专题页（结构化 HTML，与市教育局公布结果一致）
  - 第二次划线：官方《第二次划线录取计划》PDF 中的资格线；实际录取分数线官方以图片公布，脚本保存图片链接供页面查阅
  - 第三批：部省属及跨市中职，由省考试院组织，本页提供说明与查询入口

用法：
    python scripts/fetch_scores.py
"""

from __future__ import annotations

import argparse
import html
import json
import re
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

try:
    from pypdf import PdfReader
except ImportError:
    raise SystemExit("请先安装：pip install pypdf")

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
RAW_DIR = DATA_DIR / "raw" / "scores"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130 Safari/537.36"

HANDBOOK_URL = "https://imgbdb3.bendibao.com/szbdb/edu/20265/29/2026529154210_87805.pdf"
LUQU_URL = "http://sz.bendibao.com/edu/luqufenshu/"
SECOND_PLAN_URL = "https://szeb.sz.gov.cn/attachment/1/1735/1735048/12913724.pdf"

SOURCES = {
    "mee": {
        "title": "2026年深圳市高中阶段学校考生报考指导手册（名额分配招生计划表）",
        "url": HANDBOOK_URL,
        "note": "控制线按前三年同类录取线均值降 20 分划定，仅用于名额分配批次，不能当作第一批志愿参考。",
    },
    "batch1": {
        "title": "深圳市2026年高中阶段学校第一批录取分数线公布",
        "url": "https://szeb.sz.gov.cn/szzkw/qt/tzgg/content/post_12909874.html",
        "note": "普通高中统招（除自招、名额分配外）及部分中职/技工试点专业。",
    },
    "batch2": {
        "title": "深圳市2026年高中阶段学校第二批录取分数线公布",
        "url": "https://szeb.sz.gov.cn/szzkw/zkgg/zkxx/content/post_12909892.html",
        "note": "本市中等职业学校及技工院校（除第一批试点专业外）。",
    },
    "second": {
        "title": "深圳市2026年高中阶段学校第二次划线录取分数线公布",
        "url": "https://szeb.sz.gov.cn/szzkw/zkgg/zkxx/content/post_12919057.html",
        "planUrl": SECOND_PLAN_URL,
        "note": "资格线是填报门槛；实际录取分数线 ≥ 资格线，由投档产生。官方实际录取分数线以公告图片为准。",
    },
    "batch3": {
        "title": "第三批（部省属及跨市中等职业学校）",
        "url": "https://szeb.sz.gov.cn/szzkw/zkfw/index.html",
        "note": "由广东省教育考试院组织录取，学校与分数线以省考试院及深圳招考网当期公告为准。",
    },
}


def http_get(url: str, referer: str | None = None) -> bytes:
    headers = {"User-Agent": UA}
    headers["Referer"] = referer or ("https://sz.bendibao.com/" if "bendibao" in url else "https://szeb.sz.gov.cn/")
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=60) as resp:
        return resp.read()


def strip_html(s: str) -> str:
    return html.unescape(re.sub(r"<[^>]+>", "", s)).strip()


def clean_mee_name(name: str) -> str:
    return re.sub(r"（[一二]）|\([一二]\)", "", name).strip()


def parse_mee(pdf_path: Path):
    reader = PdfReader(str(pdf_path))
    # 附件 2 通常集中在含“名额分配录取控制线”的页面
    chunks = []
    for p in reader.pages:
        t = p.extract_text() or ""
        if "名额分配录取控制线" in t and "深圳中学" in t:
            chunks.append(t)
    text = "\n".join(chunks) or "\n".join((p.extract_text() or "") for p in reader.pages)
    items = []
    for _, name, plan, score in re.findall(r"(?m)^\s*(\d+)\s+(.+?)\s+(\d+)\s+(\d+)\s*$", text):
        name = name.strip()
        if "留学" in name or "ACD" in name:
            cat = "ACD"
        elif name.endswith("（二）") or name.endswith("(二)"):
            cat = "D"
        else:
            cat = "AC"
        items.append({
            "batch": "mee",
            "name": clean_mee_name(name),
            "rawName": name,
            "ownership": "公办",
            "type": "普高",
            "category": cat,
            "plan": int(plan),
            "scoreKind": "控制线",
            "scores": [{"label": f"{cat}类控制线", "score": int(score)}],
            "district": None,
        })
    return items


def parse_luqu(html_text: str):
    batch1, batch2 = [], []
    for m in re.finditer(r"<ul>(.*?)</ul>", html_text, re.S):
        block = m.group(1)
        if "school_name" not in block or "score_line" not in block:
            continue
        name_m = re.search(r'class="school_name"[^>]*>(.*?)</p>', block, re.S)
        if not name_m:
            continue
        type_m = re.search(r'class="school_xueli"[^>]*>(.*?)</span>', block, re.S)
        area_m = re.search(r"所在区域</span>\s*<span[^>]*>(.*?)</span>", block, re.S)
        scores = []
        for sm in re.finditer(
            r'class="score_line"[^>]*>\s*<span>(.*?)</span>\s*<span class="score">(.*?)</span>',
            block,
            re.S,
        ):
            label, val = strip_html(sm.group(1)), strip_html(sm.group(2))
            label = label.replace("分数线", "").strip()
            if re.fullmatch(r"\d+", val):
                scores.append({"label": label, "score": int(val)})
        if not scores:
            continue
        labels = " ".join(s["label"] for s in scores)
        school_type = strip_html(type_m.group(1)) if type_m else ""
        item = {
            "name": strip_html(name_m.group(1)),
            "ownership": None,
            "type": school_type or ("中职" if "第二批" in labels or "试点专业" in labels else "普高"),
            "category": None,
            "plan": None,
            "scoreKind": "录取线",
            "scores": scores,
            "district": strip_html(area_m.group(1)) if area_m else None,
        }
        if "第二批" in labels:
            item["batch"] = "batch2"
            item["type"] = school_type or "中职"
            batch2.append(item)
        else:
            item["batch"] = "batch1"
            if "试点专业" in labels:
                item["type"] = school_type or "中职"
            batch1.append(item)
    return batch1, batch2


def parse_second_round(pdf_path: Path):
    reader = PdfReader(str(pdf_path))
    text = "\n".join((p.extract_text() or "") for p in reader.pages)
    items = []
    # 8310314 深圳市罗湖区华美外国语学校 民办 普高 312 255 全住宿 ACD类
    pat = re.compile(
        r"(83\d{5})\s+(.+?)\s+(公办|民办(?:（中\s*外合作）)?)\s+(普高|中职|中技|高技)\s+(\d+)\s+(\d+)\s+"
        r"(全住宿|部分住宿|走读)\s+(ACD类|AC类|D类)"
    )
    for m in pat.finditer(re.sub(r"\s+", " ", text)):
        code, name, ownership, school_type, plan, score, boarding, scope = m.groups()
        ownership = "民办" if "民办" in ownership else "公办"
        name = re.sub(r"\s+", "", name)
        items.append({
            "batch": "second",
            "code": code,
            "name": name,
            "ownership": ownership,
            "type": school_type,
            "category": scope.replace("类", ""),
            "plan": int(plan),
            "scoreKind": "资格线",
            "scores": [{"label": f"{scope}资格线", "score": int(score)}],
            "boardingMode": boarding,
            "district": None,
        })
    return items, text


def collect_official_images(page_url: str, prefix: str):
    page = http_get(page_url).decode("utf-8", "replace")
    imgs = sorted(set(re.findall(r"https://szeb\.sz\.gov\.cn/img/[^\"]+\.png", page)))
    saved = []
    for i, url in enumerate(imgs, 1):
        path = RAW_DIR / f"{prefix}_{i}.png"
        if not path.exists():
            path.write_bytes(http_get(url))
        saved.append({"url": url, "file": path.name})
    return saved


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--year", type=int, default=2026)
    args = ap.parse_args()
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")

    RAW_DIR.mkdir(parents=True, exist_ok=True)
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    print("下载报考指导手册…")
    handbook = http_get(HANDBOOK_URL)
    (RAW_DIR / "handbook-2026.pdf").write_bytes(handbook)
    mee = parse_mee(RAW_DIR / "handbook-2026.pdf")
    print(f"名额分配：{len(mee)} 条")

    print("抓取第一批 / 第二批分数线…")
    luqu_path = RAW_DIR / "luqufenshu.html"
    luqu = None
    for url in (LUQU_URL, "https://sz.bendibao.com/edu/luqufenshu/", "https://sz.bendibao.com/edu/luqufenshu/?year="):
        try:
            luqu = http_get(url).decode("utf-8", "replace")
            if "深圳中学" in luqu and "score_line" in luqu:
                break
            luqu = None
        except Exception as e:
            print(f"  尝试 {url} 失败：{e}")
    if not luqu:
        cached = Path(__import__("os").environ["TEMP"]) / "zzzs" / "scores" / "luqu.html"
        if cached.exists():
            print(f"  改用缓存：{cached}")
            luqu = cached.read_text(encoding="utf-8", errors="replace")
        else:
            raise SystemExit("无法获取第一批/第二批分数线页面")
    luqu_path.write_text(luqu, encoding="utf-8")
    batch1, batch2 = parse_luqu(luqu)
    print(f"第一批：{len(batch1)} 所；第二批：{len(batch2)} 所")

    print("下载第二次划线录取计划…")
    plan = http_get(SECOND_PLAN_URL)
    (RAW_DIR / "second-round-plan.pdf").write_bytes(plan)
    second, _ = parse_second_round(RAW_DIR / "second-round-plan.pdf")
    print(f"第二次划线资格线：{len(second)} 所")

    print("归档官方分数线原图…")
    images = {
        "batch1": collect_official_images(SOURCES["batch1"]["url"], "batch1"),
        "batch2": collect_official_images(SOURCES["batch2"]["url"], "batch2"),
        "second": collect_official_images(SOURCES["second"]["url"], "second"),
    }
    for k, v in images.items():
        print(f"  {k}: {len(v)} 张")

    schools = mee + batch1 + batch2 + second
    result = {
        "year": args.year,
        "fetchedAt": datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds"),
        "sources": SOURCES,
        "images": images,
        "schools": schools,
        "batch3Note": SOURCES["batch3"],
    }
    payload = json.dumps(result, ensure_ascii=False, indent=2)
    (DATA_DIR / f"scores-{args.year}.json").write_text(payload, encoding="utf-8")
    (DATA_DIR / "scores-data.js").write_text(
        "// 由 scripts/fetch_scores.py 自动生成，请勿手改\nwindow.SCORES_DATA = " + payload + ";\n",
        encoding="utf-8",
    )
    print(f"已写入 {DATA_DIR / f'scores-{args.year}.json'} 和 scores-data.js（共 {len(schools)} 条）")


if __name__ == "__main__":
    main()
