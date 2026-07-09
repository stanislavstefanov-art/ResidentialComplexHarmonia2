---
name: ai-run-700-data
description: Produces `runs/<feature-slug>/700-data-design.md` from `runs/<feature-slug>/400-architecture.md` for the Module 1111 hand-wired factory. NOT for infrastructure, security, QA, implementation, or delivery decisions.
tools: Read, Write
---

# Station 700 -- Data

## Module 1111 station overlay

- **Visible station slot:** `station-slots/700-data.md`
- **Claude adapter:** `.claude/agents/700-data.md`
- **Role:** Data
- **Station source:** `fallback`
- **Reads:** `runs/<feature-slug>/400-architecture.md`
- **Writes:** `runs/<feature-slug>/700-data-design.md`
- **Human gates:** retention, classification, permitted customer-data use.

## Role rules

For the Meridian cart lookup example, write source data, fields, lineage, retention, quality checks,
audit events, privacy classification, and unresolved owner decisions.
