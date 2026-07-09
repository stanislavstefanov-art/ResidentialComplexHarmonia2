---
description: Drive feature.md through all 10 stations in order, low-cost mode
---

Run `feature.md` through the factory using the run protocol in `CLAUDE.md`. If you have not run
`/setup` yet, stop and run it first — every station must hold a real spec or a fallback, never an
`# INVALID PLACEHOLDER`.

**Low-cost mode (required):** one pass per station; default or cheaper approved model; no background
teams, no parallel autonomous workers, no recursive station calls, no enterprise-transformation
planning. Reserve a premium model for at most one named, human-reviewed decision.

## Phase 1 — run the line

1. Read `feature.md`, pick a short `<feature-slug>` (lowercase, hyphens), and create
   `runs/<feature-slug>/`.
2. Drive the stations **strictly in this order** — not numeric (Data before Infra; QA near the end):

   `100 → 200 → 300 → 400 → 500 → 700 → 800 → 900 → 600 → 1000`

   For each station: dispatch its `.claude/agents/<station>.md`, let it read its upstream file(s)
   and write its own output into `runs/<feature-slug>/`, then append a one-line note to
   `runs/<feature-slug>/transcript.md` (what it did, what it produced).
3. **Stop at the first invalid station slot.** Record which station failed and which upstream file
   it would have read.
4. **Do not hand-feed missing context to keep the line green.** When a station asks for context it
   should have received, record *what it needed and which upstream station should have carried it*,
   then stop or continue only from saved artefacts plus a labelled training assumption. A stall is
   the finding.
5. If a station finishes without producing its named output file, record an under-supply finding
   instead of rerunning it until it looks clean.

## Phase 2 — build the evidence pack

When the line stops or completes, fill from the templates in `runs/`:

- `seam-ledger.md` — at least 3 handoff findings (clean / under-supply / over-supply / missing /
  routing), each naming the two stations and the file;
- `human-gates.md` — at least 2 observations (paused correctly, missed, or continued on a labelled
  assumption);
- `eval-report.md`, `cost-log.md`, `risk-note.md`, `final-recommendation.md`, and `run-record.md`.

Close by reporting the result state from `PREFLIGHT.md`: `complete-pass`, `documented-stall-pass`,
or `incomplete-fail`. These are drafts for the human to confirm and sharpen — do not invent clean
handoffs.
