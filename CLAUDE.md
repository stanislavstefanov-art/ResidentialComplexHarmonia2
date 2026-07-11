# AI Software-Delivery Factory — Orchestrator

This repo is a hand-wired **AI factory**: ten role-agent station slots, run in order, each
producing one artefact and handing it to the next. You are the orchestrator.

Visible station slots live under `station-slots/`. Claude Code runtime adapters live under
`.claude/agents/` and should be copied from the adapted station slots before an auto-dispatch run.

## Start here (read before any run)

This factory builds one product. Before running the line, read the two docs that define it —
and note the process rules live **in the guide**, not restated here:

- **`docs/guides/harmonia-product-vision.md`** — the *what* (business idea only, zero technology;
  the stations derive the stack, data model, and controls — do not pre-decide them).
- **`docs/guides/build-application-with-ai-factory.md`** — the *how* (scope one thin slice → run
  the factory → review the evidence pack → code). This is the operating manual; follow it over any
  habit that conflicts.
- **`docs/LearningMaterials/modules/`** — deep reference, loaded **on demand** per the map at the
  bottom of the vision doc. Reading it all up front exhausts the session before work starts.

## Context bundle (all sessions)

Layered context for this repo — load the warm files before writing code:
- **Warm:** `docs/context/stack.md` — stack, build/test commands, the R1 constraint. Standards:
  `docs/context/standards/code-quality.md`, `docs/context/standards/git-workflow.md`.
- **Decisions (ADRs):** `docs/architecture/decisions/` — ADR-0001 (identity), ADR-0002 (store).
- **Open gaps:** `context/cold/gap-log.md` — never assume past a listed gap; escalate instead.
  
## Run bounds

Keep the required run small and inspectable:

- Run one feature from `feature.md`.
- Run one pass per station.
- Use the default or cheaper approved model for the run. Reserve premium reasoning models for one
  named human-reviewed decision, not the whole line.
- Do not spawn background teams, parallel autonomous workers, or recursive station calls.
- Do not turn this into an enterprise-transformation plan. This run proves one small factory slice.
- Do not ask for or store secrets, credentials, client-confidential data, or production data.
- Do not make live writes to production systems.
- Before running, every station slot must hold either the learner's Final Kata spec, an
  `own+overlay` adaptation, or the matching fallback spec from `fallback-specs/`. Stop and record a
  finding when a station is still a raw placeholder, loops without producing its named file, asks
  for context an upstream station should have supplied, or tries to make a human-owned decision.
- If the runtime exposes model or cost information, append a short cost/model note to
  `runs/<feature-slug>/transcript.md`.

## How to run a feature

When the user says **"run `feature.md` through the factory"** (or names a feature):

1. Read `feature.md`. Pick a short `<feature-slug>` and create `runs/<feature-slug>/`.
2. Validate the station registry: all ten station files exist, and each one is either a learner
   Final Kata spec or a copied fallback spec from `fallback-specs/`.
3. Phase 1: drive the feature through the stations **in order** (table below). For each station:
   - dispatch to the station's agent in `.claude/agents/`;
   - it reads its upstream file and writes its own output file before the next station starts;
   - append a short note to `runs/<feature-slug>/transcript.md` — what it did and what it produced.
4. **Stop at the first invalid station slot** (no agent file, or the file is still the shipped
   placeholder). Record which station failed registry validation, what fallback or learner spec it
   needed, and which upstream file it would have read — then hand back to the human. A raw shipped
   placeholder found before the first station call is a preflight failure, not a
   `documented-stall-pass`.
5. **Do not hand-feed context to keep the line moving.** Stop or record a seam when a station asks
   for missing upstream context. Do not answer with new facts. Continue only if the station can
   produce the named output using documented assumptions. A station that looked valid before the
   run but proves too narrow during the run can become a `documented-stall-pass`; the run record
   must explain why continuing would be unsafe or fake.
6. If a station finishes but does not produce its named output file, record an under-supply
   finding in the transcript instead of rerunning it until it looks clean.
7. Phase 2: after the station run stops or completes, fill the evidence pack from the station
   outputs and transcript: `seam-ledger.md`, `human-gates.md`, `eval-report.md`, `cost-log.md`,
   `risk-note.md`, `final-recommendation.md`, and `run-record.md`.

## The line

| # | Station | Agent file | Reads | Writes |
|---|---------|-----------|-------|--------|
| 1 | Consulting / SME | `.claude/agents/100-consulting.md` | `feature.md` | `runs/<feature-slug>/100-opportunity-brief.md` |
| 2 | Product / BA | `.claude/agents/200-product.md` | `100-opportunity-brief.md` | `runs/<feature-slug>/200-spec.md` |
| 3 | Design | `.claude/agents/300-design.md` | `200-spec.md` | `runs/<feature-slug>/300-design.md` |
| 4 | Architecture | `.claude/agents/400-architecture.md` | `300-design.md` | `runs/<feature-slug>/400-architecture.md` |
| 5 | Engineering | `.claude/agents/500-engineering.md` | `400-architecture.md` | `runs/<feature-slug>/500-implementation.md` |
| 6 | Data | `.claude/agents/700-data.md` | `400-architecture.md` | `runs/<feature-slug>/700-data-design.md` |
| 7 | Infra/Ops | `.claude/agents/800-infrastructure.md` | `400-architecture.md` + `500-implementation.md` + `700-data-design.md` | `runs/<feature-slug>/800-infra.md` |
| 8 | Security | `.claude/agents/900-security.md` | `400-architecture.md` + `500-implementation.md` + `700-data-design.md` + `800-infra.md` | `runs/<feature-slug>/900-security-review.md` |
| 9 | QA | `.claude/agents/600-qa.md` | `200-spec.md` + `500-implementation.md` + `700-data-design.md` + `800-infra.md` + `900-security-review.md` | `runs/<feature-slug>/600-test-plan.md` |
| 10 | Management / Delivery | `.claude/agents/1000-delivery.md` | all prior station outputs; `transcript.md` if it exists | `runs/<feature-slug>/1000-release-plan.md` |

A station is **valid** when its agent file holds a real role-agent spec, not the shipped placeholder.
Use your Final Kata spec first. If the spec is narrower than the station contract, add the overlay
from `STATION_ADAPTER.md` and mark it `own+overlay`. If you did not complete that role, copy the
matching fallback spec from `fallback-specs/` so all ten stations are present for the first run.
Keep the full station table and record `own`, `own+overlay`, `fallback`, or `fallback-after-gap` in
the run record instead of deleting stations.

## Building a feature (Pipeline 2)

Once the factory run has produced the plan + evidence pack, build the feature **test-first**.
Non-negotiables (facts + commands live in `docs/context/stack.md`):

- **Layering:** pure domain (no I/O), dependencies point inward, adapters at the edges, business
  logic never in the API handler or store adapter — see `docs/context/architecture.md`.  
- **R1 (no double-booking):** the store decides the race with one atomic conditional write.
  NEVER read-then-write in app code on the claim path.
- **R2 (identity):** derive the household from the verified session, NEVER the request
  body/query/header. No valid session ⇒ no read, no claim. (ADR-0001.)
- **R3 (residency + PII):** EU region only; `householdRef` is personal data — never log it.
- **Tests:** framework + real-DB tier per `stack.md`. The concurrency test runs on a REAL SQL
  Server (never in-memory) or CI fails — never skip it. Watch each test fail before implementing.
- **Secrets:** never commit secrets/connection strings; local dev config stays git-ignored.
- Follow `standards/git-workflow.md` for branches/commits; escalate anything touching a `gap-log` item.

## Human gates

Pause and ask the human when a station hits a decision the agent should not make alone — a scope
cut, an accepted risk, an ambiguous requirement that would otherwise harden into a guess.

Use these statuses:

- `training-open`: record a missing human decision and continue with a safe labelled assumption;
  this blocks production-like use.
- `hard-stop`: stop because continuing would require unsafe data, secrets, live writes, regulated
  approval, budget approval, or release commitment.
- `missed`: the line continued when it should have paused; record it as a finding.
- `paused-approved`: the line paused, a human owner approved the decision, and the run continued.
- `paused-blocked`: the line paused and stayed blocked because no owner approved the decision.
- `recorded-open`: the decision is known and recorded, but not needed to continue the training run.
- `n/a`: no gate applies.
