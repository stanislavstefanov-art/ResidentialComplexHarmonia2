# Eval Report -- [feature-slug]

## Evidence checks

| # | Check | Result | Evidence |
|---|-------|--------|----------|
| 1 | All 10 station slots present | pass / fail | |
| 2 | Station registry valid | pass / fail | |
| 3 | Handoff map explicit | pass / fail | |
| 4 | Feature scoped | pass / fail | |
| 5 | Station outputs produced or documented stop | pass / fail | At least 6 station outputs exist, and any missing later station output is explained by a documented hard stop; otherwise all 10 are expected. |
| 6 | At least 3 seam findings | pass / fail | |
| 7 | At least 2 human gates | pass / fail | |
| 8 | Eval report complete | pass / fail | |
| 9 | Cost log complete | pass / fail | |
| 10 | Risk note complete | pass / fail | |
| 11 | Final recommendation complete | pass / fail | |
| 12 | Lane 2 comparison complete or n/a | pass / fail / n/a | |

## Verdict

Choose one: `complete-pass`, `documented-stall-pass`, or `incomplete-fail`.

**Reason:** [one paragraph grounded in the 12 checks]

Use `documented-stall-pass` only when at least 6 station outputs exist and the run stopped at a
documented hard stop or at a station contract that looked valid before the run but proved too narrow
to continue without fake context. A raw shipped placeholder found during preflight is an
`incomplete-fail` until replaced with your own spec, an `own+overlay` station, or the matching
fallback.
