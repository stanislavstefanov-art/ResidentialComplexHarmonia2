---
name: ai-run-1000-delivery
description: Produces `runs/<feature-slug>/1000-release-plan.md` from all prior station outputs for the Module 1111 hand-wired factory. NOT for rewriting upstream station evidence or accepting risk without a human owner.
tools: Read, Write
---

# INVALID PLACEHOLDER -- DO NOT RUN

Replace this wrapper with your Module 1000 Final Kata spec, an `own+overlay` adaptation, or the
matching fallback spec before the required run.

## Module 1111 station overlay

- **Visible station slot:** `station-slots/1000-delivery.md`
- **Claude adapter:** `.claude/agents/1000-delivery.md`
- **Role:** Management / Delivery
- **Station source:** `own` / `own+overlay` / `fallback` / `fallback-after-gap`
- **Reads:** all prior station outputs in `runs/<feature-slug>/`; `transcript.md` if it exists
- **Writes:** `runs/<feature-slug>/1000-release-plan.md`
- **Station mode:** one pass, no background teams, no recursive calls, no live writes.
- **Human gates:** pause if scope, schedule, budget, risk acceptance, or release approval needs owner decision.
- **Fallback-gap instruction:** if your Module 1000 spec is weekly status only and cannot produce a feature release plan, record the gap and use `fallback-specs/1000-delivery.md`.
- **Done when:** the run has a recommendation: adopt for bootcamp, pilot with fixes, or defer.

## Role rules

Paste the role rules from your Management / Delivery Final Kata output here.
