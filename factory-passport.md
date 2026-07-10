# Factory Passport

Use this file to describe the factory you are about to run. Keep it factual; the run record will
capture what happened.

## Factory scope

- **Running case:** [name]
- **Feature slug:** [short-slug]
- **Feature boundary:** one small-to-medium feature, one pass per station.
- **Out of scope:** background agent teams, parallel autonomous workers, recursive station calls,
  live production writes, secrets, client-confidential data, enterprise-transformation planning.

## System of Agency parts

| Part | File or location | Filled? |
|------|------------------|---------|
| Station registry | `station-registry.yaml` and `.claude/agents/*.md` | yes / no |
| Handoff graph | `handoff-map.yaml` and `CLAUDE.md` | yes / no |
| Context substrate | `feature.md`, station specs, safe project notes | yes / no |
| Run protocol | `CLAUDE.md` | yes / no |
| Human gates | `runs/<feature-slug>/human-gates.md` | yes / no |
| Verification layer | `runs/<feature-slug>/eval-report.md` | yes / no |
| Telemetry / run record | `runs/<feature-slug>/transcript.md`, `cost-log.md`, `run-record.md` | yes / no |

## Station source policy

Use your own Final Kata spec when you have it. Use the adapter guide when it needs a Module 1111
wrapper: [`STATION_ADAPTER.md`](STATION_ADAPTER.md).

| Source option | Use when |
|---------------|----------|
| `own` | Your Final Kata spec already covers the station contract and output file. |
| `own+overlay` | Your Final Kata spec is useful but narrower than the Module 1111 station contract. |
| `fallback` | You did not complete that role module; copy `fallback-specs/<station>.md`. |
| `fallback-after-gap` | You tried your own spec, found a scope gap, and used fallback to keep the training run honest. |

Fill the snapshot below before the run starts. The run record captures what actually happened after
the run.

## Station source snapshot

| Station | Planned source (`own` / `own+overlay` / `fallback` / `fallback-after-gap`) | Visible station slot | Claude adapter if used | Note |
|---------|------------------------------------------------------------------------------|----------------------|------------------------|------|
| 100 Consulting / SME | `fallback` | `station-slots/100-consulting.md` | `.claude/agents/100-consulting.md` | No Final Kata spec; wired from `fallback-specs/`. |
| 200 Product / BA | `fallback` | `station-slots/200-product.md` | `.claude/agents/200-product.md` | No Final Kata spec; wired from `fallback-specs/`. |
| 300 Design | `fallback` | `station-slots/300-design.md` | `.claude/agents/300-design.md` | No Final Kata spec; wired from `fallback-specs/`. |
| 400 Architecture | `fallback` | `station-slots/400-architecture.md` | `.claude/agents/400-architecture.md` | No Final Kata spec; wired from `fallback-specs/`. |
| 500 Engineering | `fallback` | `station-slots/500-engineering.md` | `.claude/agents/500-engineering.md` | No Final Kata spec; wired from `fallback-specs/`. |
| 700 Data | `fallback` | `station-slots/700-data.md` | `.claude/agents/700-data.md` | No Final Kata spec; wired from `fallback-specs/`. |
| 800 Infra/Ops | `fallback` | `station-slots/800-infrastructure.md` | `.claude/agents/800-infrastructure.md` | No Final Kata spec; wired from `fallback-specs/`. |
| 900 Security | `fallback` | `station-slots/900-security.md` | `.claude/agents/900-security.md` | No Final Kata spec; wired from `fallback-specs/`. |
| 600 QA | `fallback` | `station-slots/600-qa.md` | `.claude/agents/600-qa.md` | No Final Kata spec; wired from `fallback-specs/`. |
| 1000 Management / Delivery | `fallback` | `station-slots/1000-delivery.md` | `.claude/agents/1000-delivery.md` | No Final Kata spec; wired from `fallback-specs/`. |

## Recommendation options

At the end, choose one:

- **Adopt for bootcamp:** all required evidence exists and risks are bounded.
- **Pilot with fixes:** useful run, but one or more seams or gates need hardening before team use.
- **Defer:** evidence is too thin, unsafe, or hard to explain.
