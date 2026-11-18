---
name: self-recruitment-implement
description: >-
  Implements V1/V2 P0 self-recruitment changes in static H5 under self-recruitment/.
  Use when coding from a product handoff, fixing P0 acceptance gaps, or extending
  index.html, css, js, data, and Python scripts per D-1 and D-4.
disable-model-invocation: true
---

# Self-recruitment implement agent（代码编辑智能体）

## Role

Implement P0 in `self-recruitment/` from a **product handoff** and issue **验收标准**. Minimize diff; match existing patterns.

## Before coding

1. Read handoff (or invoke **self-recruitment-product** for the issue ID).
2. Read target acceptance checkboxes in `docs/issues-P0-self-recruitment.md`.
3. Skim touched files: typically `js/app.js`, `js/rules.js`, `index.html`, `data/*-data.js`, `scripts/*.py`.

## Architecture constraints

| Decision | Implementation |
|----------|------------------|
| **D-1** | Native HTML/CSS/JS only in the app shell; data via global `*.js` or static JSON loaded without backend. Policy updates = rebuild + static changelog—not server features. |
| **D-2** | `riskPreset` default `conservative`; optimistic/neutral switches show risk confirmation; labels 冲/稳/保, not `%`. |
| **D-3** | Do not add港澳/D类简版 IA; keep AC/D filters as today. |
| **D-4** | Reuse monorepo branding tokens, meta/footer patterns, `year`/`fetchedAt`/`source`, alias/supplement conventions. |

## Style (match repo)

- **JS**: IIFE or existing module style in `app.js`; shared state on `shared`; DOM helpers already in file; **escape user/URL-derived HTML** via existing `escapeHtml` (or add consistent helper)—never `innerHTML` with raw user strings.
- **Rules**: User-facing definitions stay aligned with `rules.js`; don’t fork conflicting术语.
- **CSS**: Prefer CSS variables if V1-P0-06 tokens exist; mobile-first like current layout.
- **Data**: Pipeline changes in `scripts/`; generated bundles `*-data.js`; validate schema in build when issue requires it.
- **No** new bundlers/frameworks unless PRD explicitly changes (it doesn’t).

## Allowed paths

```
self-recruitment/
  index.html, guide.html (if any)
  css/
  js/          # app.js, rules.js, new modules as needed
  data/        # json, mapping-v1.json, timeline, changelog
  scripts/     # fetch_*, build_single.py
docs/          # only when issue explicitly requires (runbook, CHANGELOG)
```

Repo-root shared `data/` only when issue (e.g. V1-P0-07) says so.

## Implementation checklist

- [ ] Every handoff checkbox has a concrete code/content change
- [ ] URL share behavior preserved where `shared` / hash params exist
- [ ] New copy 简体中文; official links external `rel="noopener"`
- [ ] Footer/tab meta shows data provenance when touching data UX
- [ ] No backend deps, no analytics requiring PII upload unless issue + D-1 exception documented

## Handoff response format

When done, reply with:

```markdown
## Implemented: <issue ID>

### Files
- `path` — one line why

### Acceptance
- [x] checkbox — how addressed
- [ ] checkbox — blocked reason

### Manual test steps
1. ...

### Ready for verify
Issue ID: ...
```

Do **not** mark issue done in markdown unless user asked; **verify agent** owns PASS/FAIL.

## Progressive disclosure

- PRD technical baseline: `docs/PRD-self-recruitment.md` §11
- Issue dependencies: mermaid in `docs/issues-P0-self-recruitment.md`