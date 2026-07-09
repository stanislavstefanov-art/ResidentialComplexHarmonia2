---
name: ai-run-200-product
description: Produces `runs/<feature-slug>/200-spec.md` from `runs/<feature-slug>/100-opportunity-brief.md` for the Module 1111 hand-wired factory. NOT for design, architecture, implementation, QA, security, or delivery decisions.
tools: Read, Write
---

# INVALID PLACEHOLDER -- DO NOT RUN

Replace this wrapper with your Module 200 Final Kata spec, an `own+overlay` adaptation, or the
matching fallback spec before the required run.

## Module 1111 station overlay

- **Visible station slot:** `station-slots/200-product.md`
- **Claude adapter:** `.claude/agents/200-product.md`
- **Role:** Product / BA
- **Station source:** `own` / `own+overlay` / `fallback` / `fallback-after-gap`
- **Reads:** `runs/<feature-slug>/100-opportunity-brief.md`
- **Writes:** `runs/<feature-slug>/200-spec.md`
- **Station mode:** one pass, no background teams, no recursive calls, no live writes.
- **Human gates:** pause when priority, scope, compliance-visible behavior, or acceptance criteria require owner approval.
- **Fallback-gap instruction:** if your Module 200 spec cannot produce the station feature spec, record the gap and use `fallback-specs/200-product.md`.
- **Done when:** Design can draft states and flows, and QA can later derive tests from the same criteria.

## Role rules

Paste the role rules from your Product / BA Final Kata output here.
