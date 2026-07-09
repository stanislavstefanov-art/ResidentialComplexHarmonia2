# Build an application using the AI Factory approach

Starting point: a rough idea. No code, no spec, no Harmonia-custom Final-Kata skills — off-the-shelf plugins only.
Ending point: merged, reviewed, production-ready code with a full evidence chain.

This guide is application-agnostic. It applies to any tech stack, language, or domain.
Replace `<build command>` and `<test command>` with the commands for your project.

---

## Core concept: two pipelines, one handoff

```
PIPELINE 1 — Planning (AI Factory)          PIPELINE 2 — Execution (four-step)
───────────────────────────────────         ──────────────────────────────────
rough idea → feature.md                     factory artefacts as input
→ /setup    (wire 10 station agents)        → /superpowers:test-driven-development
→ /run-factory (10 stations in order)           600 test cases are the task list
→ evidence pack + human gates               → /superpowers:requesting-code-review
→ human reviews + resolves findings             enriched bundle: spec + security + ADRs
→ human approves plan                       → /sdlc-factory:qa-gates
            ↓                                   build + test gate
       HANDOFF (manual today)               → /sdlc-factory:mr-creator
                                            → human reviews + merges
```

The factory produces the plan and evidence (Pipeline 1).
Pipeline 2 executes without re-deriving the spec or plan — it ingests the factory artefacts directly.
The conversation transcript IS the session log — no separate file needed.

> **Provenance note.** The EPAM AI Factory is a complete end-to-end methodology: all 10 stations
> (100→1000) cover opportunity through delivery — it is not defined by the course as a
> "planning-only front end." The `sdlc-factory` plugin used in Pipeline 2 above is the course's
> optional Lane-2 evaluation target (adopt / pilot / defer verdict) — it is not the course's
> prescribed execution mechanism. The "two pipelines" split in this guide is a pragmatic adaptation:
> the factory stations handle planning and evidence; `sdlc-factory` skills handle coding execution
> based on this project's adopt verdict. If you are using this guide outside that context, replace
> Pipeline 2 with whatever execution tooling your project has evaluated and adopted.

---

## Greenfield vs brownfield

**Greenfield** (new feature, no existing behaviour to modify): follow this guide start to finish.

**Brownfield** (modifying existing behaviour): produce a delta-spec BEFORE running the factory.
A delta-spec documents ADDED / MODIFIED / REMOVED behaviour. The REMOVED section is the hardest
to fill and the most important — an empty REMOVED on a non-trivial change is a red flag.
Use a delta-spec template and get human approval before Phase 2.

---

## Phase 0 — One-time project setup

Do this once when starting on a new project. Skip if already done.

### 0.1 Build the knowledge foundation (all projects)

```
/sdlc-factory:knowledge-foundation
```

This is the primary setup command. It:
1. Calls `knowledge-auditor` internally (read-only repo scan) to survey existing docs,
   AI configs, and structure
2. Generates the `.ai-run/guides/` folder from what it found — the warm context layer that
   tells every subsequent AI agent the project's build commands, conventions, architecture,
   and constraints
3. Wires the guides into AGENTS.md / CLAUDE.md entrypoints

`sdlc-autonomous`, `sdlc-pipeline`, and `mr-creator` **halt** if these three files are missing:
- `.ai-run/guides/project.md`
- `.ai-run/guides/standards/git-workflow.md`
- `.ai-run/guides/quality-gates.md`

Run `knowledge-foundation` once on every new project before any other sdlc-factory skill.

**Optional pre-check — run knowledge-auditor standalone first:**

```
/sdlc-factory:knowledge-auditor
```

Use this if you want to preview what the foundation will find before committing to running it.
The auditor is read-only and produces a report only — it does not write any guides.
`knowledge-foundation` calls the auditor as its own Phase 1, so running it separately
is optional. It is most useful on projects with existing complex documentation where you want
to inspect what will be preserved, replaced, or skipped before the foundation runs.

**Keeping guides current after the initial run:**

```
/sdlc-factory:knowledge-harvester
```

Use this to update existing guides when the codebase changes significantly (new dependencies,
changed build commands, new architecture patterns). Not needed for every feature — run it
when guides start drifting from reality.

### 0.2 Set up QA foundation (once per project)

```
/sdlc-factory:qa-foundation
```

This generates `.ai-run/guides/testing/qa-strategy.md` and `qa-health.md`.

**When you need it:** `qa-foundation` feeds `qa-planner`, which is consumed by orchestrator
flows (`sdlc-autonomous`, `sdlc-pipeline`). The composed four-step Pipeline 2 in this guide
does not invoke `qa-planner` and does not consume `qa-strategy.md` — so `qa-foundation` is
**optional** if you are using the composed pipeline exclusively. Run it if you expect to use
`sdlc-autonomous` or `sdlc-pipeline` on this project.

### 0.3 Get the factory infrastructure

If the `factory/` directory does not exist in your repo, copy the factory template:

```bash
cp -R /path/to/factory-template ./factory
```

The factory template provides:
- `factory/station-slots/` — 10 station wrappers to fill with your role-agent specs
- `factory/fallback-specs/` — generic specs for stations you haven't customised yet
- `factory/feature.md` — the input file for each factory run
- `factory/runs/` — where each run's artefacts are written

### 0.4 Wire station slots

```
/setup
```

This does three things:
- Copies your custom role-agent specs (Final Kata outputs) into `.claude/agents/`
- Drops fallback specs into any station without a custom spec
- Runs preflight checks and prints a 10-row `READY / NOT READY` checklist

**Station source options — record one per station in `run-record.md`:**

| Source | Use when |
|---|---|
| `own` | You built a custom skill for this role that covers the station contract |
| `own+overlay` | Your skill is narrower than the station needs — keep it and add the overlay |
| `fallback` | No custom spec for this role — generic fallback covers it |
| `fallback-after-gap` | Your spec failed mid-run — fallback used to continue |

Fix any `NOT READY` stations and re-run `/setup` until all 10 show `READY`.

If not on Claude Code, walk `factory/PREFLIGHT.md` manually instead.

---

## Phase 1 — Write the feature (feature.md)

Write ONE feature — not a full product. The factory runs one feature at a time.
Each feature gets its own branch, factory run, and PR.

**Scope it first (idea → one feature).** If you are starting from a raw idea — or from
a whole product phase ("expense tracking", "member directory") — you must carve **one
thin slice** before you can write `feature.md`. No factory station does this for you:
stations 100/200 elaborate a feature you hand them; they do not pick the slice or draw
its boundary. So this scoping is a real, separate step that sits in front of the factory.

Do it as a **light brainstorm** (e.g. `superpowers:brainstorming`), and use it for
exactly four things:
1. **Decompose** the idea/phase into candidate slices and their dependency order.
2. **Pick** the first one — the thinnest slice that stands up the spine the others hang
   off (a "walking skeleton"), not the flashiest.
3. **Draw the in/out boundary** — name what is explicitly deferred to later slices.
4. **Draft testable ACs**, including at least one failure case and one NFR.

**Then stop at `feature.md` — this is a hard boundary.** Do not let the brainstorm roll
on into a design doc or an implementation plan: the factory owns spec (200), design
(300), architecture (400), and the implementation plan (500). Continuing past
`feature.md` re-derives what the factory produces — the same duplication anti-pattern
Pipeline 2 avoids. If your brainstorming tool's default next step is a planning skill,
override it: the next step here is `/run-factory`, not `writing-plans`.

**Keep `feature.md` thin — push real decisions into the factory.** Policy, compliance,
schema, and data-classification calls (retention periods, lawful basis, currency,
correction mechanisms) are **station and human-gate decisions**, not things to bury in
an AC. Naming them in `feature.md` as "deferred to stations 700/900" is better than
pre-deciding them — it hands the factory the real decisions it exists to surface.

**Shape:**

```markdown
# Feature for the factory run

[2-3 sentences: what problem it solves and who it's for]

## Acceptance criteria
- [ ] [AC 1 — measurable and testable]
- [ ] [AC 2]
- [ ] [AC 3 — include at least one failure or edge case]
- [ ] [AC 4 — include at least one performance or timeout constraint]
```

**What makes a good first feature:**
- Touches at least 6 stations (product, design, architecture, engineering, data, security)
- Has a clear constraint — compliance, performance, safety, or integration — that gives
  the factory real decisions to surface
- Small enough to implement in one coding session

**What to avoid:**
- A full product ("build a claims management system") — too large for one factory run
- Vague ACs ("it should work correctly") — gives the factory nothing to verify against
- Missing failure modes — every feature needs at least one "when X fails, do Y" AC
- Missing non-functional requirements — latency, availability, data residency

---

## Phase 2 — Run the factory (planning pipeline)

```
/run-factory
```

**First artifact — snapshot the input.** When the run starts, the orchestrator creates
`factory/runs/<slug>/` and copies the current `feature.md` into it as
`factory/runs/<slug>/feature.md`, *before* Station 100. This keeps each run pack
self-contained — the exact input that seeded it lives beside the station outputs. The
root `feature.md` stays the reusable working input and is overwritten for the next feature.

The factory drives your feature through all 10 stations in this order:

```
100 → 200 → 300 → 400 → 500 → 700 → 800 → 900 → 600 → 1000
```

Note: QA (600) runs near the end after security (900) so it can incorporate threat findings.

**What each station produces:**

| Station | Produces | Key discipline |
|---------|----------|---------------|
| 100 Consulting/SME | Opportunity brief: use cases scored by value × feasibility, ROI with confidence intervals, Responsible-AI section, 6Rs recommendation | Estimates MUST carry confidence intervals — single-number estimates are a red flag |
| 200 Product/BA | Spec: user stories, Gherkin ACs, RICE-prioritised backlog, traceability, NFRs | Human gate: spec must be approved before Station 300 starts |
| 300 Design | Journey map, AI-aware acceptance clauses, screen/state inventory, agent handoff notes | Open questions from Station 200 must be resolved here or labelled as assumptions |
| 400 Architecture | 3 scored options, chosen option, ADRs (status: proposed), component sketch, NFR budgets across 5 families | Human gate: option must be confirmed before Station 500 |
| 500 Engineering | Implementation plan: pseudocode for key components, test approach table (tier per test), 7-lens review of the plan | Produces a PLAN — not code. Human gate: merge is human-owned |
| 700 Data | Data product spec: entities, schema sketch, residency constraints, PII/PHI flags | Data classification is human-owned — station flags, human confirms |
| 800 Infra/Ops | Deployment shape, L1/L2 runbook, kill switches with named owners, release checklist | Will surface gaps if Station 500 plan lacks deployment detail |
| 900 Security | Threat model (classical + OWASP), risk ratings, residual risk contracts, EU AI Act tiers | Findings are fed into Station 600 test cases |
| 600 QA | Test plan: one test case per AC minimum, security-driven cases, negative cases, data method | All ACs must have ≥1 test case — any AC with 0 tests is a gap |
| 1000 Delivery | Release plan: RAG status, risk register, stakeholder notes, maturity evidence, recommendation | Human gate: release commitment is human-owned |

**The 7 lenses in Station 500 (named for reference):**
Correctness · Security · Performance · Observability · Maintainability · Compliance · Adversarial

**The rule that makes the run honest:**
When a station asks for context it should have received from upstream, do NOT hand-feed it.
Record the seam and continue only with a labelled assumption.
A stall is a finding, not a failure — the seam ledger is the deliverable.

**Output location:** `factory/runs/<feature-slug>/`

> **Path note.** This guide uses `factory/runs/<slug>/` throughout. If your project wires the
> factory differently (e.g. at the repo root as `runs/<slug>/`), drop the `factory/` prefix
> everywhere. The slug and file names are the same regardless of where the factory directory sits.

### If the factory run stops mid-run

The run stops when a station hits an invalid slot, a hard-stop gate, or cannot produce
its named output. Do NOT restart from the beginning.

1. Check `factory/runs/<slug>/transcript.md` — which station stopped and why
2. Resolve the cause (fill the station slot, answer the gate, fix the upstream gap)
3. Re-run only the stopped station and continue from there
4. Record the stall as a seam finding in `seam-ledger.md`

A `documented-stall-pass` is valid — the station produced a labelled output using
documented assumptions. Continue only if the downstream station can read it without
needing new facts invented mid-run.

### Cost guardrails

Keep the first run bounded:
- One feature, one pass per station, 10 station calls maximum
- Default or cheaper approved model — reserve premium models for ONE named human-reviewed
  decision only, and record the reason in `cost-log.md`
- No background teams, no parallel autonomous agents, no recursive station calls
- Stop when a station asks for secrets, credentials, or production data

---

## Phase 3 — Human review (evidence pack)

After the factory run completes, review these files in order before touching any code.

### 3.1 Transcript
`factory/runs/<slug>/transcript.md`

One line per station. Tells you which stations fired gates and which had seam issues.
Read this first — it tells you where to focus the rest of the review.

### 3.2 Human gates
`factory/runs/<slug>/human-gates.md`

Update each gate status to one of:

| Status | Meaning | Can proceed to coding? |
|---|---|---|
| `paused-approved` | You reviewed and approved | Yes |
| `paused-blocked` | Gate fired, no owner approved | No — resolve first |
| `recorded-open` | Known, not blocking this run | Yes — note in provenance |
| `training-open` | Safe for training, blocks production | Yes — note as known limitation |
| `hard-stop` | Cannot continue without human decision | No — resolve first |
| `missed` | Line continued when it should have paused | Assess impact; may require re-run |
| `n/a` | No gate applies at this station | Yes |

**The gate that matters most:** spec approval (Station 200 → 300).
If the spec was never human-approved, every downstream artefact is provisional.
All stations 300–1000 are untrustworthy until the spec is approved.

### 3.3 Seam ledger
`factory/runs/<slug>/seam-ledger.md`

Each handoff is marked with one of:

| Mark | Meaning |
|---|---|
| `clean` | Downstream got exactly what it needed |
| `under-supply` | Upstream missed something downstream needed |
| `over-supply` | Upstream carried more than downstream could use |
| `missing` | No station owned this handoff |
| `routing` | Work went to the wrong station |

Under-supply seams that affect the spec or the implementation plan are blocking.
All others are recorded and hardened in future runs.

### 3.4 Final recommendation
`factory/runs/<slug>/final-recommendation.md`

The delivery station produces a RAG status:
- **GREEN** — proceed to coding
- **AMBER** — proceed with named cautions; each caution needs an owner
- **RED** — resolve named blockers before coding starts

---

## Phase 3b — Handling findings

Every finding from the factory run is either **blocking** or **non-blocking**.

**One question determines the category:**
> Would resolving this finding change what the code does or how it behaves?
> YES → blocking. NO → non-blocking.

### Blocking findings — must resolve before Phase 4

| Finding | Where | Resolution |
|---|---|---|
| `hard-stop` or `paused-blocked` gate | `human-gates.md` | Named human makes the decision; update gate status to `paused-approved` |
| Spec never approved | `human-gates.md` (missed gate) | Human approves spec; all stations 300–1000 re-evaluated |
| RED blocker in final recommendation | `final-recommendation.md` | Each RED item resolved with named owner and date before coding |
| High/Critical severity finding in 500 7-lens review | `500-implementation.md` | Address in the plan before coding; escalate security-class findings |
| Seam that invalidates the spec | `seam-ledger.md` | Update `200-spec.md`, get human approval, then re-enter at the earliest affected station (see delta-run below) |
| New requirement that changes scope | Any station | Treat as spec change; do not silently absorb into coding session |

### Non-blocking findings — record and proceed

| Finding | Where | How to handle |
|---|---|---|
| `training-open` gate | `human-gates.md` | Proceed; record as known limitation in PR provenance block; resolve before production |
| `recorded-open` gate | `human-gates.md` | Proceed; record owner and resolution path |
| Low/Medium severity finding in 500 7-lens review | `500-implementation.md` | Address in coding session; each finding becomes a named task in the implementation |
| Under-supply seam that doesn't affect spec | `seam-ledger.md` | Proceed with labelled assumption; add hardening task to next sprint |
| AMBER RAG status | `final-recommendation.md` | Proceed; each AMBER item needs a named owner and resolution date |
| New feature discovered mid-run | Any station | Do NOT add to current scope; write as the next `feature.md`; add to deferred list |
| Missing owner for a policy, schema, or decision | Station 700 or 900 | Proceed with named assumption from stakeholder map; must be confirmed before production |
| Missing deployment detail (no container spec, no Helm chart) | Seam 500→800 | Infra used assumptions; engineering supplies manifest before production deployment |

### Decision tree

```
Finding appears in factory run
         ↓
Would resolving it change what the code does?
    YES                      NO
     ↓                        ↓
BLOCKING               NON-BLOCKING
Stop. Resolve.         Record in provenance.
Update gate.           Address in coding or defer.
Re-run affected        Write next feature.md
stations if needed.    if it's a new requirement.
     ↓
Proceed to Phase 4.
```

### Delta-run re-entry

When a blocking finding requires changes, you rarely need to restart from Station 100.
Re-enter at the **earliest station whose _output_ must change**, regenerate that artefact, and
inherit every station upstream of it unchanged.

| Finding forces a change to… | Re-enter at | Re-runs (run order) | Inherited unchanged |
|---|---|---|---|
| Spec (user stories / ACs) | 200 | 200 → 300 → 400 → 500 → 700 → 800 → 900 → 600 → 1000 | 100 |
| Design | 300 | 300 → 400 → 500 → 700 → 800 → 900 → 600 → 1000 | 100–200 |
| Architecture | 400 | 400 → 500 → 700 → 800 → 900 → 600 → 1000 | 100–300 |
| Implementation plan | 500 | 500 → 800 → 900 → 600 → 1000 | 100–400, **700** |
| Data model / schema | 700 | 700 → 800 → 900 → 600 → 1000 | 100–500 |

**The rule:** identify which station's _output_ must change. That station regenerates its
artefact (re-run the agent, or hand-edit and re-approve it). Then every station **downstream in
run order that consumes a changed input** re-runs; every station upstream is inherited as-is.

**Watch the handoff map, not just the run order.** Two cases are non-obvious:
- **A changed implementation plan (500) re-runs 800, 900 _and_ 600 — it does not skip to 600.**
  Station 700 (Data) reads only `400-architecture.md`, so it is inherited and skipped — but 800,
  900 and 600 all read `500-implementation.md`, so all three re-run. Critically, a
  **security-driven** implementation change is therefore re-reviewed by Security (900) on the way
  back down; jumping straight to 600 would skip that re-review.
- **A changed data model (700) re-enters at 700**, then re-runs 800 → 900 → 600 → 1000 (700 also
  feeds 800/900/600, so none of them can be skipped).

Go back to Station 200 only if the spec itself (stories / ACs) changes; a design, architecture,
implementation, or data fix re-enters lower down without reopening the approved spec.

### Sign-off before coding starts

Update these four files. They are your evidence that a human reviewed the factory run:

```
factory/runs/<slug>/human-gates.md    ← gate statuses updated
factory/runs/<slug>/seam-ledger.md    ← resolved seams marked; deferred items noted
factory/runs/<slug>/risk-note.md      ← accepted risks recorded with owner and date
factory/runs/<slug>/eval-report.md    ← which findings addressed vs deferred
```

---

## Phase 4 — Coding (execution pipeline)

This is where actual code gets written. For factory-backed work, the right pipeline is
the four-step composition below — it ingests the factory artefacts directly and does not
re-derive a spec or plan.

### Choose the right coding approach

| Situation | Approach |
|---|---|
| Factory run completed; spec + plan + test cases from the factory | **Four-step pipeline** (Steps 4.1–4.4 below) — recommended |
| Large or complex feature; want full autonomous orchestration with per-task subagents | `/sdlc-factory:sdlc-autonomous` |
| No factory run; standalone task where you want built-in spec/plan/TDD/review | `/sdlc-factory:sdlc-task` — re-derives spec and plan from scratch |

Do not use `sdlc-task` as Pipeline 2 for factory-backed work. It always runs its own
brainstorm and plan stages (Stages 3 and 4) — duplicating the work the factory already did.

### 4.1 TDD implementation

```
/superpowers:test-driven-development
```

The `600-test-plan.md` cases from the factory run are the task list. For each test case:

1. Write the failing test (RED — must be visible before any implementation)
2. Implement minimum code to make it pass (GREEN — no extra behaviour)
3. Refactor if needed
4. Commit

A test that passes before any implementation is written means the test is wrong — stop and fix it.

**How to reference factory artefacts during TDD:**

```
Implement [feature name].
Spec: factory/runs/<slug>/200-spec.md — [N] ACs, all must pass.
Implementation plan: factory/runs/<slug>/500-implementation.md — pseudocode + component list.
Task list: factory/runs/<slug>/600-test-plan.md — work through cases in order.
Security findings to address: factory/runs/<slug>/900-security-review.md (R1/R2/R3).
Architecture decision: [chosen option + relevant ADRs from 400-architecture.md].
```

### 4.2 Code review gate (enriched bundle)

```
/superpowers:requesting-code-review
```

Pass an **enriched requirements bundle** as `{PLAN_OR_REQUIREMENTS}` — not just the spec.
The bundle must include:

```
1. factory/runs/<slug>/200-spec.md          ← spec + ACs (what the code must do)
2. factory/runs/<slug>/900-security-review.md   ← R1/R2/R3 findings + invariants
3. Relevant ADRs from factory/runs/<slug>/400-architecture.md  ← architectural constraints
```

Without the security findings in the bundle, an AC-green review can still hide a security
regression — a passing spec check does not mean the security invariants were checked.

**Code review skill hierarchy:**

| Skill | Requires | Checks |
|---|---|---|
| `sdlc-factory:code-reviewer` | `.ai-run/guides/` wired (run `knowledge-foundation` first) | AC compliance + spec + security guide checks — tightest option |
| `requesting-code-review` + enriched bundle | Nothing — works on any project | AC compliance against your bundle; picks up security findings — **portable default** |
| `/code-review` | Nothing | Code quality and bugs only — **NOT a spec-compliance check** |

For factory-backed work, `/code-review` alone is not sufficient — use `requesting-code-review`
with the enriched bundle as the default, or `sdlc-factory:code-reviewer` if guides are wired.

### 4.3 Build + test gate

```
/sdlc-factory:qa-gates
```

Parameters: `branch`, `merge_base`, `repo_path`, `run_dir`.

In the composed pipeline no orchestrator creates a `docs/superpowers/tasks/` directory, so
pass `run_dir: factory/runs/<slug>/` — the qa-report will be written alongside the rest of
the factory evidence for this feature.

Runs `<build command>` and `<test command>` with retries. All tests must pass before
opening a PR. If `qa-gates` blocks, fix inline and re-run — maximum 3 retries before
escalating.

### 4.4 Open PR

```
/sdlc-factory:mr-creator
```

See Phase 5 for provenance block requirements.

---

## Phase 5 — Open PR

```
/sdlc-factory:mr-creator
```

Opens a PR containing:
- The source files and tests written in Phase 4
- A provenance block in the PR description referencing all factory artefacts
- The QA report from `qa-gates` (Phase 4 step 3)
- Code review findings and how they were addressed

**Provenance block must include:**
- Spec: `factory/runs/<slug>/200-spec.md`
- Architecture: `factory/runs/<slug>/400-architecture.md`
- Implementation plan: `factory/runs/<slug>/500-implementation.md`
- QA test plan: `factory/runs/<slug>/600-test-plan.md`
- Security review: `factory/runs/<slug>/900-security-review.md`
- Session log: conversation transcript (path or reference)
- Known limitations: all `training-open` items from `human-gates.md`
- SDD approach: four-phase factory run

A PR without a complete provenance block is not reviewable — a reviewer cannot reconstruct
what was checked without it.

---

## Phase 6 — Human review and merge

The AI does not merge. A human:
1. Reads the PR diff against the spec ACs — does the code implement what the spec says?
2. Checks the provenance block — are all links present and resolvable?
3. Verifies the QA report — do all tests pass?
4. Checks that all blocking findings from Phase 3b were addressed
5. Approves and merges

---

## Handling deferred features and new requirements

**Use cases deferred at Station 200:**
Station 200 scores use cases and defers low-feasibility or out-of-sprint items.
Each deferred item becomes the next `feature.md`. Do not try to include them in the current run.

**New requirements surfacing at Stations 700/800/900:**
Stations running after Station 500 regularly surface requirements that weren't visible earlier
(data residency constraints, infra shape, security controls). Handle them as:

| Impact | Action |
|---|---|
| Changes the spec (user stories / ACs) | Regenerate `200-spec.md` (re-run 200 or hand-edit + re-approve); re-enter at Station 200; inherit Station 100 |
| Changes architecture but not the spec | Re-enter at Station 400; inherit Stations 100–300 unchanged |
| Changes the implementation plan but not architecture | Re-enter at Station 500; inherit Stations 100–400 **and 700**; re-run 800 → 900 → 600 → 1000 |
| Changes the data model only | Re-enter at Station 700; inherit Stations 100–500 unchanged; re-run 800 → 900 → 600 → 1000 |
| Adds a deployment or infra task | Queue as a separate task in the next sprint; record in seam-ledger |
| Is a new feature entirely | Write as a new `feature.md`; run the factory again |

Keep each factory run focused on ONE feature. The pipeline stays linear.

---

## Evolving the factory over time

The factory improves with each run. After every completed feature:

1. **Identify the weakest station** — which station produced the most assumptions or the most
   under-supply seams? That station is the best candidate for a custom skill upgrade.

2. **Replace one fallback with a custom skill** — write a role-agent skill for that station
   using the patterns from your completed run as examples. Wire it into `station-slots/`.

3. **Re-run the next feature with the upgraded station** — measure whether the seam count
   drops.

The factory becomes domain-specific progressively. You do not need custom skills for all
10 stations before the first run — start with fallbacks and improve one station at a time.

---

## Quick reference — commands

| When | Command |
|---|---|
| Build guides from codebase (first time, required) | `/sdlc-factory:knowledge-foundation` |
| Preview what foundation will find (optional) | `/sdlc-factory:knowledge-auditor` |
| Update guides after major codebase changes | `/sdlc-factory:knowledge-harvester` |
| Set up QA foundation (first time) | `/sdlc-factory:qa-foundation` |
| Wire station slots | `/setup` |
| Run planning pipeline | `/run-factory` |
| **Pipeline 2 step 1** — TDD implementation (factory-backed) | `/superpowers:test-driven-development` |
| **Pipeline 2 step 2** — Code review with enriched bundle | `/superpowers:requesting-code-review` |
| **Pipeline 2 step 3** — Build + test gate | `/sdlc-factory:qa-gates` |
| **Pipeline 2 step 4** — Open PR with provenance block | `/sdlc-factory:mr-creator` |
| Full autonomous pipeline including coding (large/complex) | `/sdlc-factory:sdlc-autonomous` |
| Standalone task without factory run (re-derives spec + plan) | `/sdlc-factory:sdlc-task` |

---

## What is built in vs what is manual

| Concern | Built in? | Where |
|---|---|---|
| Use case scoring with value × feasibility | Yes | Station 100 |
| Confidence intervals on all estimates | Yes | Station 100 enforced |
| Spec with Gherkin ACs and traceability | Yes | Station 200 |
| Architecture options with ADRs | Yes | Station 400 |
| 7-lens plan review + adversarial pass | Yes | Station 500 |
| Threat model + OWASP review | Yes | Station 900 |
| QA test plan from spec + security inputs | Yes | Station 600 |
| TDD enforcement (Red/Green/Refactor) | Yes | `superpowers:test-driven-development` (Pipeline 2 step 1) |
| Code review against spec + security findings | Yes (with enriched bundle) | `superpowers:requesting-code-review` (Pipeline 2 step 2) |
| Build + test gate | Yes | `sdlc-factory:qa-gates` (Pipeline 2 step 3) |
| Session log | Yes (transcript) | Conversation transcript |
| Provenance block in PR | Yes | `mr-creator` (Pipeline 2 step 4) |
| Human gates (pauses line at key decisions) | Yes | factory (Pipeline 1) |
| Delta-spec for brownfield changes | Manual | Produce before Phase 2 |
| Handoff from factory artefacts → execution pipeline | Manual today | Write enriched task description referencing factory artefacts |
| Deferred features queued | Manual | Write next feature.md after each run |
| Custom skill upgrades per station | Manual | Replace fallbacks one at a time after each run |
