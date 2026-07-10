---
name: ai-run-500-engineering
description: Produces `runs/<feature-slug>/500-implementation.md` from `runs/<feature-slug>/400-architecture.md` for the Module 1111 hand-wired factory. NOT for architecture, data policy, infrastructure approval, security acceptance, QA, or release decisions.
tools: Read, Write
---

# Fallback Station 500 -- Engineering

Use this fallback only when the learner has no Module 500 Final Kata spec.

**Station source:** `fallback`

- **Reads:** `runs/<feature-slug>/400-architecture.md`
- **Writes:** `runs/<feature-slug>/500-implementation.md`

## Instructions

Write an implementation plan for one vertical slice. Include files or services likely touched,
interfaces, validation logic, test hooks, local verification commands, and assumptions.

## Human gates

Pause if the plan requires changing production data, creating credentials, or changing architecture
scope.

## Done when

Infra/Ops, Security, and QA can inspect what will change and how it will be verified.
