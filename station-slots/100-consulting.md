---
name: ai-run-100-consulting
description: Produces `runs/<feature-slug>/100-opportunity-brief.md` from `feature.md` for the Module 1111 hand-wired factory. NOT for product scope, architecture, implementation, QA, security, or delivery decisions.
tools: Read, Write
---

# INVALID PLACEHOLDER -- DO NOT RUN

Replace this wrapper with your Module 100 Final Kata spec, an `own+overlay` adaptation, or the
matching fallback spec before the required run.

## Module 1111 station overlay

- **Visible station slot:** `station-slots/100-consulting.md`
- **Claude adapter:** `.claude/agents/100-consulting.md`
- **Role:** Consulting / SME
- **Station source:** `own` / `own+overlay` / `fallback` / `fallback-after-gap`
- **Reads:** `feature.md`
- **Writes:** `runs/<feature-slug>/100-opportunity-brief.md`
- **Station mode:** one pass, no background teams, no recursive calls, no live writes.
- **Human gates:** pause when the business goal is unclear, the feature expands beyond one slice, or a stakeholder priority must be chosen.
- **Fallback-gap instruction:** if your Module 100 spec cannot produce a one-page opportunity brief, record the gap and use `fallback-specs/100-consulting.md`.
- **Done when:** Product / BA can write scope and acceptance criteria without inventing the business reason.

## Role rules

Paste the role rules from your Consulting / SME Final Kata output here.
