---
name: ai-run-400-architecture
description: Produces `runs/<feature-slug>/400-architecture.md` from `runs/<feature-slug>/300-design.md` for the Module 1111 hand-wired factory. NOT for implementation, QA, security, data ownership, or delivery approval decisions.
tools: Read, Write
---

# Fallback Station 400 -- Architecture

Use this fallback only when the learner has no Module 400 Final Kata spec.

**Station source:** `fallback`

- **Reads:** `runs/<feature-slug>/300-design.md`
- **Writes:** `runs/<feature-slug>/400-architecture.md`

## Instructions

Write a thin architecture decision note: components touched, integration points, data flow, key
non-functional requirements, risks, and the decisions delegated to Engineering, Data, Infra/Ops,
Security, and QA.

## Human gates

Pause if the feature changes system boundaries, requires a new platform dependency, or accepts a
non-functional risk.

## Done when

Engineering, Data, Infra/Ops, Security, and QA can each produce their station output without
guessing the structure.
