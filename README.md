# Your AI Factory — starter repo

A ready-to-wire AI software-delivery factory. Add your role-agent specs, write one feature, run
it through the line, and read where the handoffs break.

## What's here

- [`CLAUDE.md`](CLAUDE.md) — the **orchestrator**: the station order, the handoff map, and the run protocol.
- [`station-registry.yaml`](station-registry.yaml) — the station inventory and fallback mapping.
- [`handoff-map.yaml`](handoff-map.yaml) — the explicit graph from station output to downstream input.
- [`factory-passport.md`](factory-passport.md) — the scope, evidence, and recommendation frame.
- [`QUICKSTART.md`](QUICKSTART.md) — a non-engineer launch guide with a manual fallback path.
- [`STATION_ADAPTER.md`](STATION_ADAPTER.md) — how to turn a Skill, sub-agent, or prompt into a station slot.
- [`PREFLIGHT.md`](PREFLIGHT.md) — checks before the first station call.
- [`COST_GUARDRAILS.md`](COST_GUARDRAILS.md) — the low-cost run boundary and stop conditions.
- [`MANUAL_RUN_PROMPTS.md`](MANUAL_RUN_PROMPTS.md) — station-by-station prompts for manual mode.
- [`station-slots/`](station-slots/) — visible station wrappers to edit first.
- [`.claude/agents/`](.claude/agents/) — Claude Code adapter files; copy adapted station slots here when using Claude Code.
- [`AGENTS.md`](AGENTS.md) — Codex guided-mode instructions.
- [`.cursor/rules/ai-factory.mdc`](.cursor/rules/ai-factory.mdc) — Cursor guided/manual mode instructions.
- [`fallback-specs/`](fallback-specs/) — thin station specs for modules you did not complete.
- [`feature.md`](feature.md) — the **task**: the one feature you run through the line.
- [`runs/`](runs/) — where each run writes station outputs, transcript, and run record.
- [`examples/meridian-cart-lookup/`](examples/meridian-cart-lookup/) — a complete worked reference run across all ten stations.

## Five steps

1. **Start with the quickstart.** If you are not a developer, follow
   [`QUICKSTART.md`](QUICKSTART.md). It uses the same factory, smaller prompts, and a manual fallback path.
2. **Add your specs.** For each role module you completed, adapt the Final Kata output through
   [`STATION_ADAPTER.md`](STATION_ADAPTER.md) and update the matching file in `station-slots/`.
   For Claude Code, copy the adapted station into `.claude/agents/`. For roles you did not
   complete, copy the matching file from `fallback-specs/` into `station-slots/`, then into
   `.claude/agents/` only when you use Claude Code. All ten visible station slots must be present
   for the required run.
3. **Write the task.** Fill in [`feature.md`](feature.md) with one small-to-medium feature from your running case.
4. **Start the factory.** Run [`PREFLIGHT.md`](PREFLIGHT.md). Then open this repo in an agent
   runtime (Claude Code, Cursor, Codex) and say:
   *"Run `feature.md` through the factory. Use low-cost mode: one pass per station, default or cheaper approved model, no background teams, no enterprise-transformation planning, stop at invalid station slots, and record seam findings instead of trying to hide them."* The line runs station to station, writing to `runs/<feature-slug>/`.
   No agent runtime? Run it by hand with [`MANUAL_RUN_PROMPTS.md`](MANUAL_RUN_PROMPTS.md).
5. **Read the seams and record the run.** Walk `runs/<feature-slug>/`, create the evidence files
   from the templates in `runs/`, and fill in the run record
   (template at [`runs/run-record.template.md`](runs/run-record.template.md)). Commit the whole repo.

## Low-cost first run

Keep the first pass bounded:

- one feature;
- one pass per station;
- default or cheaper approved model first; premium reasoning only for one named human-reviewed decision;
- no background teams, recursive station calls, or parallel autonomous workers;
- no enterprise-transformation planning;
- no secrets, client-confidential data, production credentials, or live writes;
- stop when a station slot is invalid, loops, asks for upstream context the saved artefacts should
  have carried, or tries to make a human-owned decision.

If you want to see the expected size before you run your own case, open
[`examples/meridian-cart-lookup/`](examples/meridian-cart-lookup/). The example is intentionally
small, but it runs all ten stations and includes multiple seam findings.

## Keep it honest

Let the line stall where a handoff breaks — do not hand-feed missing context to keep it green.
A stall names the seam your team hardens first; that is the deliverable.
