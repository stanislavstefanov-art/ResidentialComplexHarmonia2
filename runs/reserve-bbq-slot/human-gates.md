# Human Gates -- reserve-bbq-slot

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
| 1 | 200 → 300 spec approval | `paused-approved` (2026-07-10) | Product owner approves `200-spec.md` as the build basis. AC-1..AC-6 frozen; slot grid as `SlotGridConfig` (G1) and cancellation out of scope (G2) accepted. | Product owner |
| 2 | GATE-SEC-1 / G3-D1 — identity & session trust root (900; consumed by AC-6) | `paused-approved` (build) / `hard-stop` (prod: #4, #6) | **Closed for build by ADR-0001 (identity & session trust root):** invite-only, one account per household, opaque `household_ref`; identity delegated to an external IdP issuing a verifiable session; **R2 invariant** — API verifies the session server-side and derives `household_ref` from it, never from client input (AC-6); identity is personal data, minimised + kept out of logs. Concrete provider → Gate #6; subject-rights workflow → DPO/Gate #4. | Identity / Security owner (+ DPO for subject-rights) |
| 3 | GATE-ARCH-1 — concurrency mechanism (400 → 500) | `paused-approved` (2026-07-10) | Option A confirmed: store-level atomic conditional claim (ADR-001). Reserve = one atomic conditional write; refused writers do not mutate. AC-4 built and tested against this. | Architecture owner |
| 4 | GATE-DATA-1 — data classification, retention, EU residency, use limits | `training-open` (→ `hard-stop` for prod) | OPEN. Confirm classification of `household_ref`, retention (proposed 30d holds / 90d audit), EU residency, permitted use, erasure vs append-only audit (RR-4). | Data Protection Officer |
| 5 | GATE-BUDGET-1 — paid tier / real spend | `hard-stop` | OPEN. Approve any budget above free tier before real provisioning. | Association board / budget owner |
| 6 | G-INFRA-1 / G-INFRA-2 — store product, provider, region, env provisioning | `hard-stop` (for prod) | OPEN. Choose the concrete atomic-capable store + EU region and grant/provision environments. | Infra/Ops owner |
| 7 | GATE-REL-1 — production rollout & SLO acceptance | `hard-stop` | OPEN. The release commitment itself. Delivery recommends PILOT WITH FIXES. | Delivery owner |
| 8 | G1 — slot grid definition | `recorded-open` | Set slot duration / count per day / bookable window. Modelled as configurable `SlotGridConfig`; ACs hold for any grid — a deploy-time value, not build-blocking. | Product owner |
| 9 | G2 — cancellation scope | `paused-approved` (2026-07-10) | Confirmed **out of scope** for this slice; queued as a candidate next feature. | Product owner |

**Gate that matters most before pilot:** Gate #2 (identity/session trust root) is now **closed for build by ADR-0001** — so the remaining pre-pilot hard-stops are **Gate #4 (data classification / retention / EU residency / subject-rights — DPO)** and **Gate #6 (concrete atomic-capable store + provider + EU region)**, because both must close before any real `household_ref` is stored or real residents are onboarded. Gate #5 (budget) and Gate #7 (release commitment) remain the board/Delivery rollout gates. No `hard-stop` was tripped *during* the run; every `hard-stop` above is a production-rollout gate, not a run blocker — the run continued honestly on labelled assumptions and recorded each gate for human resolution.

## Gate #2 — identity/session trust-root resolution (record as an ADR)

Because `human-gates.md` is the *ledger*, not a Pipeline 2 bundle input, this decision is also
written as an ADR in the clean room (`docs/architecture/decisions/…-identity-trust-root.md`) so the
enriched code-review bundle (spec + security + ADRs) carries it into the build.

- **(a) Who is a resident:** invite-only; one account per household; a `household_ref` identifies the household.
- **(b) Identity source (class):** an external identity provider that issues a verifiable session token; concrete vendor deferred to the production provider gate (#6).
- **(c) R2 invariant (load-bearing):** the API verifies the session server-side and derives `household_ref` from the verified session — never from the client / request body. No valid session ⇒ cannot view or reserve (AC-6).
- **(d) Subject-rights:** `household_ref` is personal data; store the minimum, keep it out of logs; access/erasure posture deferred to the DPO (#4).
