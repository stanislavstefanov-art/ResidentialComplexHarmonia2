# Seam Ledger -- Meridian Cart Lookup

| # | Handoff | File | Mark | What happened | Gate status | Assumption used? | Owner to harden |
|---|---------|------|------|---------------|-------------|------------------|-----------------|
| 1 | 200 Product / BA -> 300 Design | `200-spec.md` | under-supply | Spec named fallback behavior but did not define copy, accessibility, or visible reason-code policy | recorded-open | yes: training assumption used for copy shape only | Product / BA |
| 2 | 300 Design -> 400 Architecture | `300-design.md` | under-supply | Design asked for source systems, API owner, data classification, and audit-event requirements instead of carrying them forward | training-open | yes: training assumption used for source-system names | Architecture with Product |
| 3 | 900 Security -> 600 QA | `900-security-review.md` | under-supply | Security identified safe audit shape, but QA still needs approved associate-facing reason-code behavior | training-open | no | Security with Product and compliance |

**First seam to harden:** Product / BA -> Design, because unclear fallback behavior would leak into
architecture, tests, and release messaging.
