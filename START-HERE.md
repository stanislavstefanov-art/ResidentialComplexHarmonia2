# Start your AI factory — 5 steps

The whole job: drop in your specs, pick a feature, run one command, watch where the handoffs break,
read the result. The output that matters is *where the line stalls* — not a clean demo.

Two ways through these steps:

- **Claude Code / CodeMie Claude** — run the `/setup` and `/run-factory` commands this repo ships (steps 3–4).
- **Cursor, Codex, or approved chat** — the same steps by hand: walk [`PREFLIGHT.md`](PREFLIGHT.md),
  then drive the line with [`MANUAL_RUN_PROMPTS.md`](MANUAL_RUN_PROMPTS.md). Not a developer?
  [`QUICKSTART.md`](QUICKSTART.md) takes the same path with smaller prompts. Run boundaries:
  [`COST_GUARDRAILS.md`](COST_GUARDRAILS.md).

> ⚠️ No secrets, credentials, or client-confidential data in any file or prompt. Use a
> representative case when the real one is restricted.

---

## 1 · Place your specs

> 📌 You stand up your own copy of the factory and drop in the role-agent spec you built as each
> module's Final Kata, so the specs, the run, and its outputs live in your repo — not the course.

Copy the whole `factory-template/` directory into your sandbox repo, then drop each completed
module's Final Kata spec into the matching file in [`station-slots/`](station-slots/): paste your
role rules into its `## Role rules` section following [`STATION_ADAPTER.md`](STATION_ADAPTER.md),
keep the station-overlay block, and set `Station source:` to `own` (or `own+overlay` if your spec is
narrower than the station needs).

No spec for a role? Leave its slot — `/setup` copies the matching fallback in for you in step 3.
Don't delete any station; the run needs all ten.

```bash
# from the root of your sandbox repo
cp -R /path/to/curriculum/modules/1111-assembly-line/factory-template ./factory
cd factory
```

| Station | Slot file |
|---|---|
| 100 Consulting | `station-slots/100-consulting.md` |
| 200 Product | `station-slots/200-product.md` |
| 300 Design | `station-slots/300-design.md` |
| 400 Architecture | `station-slots/400-architecture.md` |
| 500 Engineering | `station-slots/500-engineering.md` |
| 700 Data | `station-slots/700-data.md` |
| 800 Infra/Ops | `station-slots/800-infrastructure.md` |
| 900 Security | `station-slots/900-security.md` |
| 600 QA | `station-slots/600-qa.md` |
| 1000 Delivery | `station-slots/1000-delivery.md` |

## 2 · Add a feature (or use the example)

> 📌 You give the line one concrete thing to carry end to end. Small keeps the run cheap and each
> handoff readable — the goal is to watch it travel, not to ship something big.

Open [`feature.md`](feature.md) and write a single small feature in this shape:

```markdown
# Feature for the factory run

[Two or three sentences: what it is and who it's for.]

## Acceptance criteria
- [bullet]
- [bullet]
```

Pick a slug like `cart-lookup` (lowercase, hyphens). First pass and nothing to hand? Run the bundled
[`examples/meridian-cart-lookup/`](examples/meridian-cart-lookup/) feature as-is.

## 3 · Run `/setup`

> 📌 One command turns ten placeholders into a runnable line and catches broken slots, the wrong
> order, or a leaked secret before you spend a single model call. A failed setup is far cheaper than
> a failed run.

Open the repo in Claude Code (`claude`) and run:

```text
/setup
```

It copies every filled station slot into `.claude/agents/`, drops the matching fallback into any
slot you left empty, runs the [`PREFLIGHT.md`](PREFLIGHT.md) checks, and prints a 10-row checklist of
what is ready and what is still red. Fix the red rows and re-run until it prints `READY`.

> Not on Claude Code? Walk [`PREFLIGHT.md`](PREFLIGHT.md) by hand — the same checks.

Fail fast on any slot still shipping the placeholder (expect no output):

```bash
grep -rl "INVALID PLACEHOLDER" station-slots .claude/agents
```

## 4 · Run `/run-factory` and watch

> 📌 You let the feature travel station to station so each handoff actually happens. Keep it honest
> rather than clean — this is the run whose seams you read next, and it is the point of the exercise.

```text
/run-factory
```

The feature travels all ten stations in order — note it is not strictly numeric (Data runs before
Infra; QA near the end):

`100 → 200 → 300 → 400 → 500 → 700 → 800 → 900 → 600 → 1000`

Each station reads its upstream file and writes its own output into `runs/<feature-slug>/`; the
running log lands in `runs/<feature-slug>/transcript.md`. When the line stops or completes,
`/run-factory` drafts the evidence pack (seam-ledger, human-gates, eval, cost, risk,
recommendation, run-record) from the run.

> Not on Claude Code? Open the repo (`cursor .` or `codex`) and drive the same line by hand with
> [`MANUAL_RUN_PROMPTS.md`](MANUAL_RUN_PROMPTS.md): open each station in turn, paste the upstream
> file, save the output, feed the next.

**The one rule that makes the run worth doing:** when a station asks for context it should have
received, do not hand-feed it. Record *what it needed and which upstream station should have carried
it*, then stop or continue only from saved artefacts. A stall is the finding, not a failure.

## 5 · Check the result

> 📌 You make the run inspectable and own its findings. `/run-factory` drafts the pack; you read the
> transcript, confirm and sharpen the seams, and commit — the team bootcamp clones it, runs a
> different feature, and decides which handoff to harden first.

Open `runs/<feature-slug>/` and review:

- every station output (`100-opportunity-brief.md` … `1000-release-plan.md`) + `transcript.md`;
- `seam-ledger.md` — confirm **at least 3** handoff findings (clean / under-supply / over-supply /
  missing / routing), each naming the two stations and the file, e.g.
  `200 Product -> 300 Design, 200-spec.md, under-supply: no empty-state requirement`;
- `human-gates.md` — **at least 2** places the line paused or should have;
- `eval-report.md`, `cost-log.md`, `risk-note.md`, `final-recommendation.md`, `run-record.md`.

Sharpen anything the draft left generic, then commit the whole repo. That run pack is what the
bootcamp reviews.

```bash
git add -A
git commit -m "factory run: cart-lookup"
git push
```

---

**Tip.** Skim [`examples/meridian-cart-lookup/`](examples/meridian-cart-lookup/) first — it shows all
ten station outputs and the exact evidence shape your run should produce.
