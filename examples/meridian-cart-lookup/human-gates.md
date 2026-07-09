# Human Gates -- Meridian Cart Lookup

## Status taxonomy

| Status | Use when |
|--------|----------|
| `training-open` | The line records a missing human decision and continues with a safe labelled assumption; blocks production-like use. |
| `hard-stop` | Continuing would require unsafe data, secrets, live writes, regulated approval, budget approval, or release commitment. |
| `missed` | The line continued when it should have paused; record as a finding. |
| `paused-approved` | The line paused, a human owner approved the decision, and the run continued. |
| `paused-blocked` | The line paused and stayed blocked because no owner approved the decision. |
| `recorded-open` | The decision is known and recorded, but not needed to continue the training run. |
| `n/a` | No human gate applies at this station or handoff. |

## Gates

| # | Station or handoff | Gate status | Human decision | Owner |
|---|--------------------|-------------|----------------|-------|
| 1 | Product / BA -> Design | training-open | approve identity verification method before the endpoint can rely on it | Product owner and compliance owner |
| 2 | Security -> QA | training-open | approve which reason codes associates may see and which remain audit-only | Product, Security, compliance owner |

**Gate that matters most before pilot:** visible reason-code behavior, because it affects UX,
security, QA evidence, and release readiness.
