# AI Factory Run Record -- Stanislav Stefanov

**Date:** 2026-07-09
**Role (Deep):** Orchestrator (this run wired all stations from fallback specs; no learner Deep-role spec applied)
**Running case:** Harmonia — a residents' association tool for a single building (BBQ booking → fees → directory)
**Feature run through the line:** Reserve the shared BBQ zone (view a day's availability; reserve one free slot; never double-book)
**Feature slug:** `reserve-bbq-slot`
**Result state:** `complete-pass`

---

## Evidence summary

| # | Evidence item | Status | File or note |
|---|---------------|--------|--------------|
| 1 | All 10 station slots present | pass | `.claude/agents/*.md` — 10 agents, no placeholders |
| 2 | Station registry valid | pass | `station-registry.yaml` order `100,200,300,400,500,700,800,900,600,1000` |
| 3 | Handoff map explicit | pass | `handoff-map.yaml` names every upstream file for 800/900/600/1000 |
| 4 | Feature scoped | pass | `feature.md` — one slice, 5 testable ACs incl. concurrency + access |
| 5 | Station outputs produced or documented stop | pass | All 10 outputs produced; no stop |
| 6 | At least 3 seam findings | pass | `seam-ledger.md` — 5 seams |
| 7 | At least 2 human gates | pass | `human-gates.md` — 9 gates |
| 8 | Eval report complete | pass | `eval-report.md` |
| 9 | Cost log complete | pass | `cost-log.md` |
| 10 | Risk note complete | pass | `risk-note.md` |
| 11 | Final recommendation complete | pass | `final-recommendation.md` |
| 12 | Lane 2 comparison complete or n/a | n/a | No `sdlc-factory` Lane-2 execution attempted |

## Result-state rules

`complete-pass`: all 10 station outputs exist and evidence items 1–11 pass. ✅ Met — 1–11 pass, item 12 is a legitimate `n/a`.

## The line

| # | Station | Module | Spec source | Output file |
|---|---------|--------|-------------|-------------|
| 1 | Consulting / SME | 100 | `fallback` | `runs/reserve-bbq-slot/100-opportunity-brief.md` |
| 2 | Product / BA | 200 | `fallback` | `runs/reserve-bbq-slot/200-spec.md` |
| 3 | Design | 300 | `fallback` | `runs/reserve-bbq-slot/300-design.md` |
| 4 | Architecture | 400 | `fallback` | `runs/reserve-bbq-slot/400-architecture.md` |
| 5 | Engineering | 500 | `fallback` | `runs/reserve-bbq-slot/500-implementation.md` |
| 6 | Data | 700 | `fallback` | `runs/reserve-bbq-slot/700-data-design.md` |
| 7 | Infra/Ops | 800 | `fallback` | `runs/reserve-bbq-slot/800-infra.md` |
| 8 | Security | 900 | `fallback` | `runs/reserve-bbq-slot/900-security-review.md` |
| 9 | QA | 600 | `fallback` | `runs/reserve-bbq-slot/600-test-plan.md` |
| 10 | Management / Delivery | 1000 | `fallback` | `runs/reserve-bbq-slot/1000-release-plan.md` |

**Orchestrator:** `CLAUDE.md`
**Station registry:** `station-registry.yaml` — pass (order correct, all 10 mapped)
**Handoff map:** `handoff-map.yaml` — pass (upstream files explicit for fan-in stations)
**Transcript:** `runs/reserve-bbq-slot/transcript.md`
**Where the line stopped or stalled:** did not stop — all 10 stations completed one pass each.

---

## Seam findings

| # | Handoff (upstream → downstream) | Upstream produced | Downstream needed | Mark | Gate status | Assumption used? | Owner to harden |
|---|----------------------------------|-------------------|-------------------|------|-------------|------------------|-----------------|
| 1 | feature → 200/300/900 | "signed-in resident" (AC-6) | how identity/session is established & verified | missing | training-open | yes — A3/D1/LA-500-3 | Identity / Security |
| 2 | 500 → 800 | implementation plan (no stack) | container/manifest/runtime target | under-supply | recorded-open (→ hard-stop prod) | yes — LA-800-1 (shape not stack) | Engineering + Infra |
| 3 | 100 → 200 → 700 | feature (no slot grid) | slot duration/count/window | under-supply | recorded-open | yes — PA1/LA-DATA-1 (configurable grid) | Product |
| 4 | 200 → 300 | cancellation absent from feature | whether cancellation is in scope | clean (bounded scope cut) | recorded-open | yes — G2 (out of scope) | Product |
| 5 | 700/800 → 900 | UC-1 store constraint | proof the store is truly atomic | clean (dependency surfaced) | training-open (GATE-ARCH-1) | yes — LA-ARCH-2/LA-500-1 | Architecture + Data |

**One seam I will propose the team hardens first:** Seam #1 — the identity/session source. AC-6 (residents-only) rests on it and the design cannot self-protect it.

---

## Human gates

| # | Human-gate observation | Gate status | The decision a person makes | Owner |
|---|-----------------------------------|-------------|------------------------------|-------|
| 1 | Identity/session trust root (GATE-SEC-1 / G3-D1) | training-open (→ hard-stop prod) | Define & verify who is a resident and how the session is trusted | Identity / Security |
| 2 | Concurrency mechanism confirmation (GATE-ARCH-1) | training-open | Confirm Option A / UC-1 as the durable no-double-booking mechanism | Architecture |
| 3 | Data classification / retention / residency (GATE-DATA-1) | training-open (→ hard-stop prod) | Confirm `household_ref` classification, retention, EU residency, erasure vs audit | DPO |
| 4 | Spec approval (200 → 300) | recorded-open | Approve stories/ACs before downstream artefacts are trusted | Product |
| 5 | Budget / provider / region / release (GATE-BUDGET-1, G-INFRA-1/2, GATE-REL-1) | hard-stop (prod) | Approve spend, choose store+region, commit rollout | Board / Infra / Delivery |

---

## Evaluation, cost, risk, recommendation

- **Eval report:** `runs/reserve-bbq-slot/eval-report.md` — `complete-pass`
- **Cost log:** `runs/reserve-bbq-slot/cost-log.md` — 10 calls, one pass each, default model, no premium
- **Risk note:** `runs/reserve-bbq-slot/risk-note.md` — top 3 risks + residual
- **Final recommendation:** `runs/reserve-bbq-slot/final-recommendation.md` — pilot with fixes (AMBER)
- **Lane 2 comparison:** `n/a`

---

## What I am handing the bootcamp

A runnable 10-station line that took one thin Harmonia slice — reserving the shared BBQ zone without double-booking — from a rough `feature.md` to a full evidence pack, `complete-pass`, all stations run once from `fallback` specs. The standout result is that the line stayed honest: it traced the no-double-booking invariant end-to-end (AC-4 → Option A → UC-1 → TC-18), fed 18 security checks into the test plan, and — crucially — refused to self-close the human-owned gates or fake the 6 security checks that need a real store/verifier/region. The feature lands AMBER / pilot-with-fixes, gated on the one seam the design cannot protect itself. **The seam to harden first is the identity/session trust root** (feature → AC-6); it is the top blocking risk and the natural first candidate to replace the `fallback` Security/Consulting specs with custom role skills on the next run.

---

## Revision history

| Version | Date | Change |
|---------|------|--------|
| 1.0 | 2026-07-09 | Initial run record — `reserve-bbq-slot`, complete-pass, all-fallback stations |
