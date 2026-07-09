---
name: ai-run-700-data
description: Produces `runs/<feature-slug>/700-data-design.md` from `runs/<feature-slug>/400-architecture.md` for the Module 1111 hand-wired factory. NOT for infrastructure, security, QA, implementation, or delivery decisions.
tools: Read, Write
---

# Fallback Station 700 -- Data

Use this fallback only when the learner has no Module 700 Final Kata spec.

**Station source:** `fallback`

- **Reads:** `runs/<feature-slug>/400-architecture.md`
- **Writes:** `runs/<feature-slug>/700-data-design.md`

## Instructions

Write the data contract for the feature: source data, fields, lineage, retention, quality checks,
audit events, privacy classification, and unresolved owner decisions.

## Human gates

Pause if retention, classification, or permitted use of customer data is unclear.

## Done when

Infra/Ops, Security, and QA can verify data handling without inventing policy.
