# AI Factory Run Record -- [Your name]

**Date:** YYYY-MM-DD
**Role (Deep):** [Your role]
**Running case:** [One-line scope]
**Feature run through the line:** [The feature with the richest carry-forward chain]
**Feature slug:** `[feature-slug]`
**Result state:** `complete-pass` / `documented-stall-pass` / `incomplete-fail`

---

## Evidence summary

| # | Evidence item | Status | File or note |
|---|---------------|--------|--------------|
| 1 | All 10 station slots present | pass / fail | `.claude/agents/*.md` or `station-slots/*.md` |
| 2 | Station registry valid | pass / fail | `station-registry.yaml` |
| 3 | Handoff map explicit | pass / fail | `handoff-map.yaml` / `CLAUDE.md` |
| 4 | Feature scoped | pass / fail | `feature.md` |
| 5 | Station outputs produced or documented stop | pass / fail | At least 6 station outputs exist, and any missing later station output is explained by a documented hard stop; otherwise all 10 are expected. |
| 6 | At least 3 seam findings | pass / fail | `seam-ledger.md` |
| 7 | At least 2 human gates | pass / fail | `human-gates.md` |
| 8 | Eval report complete | pass / fail | `eval-report.md` |
| 9 | Cost log complete | pass / fail | `cost-log.md` |
| 10 | Risk note complete | pass / fail | `risk-note.md` |
| 11 | Final recommendation complete | pass / fail | `final-recommendation.md` |
| 12 | Lane 2 comparison complete or n/a | pass / fail / n/a | `sdlc-factory-adaptation-note.md` or `n/a` |

## Result-state rules

- `complete-pass`: all 10 station outputs exist and evidence items 1-11 pass.
- `documented-stall-pass`: at least 6 station outputs exist, stopped at a documented hard stop or a station contract that looked valid before the run but proved too narrow, and the run record explains why continuing would be unsafe or fake.
- `incomplete-fail`: fewer than 6 outputs, missing run record, or undocumented stop.

A raw shipped placeholder found during preflight is not a documented stall. Replace it with your own
spec, an `own+overlay` station, or the matching fallback before the first station call.

## The line

| # | Station | Module | Spec source (`own` / `own+overlay` / `fallback` / `fallback-after-gap`) | Output file |
|---|---------|--------|----------------------------------------|-------------|
| 1 | Consulting / SME | 100 | | `runs/<feature-slug>/100-opportunity-brief.md` |
| 2 | Product / BA | 200 | | `runs/<feature-slug>/200-spec.md` |
| 3 | Design | 300 | | `runs/<feature-slug>/300-design.md` |
| 4 | Architecture | 400 | | `runs/<feature-slug>/400-architecture.md` |
| 5 | Engineering | 500 | | `runs/<feature-slug>/500-implementation.md` |
| 6 | Data | 700 | | `runs/<feature-slug>/700-data-design.md` |
| 7 | Infra/Ops | 800 | | `runs/<feature-slug>/800-infra.md` |
| 8 | Security | 900 | | `runs/<feature-slug>/900-security-review.md` |
| 9 | QA | 600 | | `runs/<feature-slug>/600-test-plan.md` |
| 10 | Management / Delivery | 1000 | | `runs/<feature-slug>/1000-release-plan.md` |

**Orchestrator:** `CLAUDE.md` / `AGENTS.md` / `.cursor/rules/ai-factory.mdc` / manual prompts
**Station registry:** `station-registry.yaml` -- [pass/fail and note]
**Handoff map:** `handoff-map.yaml` -- [pass/fail and note]
**Transcript:** `runs/<feature-slug>/transcript.md`
**Where the line stopped or stalled:** [station(s), and why; write "did not stop" if complete]

---

## Seam findings

| # | Handoff (upstream -> downstream) | Upstream produced | Downstream needed | Mark (under-supply / over-supply / missing / routing / clean) | Gate status | Assumption used? | Owner to harden |
|---|----------------------------------|-------------------|-------------------|---------------------------------------------------------------|-------------|------------------|-----------------|
| 1 | | | | | | | |
| 2 | | | | | | | |
| 3 | | | | | | | |

**One seam I will propose the team hardens first:** [Name it]

---

## Human gates

Use statuses from `human-gates.md`: `training-open`, `hard-stop`, `missed`, `paused-approved`,
`paused-blocked`, `recorded-open`, `n/a`.

| # | Human-gate observation | Gate status | The decision a person makes | Owner |
|---|-----------------------------------|-------------|------------------------------|-------|
| 1 | | | | |
| 2 | | | | |

---

## Evaluation, cost, risk, recommendation

- **Eval report:** `runs/<feature-slug>/eval-report.md`
- **Cost log:** `runs/<feature-slug>/cost-log.md`
- **Risk note:** `runs/<feature-slug>/risk-note.md`
- **Final recommendation:** `runs/<feature-slug>/final-recommendation.md`
- **Lane 2 comparison:** `runs/<feature-slug>/sdlc-factory-adaptation-note.md` or `n/a`

---

## What I am handing the bootcamp

[One paragraph: the runnable line, result state, fallback usage, and the named seam to harden first.]

---

## Revision history

| Version | Date | Change |
|---------|------|--------|
| 1.0 | YYYY-MM-DD | Initial commit |
