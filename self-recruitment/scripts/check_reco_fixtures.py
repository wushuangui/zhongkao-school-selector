"""与 js/reco.js 的 Layer 1 规则对齐的固定样例。"""

import sys

ONE = "只能报 1 所学校的 1 个项目"
CTRL = "考生中考成绩不得低于此分数才能参与该校自主招生录取排序"


def layer1(ctx):
    rejected, kept = [], []
    score = ctx.get("score")
    for i, p in enumerate(ctx.get("zzzsPicks") or []):
        if i > 0:
            rejected.append({"name": p["name"], "ruleId": "R-ONE", "reason": ONE})
            continue
        if score is not None and p.get("control") is not None and score < p["control"]:
            rejected.append({"name": p["name"], "ruleId": "R-CTRL", "reason": CTRL})
            continue
        kept.append(p)
    for s in ctx.get("batch1") or []:
        if ctx.get("category") and s.get("category") and s["category"] != ctx["category"]:
            rejected.append({"name": s["name"], "ruleId": "R-ACD", "reason": "不在所选考生类别筛选范围内"})
            continue
        if ctx.get("budget") is not None and s.get("fee3") is not None and s["fee3"] > ctx["budget"]:
            rejected.append({"name": s["name"], "ruleId": "R-BUDGET", "reason": "超过预算上限"})
            continue
        kept.append(s)
    return kept, rejected


def main():
    cases = [
        ("one-project", {"score": 560, "zzzsPicks": [{"name": "甲", "control": 500}, {"name": "乙", "control": 480}], "batch1": []}, "R-ONE"),
        ("below-control", {"score": 480, "zzzsPicks": [{"name": "甲", "control": 500}], "batch1": []}, "R-CTRL"),
        ("category", {"score": 560, "category": "AC", "zzzsPicks": [], "batch1": [{"name": "丁", "category": "D", "line": 540}]}, "R-ACD"),
        ("budget", {"score": 560, "budget": 10000, "zzzsPicks": [], "batch1": [{"name": "戊", "category": "AC", "line": 540, "fee3": 20000}]}, "R-BUDGET"),
    ]
    for name, ctx, rule in cases:
        kept, rejected = layer1(ctx)
        if not rejected or rejected[0]["ruleId"] != rule:
            print("FAIL", name, rejected)
            return 1
        if name != "one-project" and kept:
            print("FAIL kept", name)
            return 1
    kept, rejected = layer1({"score": 560, "category": "AC", "zzzsPicks": [{"name": "甲", "control": 500}], "batch1": [{"name": "丙", "category": "AC", "line": 540}]})
    if rejected or len(kept) != 2:
        print("FAIL keep", kept, rejected)
        return 1
    print("OK: 5 fixtures")
    return 0


if __name__ == "__main__":
    sys.exit(main())
