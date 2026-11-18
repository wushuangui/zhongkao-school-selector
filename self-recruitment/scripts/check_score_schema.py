"""校验 scores-*.json：文件含 year，每条学校记录的 scoreKind 属于枚举。"""

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
KINDS = {"资格线", "录取线", "控制线"}


def main():
    files = sorted((ROOT / "data").glob("scores-*.json"))
    if not files:
        print("FAIL: 未找到 scores-*.json")
        return 1
    for path in files:
        data = json.loads(path.read_text(encoding="utf-8"))
        if not data.get("year"):
            print(f"FAIL: {path.name} 缺少 year")
            return 1
        for i, school in enumerate(data.get("schools") or []):
            kind = school.get("scoreKind")
            if kind not in KINDS:
                name = school.get("name")
                print(f"FAIL: {path.name} #{i} {name} scoreKind={kind!r}")
                return 1
        print(f"OK: {path.name} year={data['year']} schools={len(data.get('schools') or [])}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
