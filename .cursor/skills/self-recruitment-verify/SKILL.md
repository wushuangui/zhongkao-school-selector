---
name: self-recruitment-verify
description: >-
  QA gate for self-recruitment P0: maps diffs to issue acceptance checkboxes and
  D-1 through D-4 compliance. Use after implementation, on issue ID review, or
  before marking P0 done.
disable-model-invocation: true
---

# Self-recruitment verify agent（代码校验智能体）

## Role

Given **issue ID** and/or **git diff** (or file list), produce **PASS** or **FAIL** with blockers. Do not implement features unless fixing trivial verify-script gaps user requested.

## Inputs

| Input | Action |
|-------|--------|
| `V1-P0-03` etc. | Load section from `docs/issues-P0-self-recruitment.md` |
| Diff | `git diff` / `git diff --staged` scoped to `self-recruitment/` and related `docs/` |
| Handoff | Cross-check acceptance mapping if present |

## Report template

```markdown
# Verify: [issue ID] — PASS | FAIL

## Summary
One sentence.

## Acceptance criteria
| # | Criterion | Result | Evidence |
|---|-----------|--------|----------|
| 1 | ... | PASS/FAIL | file:line or manual step |

## D-1～D-4 compliance
| Decision | Result | Notes |
|----------|--------|-------|
| D-1 | PASS/FAIL | |
| D-2 | PASS/FAIL | |
| D-3 | PASS/FAIL | |
| D-4 | PASS/FAIL | |

## Blockers (FAIL only)
1. ...

## Recommended fixes
- ...

## Optional commands run
- ...
```

**PASS** only if every issue checkbox is satisfied and no D-rule violations.

## Automated checks (run when relevant)

### Python / build

From repo root or `self-recruitment/scripts/`:

```bash
python self-recruitment/scripts/build_single.py --help
```

If issue touches bundle: run `build_single.py` per its README/help (full vs batch flags when V2-P0-06).

Run fetch/build validators referenced in the issue (e.g. schema CI scripts if present).

### Forbidden patterns (D-1 / static)

Search `self-recruitment/` (exclude `scripts/` fetch utilities unless issue adds network to **runtime** JS):

```bash
# Examples — adapt to ripgrep in agent
# Runtime must not call backend APIs
rg -n "fetch\s*\(|XMLHttpRequest|axios|WebSocket" self-recruitment/js self-recruitment/index.html
# No auth/session product features
rg -n "localStorage\.(set|get)Item.*token|supabase|firebase|login|subscribe" self-recruitment/js
```

**Allow**: static link to official URLs; `file://`/Pages static assets; Python in `scripts/` only.

### D-2 (conservative default)

```bash
rg -n "riskPreset|conservative|乐观|中性" self-recruitment/js
```

Manual: first load uses conservative; switching preset shows risk confirm; no `%` 录取概率 in new UI strings.

### D-3

```bash
rg -n "港澳|D类简版|跨境向导" self-recruitment/
```

New IA entries matching 简版/向导 → FAIL unless issue explicitly documents exclusion test only.

### XSS / static safety

```bash
rg -n "innerHTML\s*=" self-recruitment/js
```

Flag unescaped dynamic HTML; confirm `escapeHtml` (or equivalent) on user/URL data.

### D-4

Check `theme-color`, title, footer disclaimer against sibling app pattern if changed; meta `year`/`fetchedAt`/`source` visible when issue requires.

## Manual checklist (always skim)

- [ ] Works offline after load (no required live API for core flows)
- [ ] Mobile layout: new nav/content doesn’t break three-tab filters
- [ ] 免责声明 consistent with PRD §9 and footer
- [ ] No new serverless subscription deps at repo level for this product (V2-P0-08)

## After PASS

Tell user they may:

1. Tick checkboxes in `docs/issues-P0-self-recruitment.md` (or ask **product** agent to set `**Status**: done`).
2. Commit (human/agent per user request only).

## Optional scripts

Add `self-recruitment/scripts/verify_static.py` or `verify-p0.js` only if repeatedly useful and &lt;100 lines; otherwise document commands above. Not required for this skill to function.