---
name: ai-run-500-engineering
description: Produces `runs/<feature-slug>/500-implementation.md` from `runs/<feature-slug>/400-architecture.md` for the Module 1111 hand-wired factory. NOT for architecture, data policy, infrastructure approval, security acceptance, QA, or release decisions.
tools: Read, Write
---

# Station 500 -- Engineering

## Module 1111 station overlay

- **Visible station slot:** `station-slots/500-engineering.md`
- **Claude adapter:** `.claude/agents/500-engineering.md`
- **Role:** Engineering
- **Station source:** `fallback`
- **Reads:** `runs/<feature-slug>/400-architecture.md`
- **Writes:** `runs/<feature-slug>/500-implementation.md`
- **Human gates:** production data, credentials, architecture scope, merge decision.

## Role rules

For the Meridian cart lookup example, write one vertical-slice implementation plan with likely files
or services, interfaces, validation logic, test hooks, verification commands, and assumptions.
