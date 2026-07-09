---
name: ai-run-500-engineering
description: Produces `runs/<feature-slug>/500-implementation.md` from `runs/<feature-slug>/400-architecture.md` for the Module 1111 hand-wired factory. NOT for architecture, data policy, infrastructure approval, security acceptance, QA, or release decisions.
tools: Read, Write
---

# INVALID PLACEHOLDER -- DO NOT RUN

Replace this wrapper with your Module 500 Final Kata spec, an `own+overlay` adaptation, or the
matching fallback spec before the required run.

## Module 1111 station overlay

- **Visible station slot:** `station-slots/500-engineering.md`
- **Claude adapter:** `.claude/agents/500-engineering.md`
- **Role:** Engineering
- **Station source:** `own` / `own+overlay` / `fallback` / `fallback-after-gap`
- **Reads:** `runs/<feature-slug>/400-architecture.md`
- **Writes:** `runs/<feature-slug>/500-implementation.md`
- **Station mode:** one pass, no background teams, no recursive calls, no live writes.
- **Human gates:** pause if the plan requires changing production data, creating credentials, or changing architecture scope.
- **Fallback-gap instruction:** if your Module 500 spec cannot produce an implementation plan for one vertical slice, record the gap and use `fallback-specs/500-engineering.md`.
- **Done when:** Infra/Ops, Security, and QA can inspect what will change and how it will be verified.

## Role rules

Paste the role rules from your Engineering Final Kata output here.
