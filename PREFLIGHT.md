# Preflight -- before you run the factory

Use this checklist before the first station call. Fix failed items before you run, or record the
stop in `runs/<feature-slug>/run-record.md`.

## Feature and folders

- [ ] `feature.md` names one real feature and acceptance criteria.
- [ ] The feature slug uses lowercase words and hyphens, for example `cart-lookup`.
- [ ] `runs/<feature-slug>/` exists or will be created by the run.
- [ ] You did not edit YAML files only to replace `<feature-slug>`; keep it as a path placeholder.

## Station slots

- [ ] All 10 station slots exist.
- [ ] No station file starts with `# INVALID PLACEHOLDER -- DO NOT RUN`.
- [ ] Each station has a role goal.
- [ ] Each station names exact `Reads`.
- [ ] Each station names exact `Writes`.
- [ ] Each station names human gates.
- [ ] Each station has a done-when check.
- [ ] Each station names its output path.
- [ ] Each station records one source option: `own`, `own+overlay`, `fallback`, or `fallback-after-gap`.

## Registry and handoffs

- [ ] `station-registry.yaml` station order is `100,200,300,400,500,700,800,900,600,1000`.
- [ ] `handoff-map.yaml` execution order is `100,200,300,400,500,700,800,900,600,1000`.
- [ ] The handoff map names every upstream file required by stations 800, 900, 600, and 1000.
- [ ] The station source snapshot in `factory-passport.md` records planned `own`,
      `own+overlay`, `fallback`, or `fallback-after-gap` usage before the run starts.

## Safety and cost

- [ ] No secrets, client-confidential data, credentials, production data, or restricted customer data are in prompts or files.
- [ ] No station has permission to perform live production writes.
- [ ] Runtime selected: Claude Code auto-dispatch, Codex guided mode, Cursor guided/manual mode, or approved chat manual mode.
- [ ] Cost boundary selected: default or cheaper approved model, one pass per station, no parallel agents.
- [ ] Stop after 10 station calls or the first `hard-stop`.

## Result state

Pick the state you expect to prove:

- `complete-pass`: all 10 station outputs exist and evidence items 1-11 pass.
- `documented-stall-pass`: at least 6 station outputs exist, and the stop is documented as a
  hard stop or a station contract that looked valid before the run but proved too narrow to
  continue without fake context.
- `incomplete-fail`: fewer than 6 outputs, missing run record, or undocumented stop.

A raw shipped placeholder found during preflight is not a documented stall. Replace it with your
own spec, an `own+overlay` station, or the matching fallback before the first station call.
