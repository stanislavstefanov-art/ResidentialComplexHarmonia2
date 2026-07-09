# AGENTS.md -- Module 1111 guided factory mode

Use this file when running the factory in Codex or another runtime that reads repository
instructions.

## Mission

Run one feature through the Module 1111 hand-wired AI factory. The station contract lives in
`station-slots/`. Runtime-specific folders are adapters; the station order and handoff map are the
source of truth.

## Required files

- `feature.md`
- `station-registry.yaml`
- `handoff-map.yaml`
- `factory-passport.md`
- `station-slots/*.md`
- `PREFLIGHT.md`
- `COST_GUARDRAILS.md`
- `MANUAL_RUN_PROMPTS.md`

## Run protocol

1. Run the checks in `PREFLIGHT.md`.
2. Create `runs/<feature-slug>/`.
3. Execute stations in this order: `100,200,300,400,500,700,800,900,600,1000`.
4. For each station, read only the upstream files listed in `handoff-map.yaml`.
5. Write the station's named output file.
6. Append a short note to `runs/<feature-slug>/transcript.md`.
7. Stop or record a seam when upstream context is missing. Do not answer with new facts.
8. Stop at a `hard-stop` human gate.
9. Fill the evidence pack after the station run.

## Runtime boundary

No additional orchestration framework is required. Do not spawn parallel agents, background teams,
recursive calls, or broad transformation planning. Use one pass per station and the default or
cheaper approved model unless `COST_GUARDRAILS.md` allows one named premium decision.
