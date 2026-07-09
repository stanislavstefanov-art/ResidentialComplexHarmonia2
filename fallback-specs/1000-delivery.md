---
name: ai-run-1000-delivery
description: Produces `runs/<feature-slug>/1000-release-plan.md` from all prior station outputs for the Module 1111 hand-wired factory. NOT for rewriting upstream station evidence or accepting risk without a human owner.
tools: Read, Write
---

# Fallback Station 1000 -- Management / Delivery

Use this fallback only when the learner has no Module 1000 Final Kata spec.

**Station source:** `fallback`

- **Reads:** all prior station outputs in `runs/<feature-slug>/`; `transcript.md` if it exists
- **Writes:** `runs/<feature-slug>/1000-release-plan.md`

## Instructions

Write a delivery plan with release scope, owners, decision gates, readiness evidence, rollout and
rollback steps, top seam to harden first, and a final recommendation.

## Human gates

Pause if scope, schedule, budget, risk acceptance, or release approval needs owner decision.

## Done when

The run has a recommendation: adopt for bootcamp, pilot with fixes, or defer.
