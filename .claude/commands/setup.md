---
description: Wire the 10 station slots into runnable agents, then run preflight
---

You are setting up this hand-wired AI factory for a run. Do the steps below, change nothing else,
and finish with a checklist. **Do not run the feature — setup only. No secrets, no live writes.**

## 1. Wire the stations

For each of the ten station files in `station-slots/`:

- If it holds a real role spec (it does **not** start with `# INVALID PLACEHOLDER`), copy it to the
  matching `.claude/agents/<same-name>.md`, preserving the station-overlay block. The names map
  one-to-one: `100-consulting`, `200-product`, `300-design`, `400-architecture`, `500-engineering`,
  `700-data`, `800-infrastructure`, `900-security`, `600-qa`, `1000-delivery`.
- If it still starts with `# INVALID PLACEHOLDER`, copy the matching `fallback-specs/<same-name>.md`
  into **both** `station-slots/<same-name>.md` and `.claude/agents/<same-name>.md`.

Never delete a station. The required run needs all ten.

## 2. Run preflight

Check every item in `PREFLIGHT.md`. The load-bearing ones:

- all 10 `.claude/agents/*.md` exist and none starts with `# INVALID PLACEHOLDER`;
- each station names a role goal, exact `Reads`, exact `Writes`, its human gates, a done-when
  check, and its output path;
- `station-registry.yaml` and `handoff-map.yaml` order is `100,200,300,400,500,700,800,900,600,1000`;
- `handoff-map.yaml` names every upstream file required by stations 800, 900, 600, and 1000;
- no secrets, credentials, client-confidential, or production data appear in any file.

## 3. Report

Print one row per station, in run order:

`| Station | Source (own / own+overlay / fallback) | ✅ / ❌ + reason |`

Then print either:

- `READY — all ten stations valid, preflight clean. Run /run-factory.`  — only if every row is ✅; or
- a short numbered list of exactly what to fix, then `Re-run /setup after fixing.`

Do not start the run.
