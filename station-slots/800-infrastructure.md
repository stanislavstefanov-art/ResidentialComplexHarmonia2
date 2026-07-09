---
name: ai-run-800-infrastructure
description: Produces `runs/<feature-slug>/800-infra.md` from architecture, implementation, and data design inputs for the Module 1111 hand-wired factory. NOT for product scope, architecture ownership, security acceptance, QA, or release approval decisions.
tools: Read, Write
---

# INVALID PLACEHOLDER -- DO NOT RUN

Replace this wrapper with your Module 800 Final Kata spec, an `own+overlay` adaptation, or the
matching fallback spec before the required run.

## Module 1111 station overlay

- **Visible station slot:** `station-slots/800-infrastructure.md`
- **Claude adapter:** `.claude/agents/800-infrastructure.md`
- **Role:** Infra/Ops
- **Station source:** `own` / `own+overlay` / `fallback` / `fallback-after-gap`
- **Reads:** `runs/<feature-slug>/400-architecture.md`, `runs/<feature-slug>/500-implementation.md`, `runs/<feature-slug>/700-data-design.md`
- **Writes:** `runs/<feature-slug>/800-infra.md`
- **Station mode:** one pass, no background teams, no recursive calls, no live writes.
- **Human gates:** pause if budget, environment access, production rollout, or SLO acceptance needs owner approval.
- **Fallback-gap instruction:** if your Module 800 spec is incident, IaC, cost, or bounds scoped and cannot produce a feature infra/release-readiness plan, record the gap and use `fallback-specs/800-infrastructure.md`.
- **Done when:** Security and QA can verify the operating shape and Delivery can plan release readiness.

## Role rules

Paste the role rules from your Infra/Ops Final Kata output here.
