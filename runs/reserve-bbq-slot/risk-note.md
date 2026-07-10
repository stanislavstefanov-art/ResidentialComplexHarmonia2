# Risk Note -- reserve-bbq-slot

## Top risks

| # | Risk | Source station | Mitigation | Human owner |
|---|------|----------------|------------|-------------|
| 1 | **Residents-only boundary is unverified.** AC-6 rests entirely on an upstream session/identity assertion this slice consumes but never establishes or verifies — the one seam the server-authoritative design cannot self-protect. If the session can be forged/replayed, a non-resident can view/reserve. | 900 (F1/RR-1), carried from feature G3/D1 | Own the identity/session source; prove forge/replay resistance against the *real* verifier (TC-27/28, SEC-CHK-1/1b); close GATE-SEC-1. Blocks pilot. | Identity / Security owner |
| 2 | **No-double-booking depends on the store being genuinely atomic.** The invariant (AC-4) is correct-by-construction *only if* the chosen datastore truly enforces UC-1 (atomic "set holder iff unheld"). A store without native atomic conditionality silently breaks the guarantee. | 500 (F1-dep), 400 (R1), 700 (UC-1), 900 (F6/RR-2) | ADR-001 makes atomic-claim support a disqualifying store-selection criterion; prove it on the real in-EU store via TC-18 / DQ-1 / RC-1 (N-way burst → exactly one holder). Close GATE-ARCH-1 + G-INFRA-1. | Architecture + Data owner |
| 3 | **EU personal-data policy is unconfirmed.** `household_ref` is EU personal data (indirect + behavioural). Classification, retention, residency, permitted use, and subject-rights are proposals, not policy — and erasure conflicts with the append-only audit (E4). | 700 (GATE-DATA-1), 900 (RR-3/RR-4) | DPO confirms classification + retention (proposed 30d holds / 90d audit) + EU residency; resolve erasure vs append-only audit; residency self-check refuses non-EU boot (SEC-CHK-11). | Data Protection Officer |

## Residual risk

After the factory run the following remain unresolved and are carried to the human review:

- **No rate-limiting / acceptable-use control** (RR-5, TC-39/BLK-4): abusive rapid reservation or resource exhaustion is unmitigated; a strong recommendation but not a pilot blocker.
- **Deployment stack unchosen** (SEAM-800-1, G-INFRA-1/2): only a deployment *shape* is assumed; concrete store/provider/region and env provisioning are `hard-stop` for production.
- **Budget above free tier unapproved** (GATE-BUDGET-1): any real spend needs board approval under the near-zero-budget constraint.
- **Spec never human-approved** (200→300, `recorded-open`): downstream artefacts are provisional until the spec is signed.
- **All-`fallback` provenance** (RG-11): all 10 stations ran from generic fallback specs, not learner Final Kata specs. This lowers *process* confidence (specialist depth), not the internal consistency of the feature evidence — factored into the recommendation, not the feature RAG.
- **6 of 18 security checks are blocked-on-gate** (BLK-1..7): they cannot go green until the real store / real verifier / real EU region / policy decisions exist. Recorded honestly, not faked.

**Net:** zero Critical findings and no uncovered ACs, but the feature is **not production-ready** — its two load-bearing guarantees (residents-only, no-double-booking) and its personal-data handling all terminate in human-owned gates that this run correctly refused to self-close.
