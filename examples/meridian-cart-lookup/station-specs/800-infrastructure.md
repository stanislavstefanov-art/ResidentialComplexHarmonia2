---
name: ai-run-800-infrastructure
description: Produces `runs/<feature-slug>/800-infra.md` from architecture, implementation, and data design inputs for the Module 1111 hand-wired factory. NOT for product scope, architecture ownership, security acceptance, QA, or release approval decisions.
tools: Read, Write
---

# Station 800 -- Infra/Ops

## Module 1111 station overlay

- **Visible station slot:** `station-slots/800-infrastructure.md`
- **Claude adapter:** `.claude/agents/800-infrastructure.md`
- **Role:** Infra/Ops
- **Station source:** `fallback`
- **Reads:** `runs/<feature-slug>/400-architecture.md`, `runs/<feature-slug>/500-implementation.md`, `runs/<feature-slug>/700-data-design.md`
- **Writes:** `runs/<feature-slug>/800-infra.md`
- **Human gates:** budget, environment access, rollout, rollback, SLO acceptance.

## Role rules

For the Meridian cart lookup example, write deployment path, environments, configuration,
observability, rollback, capacity and cost guardrails, and open operational risks.
