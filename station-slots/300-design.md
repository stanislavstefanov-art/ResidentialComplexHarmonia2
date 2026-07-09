---
name: ai-run-300-design
description: Produces `runs/<feature-slug>/300-design.md` from `runs/<feature-slug>/200-spec.md` for the Module 1111 hand-wired factory. NOT for architecture, implementation, QA, security, data, or delivery decisions.
tools: Read, Write
---

# INVALID PLACEHOLDER -- DO NOT RUN

Replace this wrapper with your Module 300 Final Kata spec, an `own+overlay` adaptation, or the
matching fallback spec before the required run.

## Module 1111 station overlay

- **Visible station slot:** `station-slots/300-design.md`
- **Claude adapter:** `.claude/agents/300-design.md`
- **Role:** Design
- **Station source:** `own` / `own+overlay` / `fallback` / `fallback-after-gap`
- **Reads:** `runs/<feature-slug>/200-spec.md`
- **Writes:** `runs/<feature-slug>/300-design.md`
- **Station mode:** one pass, no background teams, no recursive calls, no live writes.
- **Human gates:** pause when visual policy, regulated copy, accessibility trade-offs, or user research interpretation need a human decision.
- **Fallback-gap instruction:** if your Module 300 spec cannot produce feature flow, screen states, and design questions, record the gap and use `fallback-specs/300-design.md`.
- **Done when:** Architecture can see the user-facing flow and Engineering can identify the UI/API behavior.

## Role rules

Paste the role rules from your Design Final Kata output here.
