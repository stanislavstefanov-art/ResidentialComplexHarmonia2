# AI Factory Run Record -- Meridian Cart Lookup Example

**Date:** 2026-06-01
**Role (Deep):** Example only
**Running case:** Meridian retail associate checkout
**Feature run through the line:** Online cart lookup at POS
**Feature slug:** `meridian-cart-lookup`
**Result state:** `complete-pass`

---

## Evidence summary

| # | Evidence item | Status | File or note |
|---|---------------|--------|--------------|
| 1 | All 10 station slots present | pass | `station-specs/*.md` includes all ten worked station specs |
| 2 | Station registry valid | pass | `station-registry.yaml` order follows `100,200,300,400,500,700,800,900,600,1000` |
| 3 | Handoff map explicit | pass | `handoff-map.yaml` names the read/write chain |
| 4 | Feature scoped | pass | `feature.md` is one POS cart lookup slice |
| 5 | Station outputs produced or documented stop | pass | 10 station output files exist |
| 6 | At least 3 seam findings | pass | `seam-ledger.md` |
| 7 | At least 2 human gates | pass | `human-gates.md` |
| 8 | Eval report complete | pass | `eval-report.md` |
| 9 | Cost log complete | pass | `cost-log.md` |
| 10 | Risk note complete | pass | `risk-note.md` |
| 11 | Final recommendation complete | pass | `final-recommendation.md` |
| 12 | Lane 2 comparison complete or n/a | n/a | Lane 2 not attempted in this example |

## Result-state rules

- `complete-pass`: all 10 station outputs exist and evidence items 1-11 pass.
- `documented-stall-pass`: at least 6 station outputs exist, stopped at a documented hard stop or a station contract that looked valid before the run but proved too narrow, and the run record explains why continuing would be unsafe or fake.
- `incomplete-fail`: fewer than 6 outputs, missing run record, or undocumented stop.

## The line

| # | Station | Module | Spec source | Output file |
|---|---------|--------|-------------|-------------|
| 1 | Consulting / SME | 100 | fallback example | `100-opportunity-brief.md` |
| 2 | Product / BA | 200 | fallback example | `200-spec.md` |
| 3 | Design | 300 | fallback example | `300-design.md` |
| 4 | Architecture | 400 | fallback example | `400-architecture.md` |
| 5 | Engineering | 500 | fallback example | `500-implementation.md` |
| 6 | Data | 700 | fallback example | `700-data-design.md` |
| 7 | Infra/Ops | 800 | fallback example | `800-infra.md` |
| 8 | Security | 900 | fallback example | `900-security-review.md` |
| 9 | QA | 600 | fallback example | `600-test-plan.md` |
| 10 | Management / Delivery | 1000 | fallback example | `1000-release-plan.md` |

**Orchestrator:** `CLAUDE.md` routes one feature through stations in the canonical order.
**Station registry:** pass -- all ten station specs are represented.
**Handoff map:** pass -- each station cites upstream reads and downstream writes.
**Transcript:** `transcript.md`
**Where the line stopped or stalled:** did not stop; three handoffs under-supplied downstream stations and were recorded as seam findings.

---

## Seam findings

| # | Handoff (upstream -> downstream) | Upstream produced | Downstream needed | Mark | Gate status | Assumption used? | Owner to harden |
|---|----------------------------------|-------------------|-------------------|------|-------------|------------------|-----------------|
| 1 | 200 Product / BA -> 300 Design | `200-spec.md` with fallback message requirement | failure-state copy, accessibility treatment, visible reason-code policy | under-supply | recorded-open | yes: training assumption used for copy shape only | Product / BA |
| 2 | 300 Design -> 400 Architecture | `300-design.md` with flow and UI states | source systems, API owner, data sensitivity classification, audit-event requirements | under-supply | training-open | yes: training assumption used for source-system names | Architecture with Product |
| 3 | 900 Security -> 600 QA | `900-security-review.md` with safe audit shape | approved associate-facing reason-code behavior | under-supply | training-open | no; QA recorded the open gate | Security with Product and compliance |

**One seam to harden first:** Product / BA -> Design, because implementation would inherit unclear failure-state behavior if this stays vague.

---

## Human gates

| # | Human-gate observation | Gate status | The decision a person makes | Owner |
|---|-----------------------------------|-------------|------------------------------|-------|
| 1 | Identity verification method | training-open | approve the allowed verification method | Product owner and compliance owner |
| 2 | Audit-event reason codes | training-open | approve which reason codes associates may see and which remain audit-only | Product, Security, compliance owner |

Status vocabulary present for the example: `training-open`, `hard-stop`, `missed`, `paused-approved`, `paused-blocked`, `recorded-open`, `n/a`.

---

## Evaluation, cost, risk, recommendation

- **Eval report:** `eval-report.md`
- **Cost log:** `cost-log.md`
- **Risk note:** `risk-note.md`
- **Final recommendation:** `final-recommendation.md`
- **Lane 2 comparison:** n/a

---

## What this hands to the bootcamp

This example hands over a small, runnable ten-station line and three seam findings. The first seam
to harden is the Product / BA -> Design handoff: the spec must carry enough failure-state,
accessibility, and reason-code detail for Design to avoid inventing policy.

---

## Revision history

| Version | Date | Change |
|---------|------|--------|
| 1.0 | 2026-06-01 | Initial example run |
