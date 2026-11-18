"""从深圳市教育局官网下载普通高中自主招生计划附件（docx），并抓取深圳招考网“高中阶段学校介绍”
中的学校基本信息与收费标准，解析为 JSON / JS 数据文件。

用法：
    python scripts/fetch_data.py                      # 默认抓取 2026 年数据
    python scripts/fetch_data.py --url <通知页面URL> --profile-page <学校介绍页URL> --year 2027

只依赖 Python 3.8+ 标准库。
"""

import argparse
import html
import io
import json
import re
import sys
import urllib.parse
import urllib.request
import zipfile
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path

DEFAULT_URL = "https://szeb.sz.gov.cn/home/xxgk/flzy/wjtz/content/post_12833273.html"
DEFAULT_YEAR = 2026
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) zhongkao-school-selector"
W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
RAW_DIR = DATA_DIR / "raw"

DISTRICTS = ["福田", "罗湖", "南山", "盐田", "宝安", "龙岗", "龙华", "坪山", "光明", "大鹏", "深汕"]

DEFAULT_PROFILE_PAGE = "https://szeb.sz.gov.cn/szzkw/ztzl/gzjdxxbxtsjs2026/"
SEARCH_API = "https://search.gd.gov.cn/jsonp/sites"
BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36"

# 深圳市发改委公布的公办普通高中学费标准（元/生·学期），学校公示“按一费制标准执行”时据此按等级换算
PUBLIC_FEE_STANDARD = {
    "source": "https://fgw.sz.gov.cn/hdjl/ywzsk/jgzcgl/content/post_11674674.html",
    "tuition": {"一般学校": 905, "区一级学校": 996, "市一级学校": 1041, "省一级学校": 1131},
    "boarding": 450,
}


def http_get(url: str, headers=None) -> bytes:
    req = urllib.request.Request(url, headers=headers or {"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read()


def decode_html(raw: bytes) -> str:
    m = re.search(rb'charset=["\']?([\w-]+)', raw[:2048], re.I)
    enc = m.group(1).decode() if m else "utf-8"
    try:
        return raw.decode(enc)
    except (LookupError, UnicodeDecodeError):
        return raw.decode("utf-8", errors="replace")


def parse_notice(page_url: str):
    text = decode_html(http_get(page_url))
    title_m = re.search(r"<title>(.*?)</title>", text, re.S)
    title = html.unescape(title_m.group(1)).split("-")[0].strip() if title_m else ""
    date_m = re.search(r"(\d{4}-\d{2}-\d{2})\s*\d{2}:\d{2}", text)

    attachments = []
    seen = set()
    for href, label in re.findall(r'<a[^>]+href="([^"]+\.docx)"[^>]*>(.*?)</a>', text, re.S):
        label = re.sub(r"<[^>]+>", "", html.unescape(label)).strip()
        url = urllib.parse.urljoin(page_url, href)
        if "招生计划" not in label or url in seen:
            continue
        seen.add(url)
        ownership = "民办" if "民办" in label else "公办"
        attachments.append({"name": label, "url": url, "ownership": ownership})

    if not attachments:
        raise SystemExit("未在通知页面找到“自主招生计划”docx 附件，请确认 URL 是否正确。")
    return {
        "title": title,
        "url": page_url,
        "publishedAt": date_m.group(1) if date_m else None,
        "attachments": attachments,
    }


def cell_text(tc) -> str:
    parts = []
    for p in tc.iter(W + "p"):
        t = "".join(x.text or "" for x in p.iter(W + "t")).strip()
        if t and t not in parts:
            parts.append(t)
    return "；".join(parts)


def parse_docx(data: bytes):
    """返回 [(category, rows)]，category 取表格前最近一个包含“一类/二类”的段落。"""
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        root = ET.fromstring(z.read("word/document.xml"))
    body = root.find(W + "body")

    tables = []
    category = None
    for el in body:
        if el.tag == W + "p":
            t = "".join(x.text or "" for x in el.iter(W + "t")).strip()
            if "一类" in t:
                category = "一类"
            elif "二类" in t:
                category = "二类"
        elif el.tag == W + "tbl":
            rows = []
            merged = {}
            for tr in el.iter(W + "tr"):
                row = []
                for idx, tc in enumerate(tr.findall(W + "tc")):
                    text = cell_text(tc)
                    pr = tc.find(W + "tcPr")
                    vm = pr.find(W + "vMerge") if pr is not None else None
                    if vm is not None:
                        if vm.get(W + "val") == "restart":
                            merged[idx] = text
                        else:
                            text = merged.get(idx, text)
                    row.append(text)
                rows.append(row)
            tables.append((category, rows))
    return tables


def parse_scores(text: str):
    """'534' / '488（出国留学类400）' / '体育426、艺术454' -> [{label, score}]"""
    norm = text.replace("(", "（").replace(")", "）")
    main = re.match(r"^\s*(\d{3})", norm)
    scores = []
    if main:
        scores.append({"label": "", "score": int(main.group(1))})
    for label, score in re.findall(r"([\u4e00-\u9fa5]+?)类?\s*(\d{3})", norm):
        scores.append({"label": label, "score": int(score)})
    return scores


def guess_district(name: str):
    for d in DISTRICTS:
        if d in name:
            return d + "区" if d not in ("深汕",) else "深汕特别合作区"
    return None


def build_schools(notice, year: int):
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    schools = []
    for att in notice["attachments"]:
        print(f"下载附件：{att['name']}")
        data = http_get(att["url"])
        (RAW_DIR / f"{year}-{att['ownership']}.docx").write_bytes(data)

        for category, rows in parse_docx(data):
            if not rows or category is None:
                continue
            header = rows[0]
            col = {h: i for i, h in enumerate(header)}

            def pick(row, key, default=""):
                for h, i in col.items():
                    if key in h and i < len(row):
                        return row[i]
                return default

            for row in rows[1:]:
                name = pick(row, "学校名称")
                if not name:
                    continue
                score_text = pick(row, "控制线")
                scores = parse_scores(score_text)
                plan_text = pick(row, "计划数")
                schools.append({
                    "id": f"{year}-{att['ownership']}-{category}-{name}",
                    "name": name,
                    "ownership": att["ownership"],
                    "category": category,
                    "plan": int(plan_text) if plan_text.isdigit() else None,
                    "scoreText": score_text,
                    "scores": scores,
                    "brochure": pick(row, "简章"),
                    "scope": pick(row, "招生范围"),
                    "district": guess_district(name),
                    "projects": [],
                })
    return schools


def strip_html(text: str) -> str:
    text = re.sub(r"<br\s*/?>|</p>", "；", text or "", flags=re.I)
    text = html.unescape(re.sub(r"<[^>]+>", "", text))
    return re.sub(r"[；;\s]*$", "", re.sub(r"\s+", " ", text)).strip()


def brief_intro(raw: str, limit: int = 160) -> str:
    """从学校简介 HTML 抽出一句简略描述。纯图片简介没有可摘的文字，返回空字符串。"""
    if not raw:
        return ""
    text = re.sub(r"<img\b[^>]*>", "", raw, flags=re.I)
    text = strip_html(text).strip("；; \t")
    parts = [p.strip("；; \t") for p in text.split("；") if p.strip("；; \t")]
    if not parts:
        return ""
    # 第一段已经能读，就不再拼下一段；第一段只是口号时再补一段
    text = parts[0]
    if len(re.sub(r"\W", "", text, flags=re.U)) < 24 and len(parts) > 1:
        text = text + "；" + parts[1]
    text = re.sub(r"^(?:学校)?简介\s*[:：]\s*", "", text).strip()
    if len(re.sub(r"\W", "", text, flags=re.U)) < 12:
        return ""
    if len(text) <= limit:
        return text
    cut = text[:limit]
    for sep in ("。", "；", "，"):
        pos = cut.rfind(sep)
        if pos >= 40:
            return cut[: pos + 1]
    return cut.rstrip("；;，, ") + "…"


def fetch_profiles(page_url: str):
    """调用学校介绍页使用的广东政务搜索 JSONP 接口，返回全部学校的基本信息。"""
    page = decode_html(http_get(page_url, {"User-Agent": BROWSER_UA}))
    sites = re.search(r'sites:\s*"([\d,]+)"', page)
    cats = re.search(r'category_id:\s*"([\d,]+)"', page)
    if not (sites and cats):
        raise SystemExit("未能从学校介绍页解析出搜索接口参数，页面结构可能已变化。")

    headers = {"User-Agent": BROWSER_UA, "Referer": page_url, "Accept": "*/*"}
    results, page_no = [], 1
    while True:
        query = urllib.parse.urlencode({
            "calback": "success", "callback": "cb", "order": 1, "position": "all", "text": "",
            "page": page_no, "pagesize": 50, "including_link_doc": 1,
            "sites": sites.group(1), "category_id": cats.group(1), "json_ext_in": "{}",
        })
        raw = http_get(f"{SEARCH_API}?{query}", headers).decode("utf-8")
        body = re.search(r"^[^(]*\((.*)\)\s*;?\s*$", raw, re.S)
        data = json.loads(body.group(1) if body else raw)
        batch = data.get("results") or []
        results += batch
        if not batch or len(results) >= data.get("count", 0):
            break
        page_no += 1

    profiles = []
    for r in results:
        ext = json.loads(r.get("json_ext") or "{}")
        name = (ext.get("name") or r.get("title") or "").strip()
        ownership = ext.get("xxxz") or ""
        rank = ext.get("xxdj") or ""
        fee_text = strip_html(ext.get("sfbz"))
        school_type = ext.get("xxlb") or ""
        summary = brief_intro(ext.get("xxjs") or "") or brief_intro(ext.get("bxts") or "")
        postal = ext.get("yzbm")
        profiles.append({
            "name": name,
            "ownership": ownership,
            "type": school_type,
            "rank": rank,
            "district": ext.get("szq_string") or "、".join(ext.get("szq") or []),
            "address": strip_html(ext.get("xxdz")),
            "postalCode": "" if postal is None else str(postal).strip(),
            "phone": ext.get("lxdh") or "",
            "boardingMode": ext.get("zsqk") or "",
            "website": ext.get("xxwz") or "",
            "summary": summary,
            "url": r.get("url") or "",
            "fee": parse_fee(fee_text, ownership, rank, school_type),
        })
    profiles.sort(key=lambda p: (p["ownership"] != "公办", p["name"]))
    return profiles


def parse_fee(text: str, ownership: str, rank: str, school_type: str):
    """从学校公示的收费标准文本中提取学费、住宿费、伙食费（元），并标明周期与依据。"""
    money = r"(\d[\d,]*(?:\.\d+)?)\s*(万)?\s*(?:元)?\s*(?:/|每)?\s*(?:生|人)?\s*/?\s*(学年|年|学期|期)?"

    def to_amount(m):
        value = float(m.group(1).replace(",", "")) * (10000 if m.group(2) else 1)
        if value < 100:
            return None, None
        return int(value), "学年" if m.group(3) in ("学年", "年") else "学期"

    def amount(keyword, source=text):
        # 关键字与金额之间不允许跨越标点，避免“减免学费,住宿费450元”被误读为学费
        m = re.search(keyword + r"[^0-9；;。，,、]*?" + money, source)
        return to_amount(m) if m else (None, None)

    tuition, period = amount("(?:学杂费|学费|教育成本费)")
    if tuition is None and ownership != "公办":
        head = re.split(r"住宿|伙食|餐", text)[0]
        m = re.search(money, head)
        if m:
            tuition, period = to_amount(m)
    boarding, boarding_period = amount("住宿")
    meals, meals_period = amount("(?:伙食|餐)")
    basis = "学校公示"
    if tuition is None and ownership == "公办" and school_type == "普高":
        level = rank if rank in PUBLIC_FEE_STANDARD["tuition"] else "一般学校"
        tuition, period = PUBLIC_FEE_STANDARD["tuition"][level], "学期"
        basis = f"按市发改委一费制标准（{level}）"

    def per_semester(value, p):
        if value is None:
            return None
        return value // 2 if p == "学年" else value

    return {
        "text": text,
        "basis": basis if tuition is not None else "见公示原文",
        "tuition": per_semester(tuition, period),
        "boarding": per_semester(boarding, boarding_period),
        "meals": per_semester(meals, meals_period),
    }


def load_alias_names():
    """仓库级 data/school-aliases.json。返回 name -> 等价名集合。"""
    path = ROOT.parent / "data" / "school-aliases.json"
    if not path.exists():
        print(f"未找到别名表 {path}")
        return {}
    doc = json.loads(path.read_text(encoding="utf-8"))
    mapped = {}
    for row in doc.get("aliases") or []:
        names = [row.get("canonical") or ""] + list(row.get("aliases") or [])
        names = [n for n in names if n]
        for n in names:
            mapped.setdefault(n, set()).update(names)
    print(f"已读取别名表 {path}（{len(doc.get('aliases') or [])} 组）")
    return mapped


def normalize_name(name: str) -> str:
    return re.sub(r"[（）()\s·]|^深圳市?", "", name)


def link_profiles(schools, profiles, alias_names=None):
    """按学校名称把自主招生学校与学校介绍关联起来，补充区域和收费信息。"""
    by_norm = {normalize_name(p["name"]): i for i, p in enumerate(profiles)}
    alias_names = alias_names or {}
    unmatched = set()
    for s in schools:
        candidates = alias_names.get(s["name"], {s["name"]})
        idx = None
        for cand in candidates:
            key = normalize_name(cand)
            idx = by_norm.get(key)
            if idx is None:
                idx = by_norm.get(normalize_name(re.sub(r"[（(].*?[)）]", "", cand)))
            if idx is None:
                hits = [i for k, i in by_norm.items() if key in k or k in key]
                idx = hits[0] if len(hits) == 1 else None
            if idx is not None:
                break
        if idx is None:
            unmatched.add(s["name"])
            continue
        s["profileIndex"] = idx
        if profiles[idx]["district"]:
            s["district"] = profiles[idx]["district"]
    return sorted(unmatched)


def apply_supplement(schools, alias_names=None):
    """data/supplement.json：按学校名称补充区域、细分项目（官方附件中没有的信息）。"""
    path = DATA_DIR / "supplement.json"
    if not path.exists():
        return
    sup = json.loads(path.read_text(encoding="utf-8")).get("schools", {})
    alias_names = alias_names or {}
    for s in schools:
        extra = sup.get(s["name"])
        if not extra:
            for cand in alias_names.get(s["name"], ()):
                extra = sup.get(cand)
                if extra:
                    break
        if not extra:
            continue
        if extra.get("district"):
            s["district"] = extra["district"]
        projects = extra.get("projects", {}).get(s["category"])
        if projects:
            s["projects"] = projects


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--url", default=DEFAULT_URL, help="深圳市教育局自主招生通知页面 URL")
    ap.add_argument("--profile-page", default=DEFAULT_PROFILE_PAGE, help="深圳招考网“高中阶段学校介绍”页面 URL")
    ap.add_argument("--year", type=int, default=DEFAULT_YEAR)
    args = ap.parse_args()

    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")

    notice = parse_notice(args.url)
    print(f"通知：{notice['title']}（{notice['publishedAt']}）")
    schools = build_schools(notice, args.year)

    print("抓取学校介绍与收费标准…")
    profiles = fetch_profiles(args.profile_page)
    alias_names = load_alias_names()
    unmatched = link_profiles(schools, profiles, alias_names)
    apply_supplement(schools, alias_names)
    print(f"学校介绍：{len(profiles)} 所；自主招生学校未匹配到介绍的：{len(unmatched)} 所")
    for name in unmatched:
        print(f"  - {name}")

    verify_status = "reference-2026" if args.year == 2026 else "pending"
    result = {
        "year": args.year,
        "targetYear": 2027,
        "verifyStatus": verify_status,
        "sourceType": "official",
        "source": notice,
        "profileSource": {"title": f"{args.year}年高中阶段学校办学特色介绍", "url": args.profile_page},
        "publicFeeStandard": PUBLIC_FEE_STANDARD,
        "fetchedAt": datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds"),
        "schools": schools,
        "profiles": profiles,
    }
    for school in schools:
        school["verifyStatus"] = verify_status
        school["sourceType"] = "official"
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    payload = json.dumps(result, ensure_ascii=False, indent=2)
    (DATA_DIR / f"zzzs-{args.year}.json").write_text(payload, encoding="utf-8")
    (DATA_DIR / "zzzs-data.js").write_text(
        "// 由 scripts/fetch_data.py 自动生成，请勿手改\nwindow.ZZZS_DATA = " + payload + ";\n",
        encoding="utf-8",
    )

    for cat in ("一类", "二类"):
        for own in ("公办", "民办"):
            items = [s for s in schools if s["category"] == cat and s["ownership"] == own]
            total = sum(s["plan"] or 0 for s in items)
            print(f"{own}{cat}：{len(items)} 所学校，{total} 个名额")
    print(f"已写入 {DATA_DIR / f'zzzs-{args.year}.json'} 和 zzzs-data.js")


if __name__ == "__main__":
    main()
