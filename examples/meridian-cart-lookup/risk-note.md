# Risk Note — Meridian Cart Lookup

## Top risks

| # | Risk | Source station | Mitigation | Human owner |
|---|------|----------------|------------|-------------|
| 1 | Associate-facing reason code leaks sensitive detail | Security / QA | keep detailed reason in audit; approve visible message taxonomy | Product, Security, compliance |
| 2 | Identity verification method is assumed instead of approved | Product / Security | gate release until owner approves allowed verification method | Product owner, compliance |
| 3 | Cart lookup timeout creates confusing fallback behavior | Infra/Ops / QA | timeout test plus approved fallback copy | QA and Product |

## Residual risk

The run is suitable for bootcamp practice with synthetic data. A real repository needs identity,
reason-code, and retention decisions before implementation.
