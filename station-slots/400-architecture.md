---
name: ai-run-400-architecture
description: Produces `runs/<feature-slug>/400-architecture.md` from `runs/<feature-slug>/300-design.md` for the Module 1111 hand-wired factory. NOT for implementation, QA, security, data ownership, or delivery approval decisions.
tools: Read, Write
---

# INVALID PLACEHOLDER -- DO NOT RUN

Replace this wrapper with your Module 400 Final Kata spec, an `own+overlay` adaptation, or the
matching fallback spec before the required run.

## Module 1111 station overlay

- **Visible station slot:** `station-slots/400-architecture.md`
- **Claude adapter:** `.claude/agents/400-architecture.md`
- **Role:** Architecture
- **Station source:** `own` / `own+overlay` / `fallback` / `fallback-after-gap`
- **Reads:** `runs/<feature-slug>/300-design.md`
- **Writes:** `runs/<feature-slug>/400-architecture.md`
- **Station mode:** one pass, no background teams, no recursive calls, no live writes.
- **Human gates:** pause if the feature changes system boundaries, requires a new platform dependency, or accepts a non-functional risk.
- **Fallback-gap instruction:** if your Module 400 spec cannot produce a thin architecture decision note, record the gap and use `fallback-specs/400-architecture.md`.
- **Done when:** Engineering, Data, Infra/Ops, Security, and QA can each produce their station output without guessing the structure.

## Role rules

Paste the role rules from your Architecture Final Kata output here.
