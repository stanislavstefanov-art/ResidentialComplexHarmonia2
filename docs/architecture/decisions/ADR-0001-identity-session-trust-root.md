# ADR-0001 — Identity & session trust root

**Status:** Accepted (2026-07-10) — closes Gate #2 (identity trust root) for `reserve-bbq-slot`.
**Deciders:** Product owner (as board proxy).
**Supersedes / relates to:** none (first standing ADR). Relates to the run-local
architecture notes in `runs/reserve-bbq-slot/400-architecture.md` (atomic-claim, single-store)
and to the security review `900-security-review.md` (GATE-SEC-1).

## Context

`reserve-bbq-slot` lets a resident view availability and reserve the shared BBQ slot.
Two acceptance criteria rest on knowing *who is calling* and *which household they belong to*:

- **AC-6** — an unauthenticated caller can neither view nor reserve.
- The reservation is attributed to the caller's household, and a resident must not be
  able to act as another household.

The 900 security review raised **GATE-SEC-1**: the run has no standing decision on the
identity/session trust root, so the API's authorization has nothing authoritative to derive
identity from. This is a build-blocking gate — the write path cannot be implemented safely
until it is closed.

A gate closed only as a `paused-approved` status flip in `human-gates.md` does **not** reach
the build: `human-gates.md` is the gate ledger, not a Pipeline 2 input. The enriched code-review
bundle carries `200-spec.md` + `900-security-review.md` + the relevant ADRs from
`400-architecture.md`. Therefore this decision is recorded here, as an ADR, so it rides into
the build and the review.

## Decision

1. **Who is a resident.** Access is **invite-only** — there is no self-service sign-up.
   Each household has **one account**. A stable, opaque `household_ref` identifies the
   household and is the unit of authorization for reservations.

2. **Identity source (as a class, not a vendor).** Authentication is delegated to an
   **external identity provider** that issues a **verifiable session token** to the client.
   The concrete provider/vendor is **not** decided here — it is deferred to the
   production-provider gate (**#6**). The architecture depends only on the *class*
   ("an IdP that issues a verifiable session"), so the vendor choice is swappable.

3. **The load-bearing invariant (R2).** Authorization lives in the **server-side API**.
   The API **verifies the session on every request** and derives `household_ref`
   **from the verified session** — **never** from the request body, a query parameter,
   a header the client controls, or any other client-supplied value. With no valid
   session, the caller can neither view nor reserve (**AC-6**). The browser is outside the
   trust boundary and never carries authority.

4. **Subject rights & data minimisation.** `household_ref` (and any identity claim derived
   from the session) is **personal data**. Store the **minimum** needed to attribute a
   reservation; keep identity values **out of logs and telemetry** (log opaque surrogate
   ids and counts only). The concrete data-subject access/erasure workflow is **deferred to
   the DPO** (gate **#4**).

## Consequences

- **Enables the build.** GATE-SEC-1 is closed for design/build purposes; the reserve write
  path and the availability read can be implemented against a server-verified session that
  yields `household_ref`. AC-6 becomes a falsifiable server-side test
  (no session ⇒ 401; a body/param claiming another household is ignored).
- **Provider remains open (#6).** No vendor, tenant, or token format is committed here.
  First production rollout must close #6 before real residents are onboarded.
- **Subject-rights remain open (#4).** The DPO must define the access/erasure posture before
  real personal data is stored; this ADR fixes the minimisation + no-identity-in-logs posture
  in the meantime.
- **Testability.** The invariant in decision 3 is the single most important thing the
  Pipeline 2 review must confirm: identity is derived from the verified session, never from
  client input.
- **Belongs in the bundle.** This ADR must be included in the Pipeline 2 enriched code-review
  bundle (alongside `200-spec.md` and `900-security-review.md`) so the implementation honours
  the trust root.

## Still-open production hard-stops (not closed by this ADR)

- **#6 — concrete identity provider / region.** Vendor, tenant, token format, data region.
- **#4 — data-subject rights workflow.** DPO-owned access/erasure/retention posture for
  `household_ref` and derived identity data.
