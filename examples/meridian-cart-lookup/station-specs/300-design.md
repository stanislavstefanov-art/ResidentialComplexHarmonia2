---
name: ai-run-300-design
description: Produces `runs/<feature-slug>/300-design.md` from `runs/<feature-slug>/200-spec.md` for the Module 1111 hand-wired factory. NOT for architecture, implementation, QA, security, data, or delivery decisions.
tools: Read, Write
---

# Station 300 -- Design

## Module 1111 station overlay

- **Visible station slot:** `station-slots/300-design.md`
- **Claude adapter:** `.claude/agents/300-design.md`
- **Role:** Design
- **Station source:** `fallback`
- **Reads:** `runs/<feature-slug>/200-spec.md`
- **Writes:** `runs/<feature-slug>/300-design.md`
- **Human gates:** regulated copy, accessibility trade-offs, reason-code UX.

## Role rules

For the Meridian cart lookup example, write the associate flow, screen states, empty/error states,
accessibility checks, and the design questions that block implementation.
