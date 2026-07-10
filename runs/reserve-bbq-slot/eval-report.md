# Eval Report -- reserve-bbq-slot

## Evidence checks

| # | Check | Result | Evidence |
|---|-------|--------|----------|
| 1 | All 10 station slots present | pass | `.claude/agents/*.md` — 10 agents, none `# INVALID PLACEHOLDER` (setup verified CLEAN) |
| 2 | Station registry valid | pass | `station-registry.yaml` order `100,200,300,400,500,700,800,900,600,1000` |
| 3 | Handoff map explicit | pass | `handoff-map.yaml` names every upstream file for 800/900/600/1000 |
| 4 | Feature scoped | pass | `feature.md` — one slice (reserve one BBQ slot), 5 testable ACs incl. concurrency + access |
| 5 | Station outputs produced or documented stop | pass | All 10 outputs exist (`100`…`1000`); no stop — `complete-pass` |
| 6 | At least 3 seam findings | pass | `seam-ledger.md` — 5 seams recorded |
| 7 | At least 2 human gates | pass | `human-gates.md` — 9 gates recorded |
| 8 | Eval report complete | pass | this file |
| 9 | Cost log complete | pass | `cost-log.md` — 10 stations, one pass each, default model |
| 10 | Risk note complete | pass | `risk-note.md` — top 3 + residual |
| 11 | Final recommendation complete | pass | `final-recommendation.md` — PILOT WITH FIXES |
| 12 | Lane 2 comparison complete or n/a | n/a | No `sdlc-factory` Lane-2 execution attempted this run |

## Content-quality spot checks (beyond presence)

| Check | Result | Evidence |
|-------|--------|----------|
| Every AC has ≥1 test case | pass | `600-test-plan.md` — AC-1:6, AC-2:3, AC-3:5, AC-4:5, AC-5:5, AC-6:5; none zero |
| Concurrency invariant traced end-to-end | pass | AC-4 → Option A (400) → UC-1 (700) → RC-1/DQ-1 (800) → TC-18 (600) |
| Security findings feed QA | pass | 18 SEC-CHK → 42 TCs; 12 runnable, 6 honestly blocked-on-gate |
| No risk self-accepted by an agent | pass | 5 residual risks (900) routed to named owners; release left to GATE-REL-1 |
| No secrets / production data / live writes | pass | Setup + run secrets scan clean; kill-switch owners are role placeholders |

## Verdict

**`complete-pass`**

**Reason:** All 10 stations ran in run order, one pass each, and each produced its named output file — evidence checks 1–11 pass and check 12 is a legitimate `n/a` (no Lane-2 execution attempted). The line held its disciplines: every acceptance criterion carries at least one test case, the load-bearing no-double-booking invariant is traceable from AC-4 through architecture, data, infra, and QA, security findings flow into the test plan, and no agent self-accepted risk. Where upstream facts were missing (identity source, deployment stack, slot grid, personal-data policy) the line continued on labelled assumptions and recorded them as seams and gates rather than inventing facts or faking green tests — exactly the honest-run behaviour the factory is meant to prove. The run is a `complete-pass` for evidence completeness; the *feature* itself is AMBER / pilot-gated (see final recommendation), which is a separate judgement from run completeness.
