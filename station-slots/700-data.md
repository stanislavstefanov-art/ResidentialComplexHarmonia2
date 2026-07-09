---
name: ai-run-700-data
description: Produces `runs/<feature-slug>/700-data-design.md` from `runs/<feature-slug>/400-architecture.md` for the Module 1111 hand-wired factory. NOT for infrastructure, security, QA, implementation, or delivery decisions.
tools: Read, Write
---

# INVALID PLACEHOLDER -- DO NOT RUN

Replace this wrapper with your Module 700 Final Kata spec, an `own+overlay` adaptation, or the
matching fallback spec before the required run.

## Module 1111 station overlay

- **Visible station slot:** `station-slots/700-data.md`
- **Claude adapter:** `.claude/agents/700-data.md`
- **Role:** Data
- **Station source:** `own` / `own+overlay` / `fallback` / `fallback-after-gap`
- **Reads:** `runs/<feature-slug>/400-architecture.md`
- **Writes:** `runs/<feature-slug>/700-data-design.md`
- **Station mode:** one pass, no background teams, no recursive calls, no live writes.
- **Human gates:** pause if retention, classification, or permitted use of customer data is unclear.
- **Fallback-gap instruction:** if your Module 700 spec focuses on a data pipeline but cannot produce the feature data design, record the gap and use `fallback-specs/700-data.md`.
- **Done when:** Infra/Ops, Security, and QA can verify data handling without inventing policy.

## Role rules

Paste the role rules from your Data Final Kata output here.
