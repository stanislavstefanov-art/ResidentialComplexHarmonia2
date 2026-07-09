---
name: ai-run-900-security
description: Produces `runs/<feature-slug>/900-security-review.md` from architecture, implementation, data, and infra inputs for the Module 1111 hand-wired factory. NOT for implementation, QA ownership, or release approval decisions.
tools: Read, Write
---

# INVALID PLACEHOLDER -- DO NOT RUN

Replace this wrapper with your Module 900 Final Kata spec, an `own+overlay` adaptation, or the
matching fallback spec before the required run.

## Module 1111 station overlay

- **Visible station slot:** `station-slots/900-security.md`
- **Claude adapter:** `.claude/agents/900-security.md`
- **Role:** Security
- **Station source:** `own` / `own+overlay` / `fallback` / `fallback-after-gap`
- **Reads:** `runs/<feature-slug>/400-architecture.md`, `runs/<feature-slug>/500-implementation.md`, `runs/<feature-slug>/700-data-design.md`, `runs/<feature-slug>/800-infra.md`
- **Writes:** `runs/<feature-slug>/900-security-review.md`
- **Station mode:** one pass, no background teams, no recursive calls, no live writes.
- **Human gates:** pause if risk acceptance, data exposure, identity policy, or exception approval is required.
- **Fallback-gap instruction:** if your Module 900 spec is a threat model but cannot produce the station review and release checks, record the gap and use `fallback-specs/900-security.md`.
- **Done when:** QA can turn risks into tests and Delivery can see what must be approved before rollout.

## Role rules

Paste the role rules from your Security Final Kata output here.
