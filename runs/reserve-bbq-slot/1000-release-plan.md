# Release Plan — Reserve the shared BBQ zone

**Station:** 1000 Management / Delivery (source: `fallback`)
**Feature slug:** `reserve-bbq-slot`
**Reads:** all prior station outputs (`100`, `200`, `300`, `400`, `500`, `700`, `800`, `900`, `600`) + `transcript.md`
**Writes:** `runs/reserve-bbq-slot/1000-release-plan.md`

## Purpose and handoff discipline

This is the final station. It **consolidates** the evidence pack the ten stations produced into a
single decision surface and states a **recommendation** — it does **not** rewrite upstream evidence,
and it does **not** sign off release. Release commitment (GATE-REL-1) is human-owned: this plan
presents the recommendation, the readiness evidence, and the exact gates a human owner must close
before production, each with a named owner. No residual risk is accepted here; every residual-risk
owner already named upstream is carried forward unchanged.

**Run-provenance caveat (affects confidence, not feature-evidence RAG):** this run wired **all ten
stations from `fallback` specs** — there were **no learner Final Kata specs** (`transcript.md`,
`factory-passport.md`). The station outputs are internally consistent and traceable, but they are
the fallback baseline, not a learner-adapted line. This caps *delivery confidence in the process*,
and is recorded in Limitations below; it does **not** by itself downgrade the RAG of the feature
evidence the stations produced.

---

## 1. Overall RAG status

### **AMBER**

**One-line justification:** the design and evidence are strong and internally consistent (a clean
no-double-booking invariant chain, a coherent residents-only boundary, and a disciplined EU
personal-data posture), but **release is blocked by open human-owned gates and by three P1 assurances
that can only be proven against the real store / real identity verifier / real EU region** — none of
which exist in this run.

Why not Green: production-critical gates (GATE-ARCH-1, GATE-DATA-1, GATE-SEC-1, G-INFRA-1,
GATE-REL-1) are open, and three P1 security proofs (real-store atomicity, real-verifier identity,
real-region residency) are **blocked-on-gate**, not passed.

Why not Red: there are **0 Critical** security findings and **0 uncovered ACs**; the invariant is
designed correctly by construction (no app-layer read-then-write / TOCTOU window), QA has a full
42-case plan with every AC covered and every blocked item honestly labelled, and no station faked a
pass or self-accepted a risk. The path to Green is a known, finite checklist — not a redesign.

---

## 2. Release scope

**In scope (this thin slice):** a signed-in resident (a) views a day's BBQ slots as
free / taken-mine / taken-other, and (b) atomically claims one free slot, with an exactly-one-winner
guarantee under concurrency (Option A / ADR-001). Server owns the truth; the client never decides
success.

**Explicitly out of scope (carried, not reopened):** cancellation / release of a held slot (G2);
building the identity / sign-in mechanism (G3/D1, consumed); more than one BBQ zone (A1); rate
limiting, scheduling optimisation, pricing, penalties, waitlists, notifications, analytics.

---

## 3. Consolidated evidence chains (traced, not rewritten)

The three load-bearing properties trace cleanly end-to-end across stations. These are the spine of
the readiness case.

### 3.1 No-double-booking invariant — **AC-4 → Option A → UC-1 → RC-1/DQ-1 → TC-18**

| Stage | Station | Evidence |
|-------|---------|----------|
| Requirement | 200 | **AC-4** (+ NFR-1): concurrent claims on one free slot → exactly one winner, never two holders; hard invariant, not best-effort. |
| Mechanism | 400 | **Option A** (ADR-001, scored 72/75): store-level atomic conditional claim ("set holder iff unheld"); the store, not the app, decides the race. No app read-then-write ⇒ no TOCTOU window. |
| Implementation | 500 | Single indivisible conditional write; 4-way discriminated result; refusal path never mutates (AC-5). **F1 (High, dependency not defect):** correctness rests entirely on the store's real atomic write. |
| Data contract | 700 | **UC-1:** `PK(day_date, slot_key)` + `ON CONFLICT DO NOTHING` / `attribute_not_exists`. Non-atomic store is **disqualified**. **DQ-1:** no two records share a `slotId`. |
| Operating proof | 800 | **RC-1:** UC-1 conformance proven on the **real chosen store in the EU region**, not only a fake. A4/KS-1 runbook if DQ-1 ever finds a duplicate. |
| Test | 600 | **TC-14/16** (local, runnable now) + **TC-18** (real store) = one winner, one holder, DQ-1 empty, one `confirmed-yours` audit event. |

**Status:** designed correctly and locally provable now; **the real-store proof (TC-18 / RC-1 /
SEC-CHK-6) is BLOCKED-ON-GATE (BLK-1)** on G-INFRA-1 (store selection) + GATE-ARCH-1 (mechanism
confirmation). This is the residual-risk RR-2 below.

### 3.2 Residents-only boundary — **AC-6 → F1/RR-1 → identity gate G3/D1**

| Stage | Station | Evidence |
|-------|---------|----------|
| Requirement | 200 | **AC-6** (+ NFR-3): only a signed-in resident may view or reserve; non-resident refused, no record created. |
| Enforcement | 400/500 | ADR-005: residency re-checked server-side on **both** surfaces; `householdRef` derived server-side, never from client body (closes spoofing F3). |
| Threat | 900 | **F1 (High):** the boundary is only as strong as the upstream session assertion at TB-2, whose minting/validation is **unproven** in these inputs. **RR-1** raised, not self-accepted. |
| Root gate | 100→900 | **G3/D1:** the identity source is consumed, not built; **sharpened by Security to a `training-open` → hard-stop-for-prod** dependency, plus new **GATE-SEC-1**. |
| Test | 600 | Mocked-session negatives (TC-24/25/26) runnable now; **real-verifier forge/replay proof (TC-27/28 / SEC-CHK-1/1b) BLOCKED-ON-GATE (BLK-2)**. |

**Status:** mechanism present and correct against a mocked session; the **real identity root is
unproven** and is the top security dependency (RR-1). This is the single most important gate to close
first (see §9).

### 3.3 EU personal-data handling — **GATE-DATA-1, RR-3/RR-4**

| Stage | Station | Evidence |
|-------|---------|----------|
| Classification | 400/700 | `household_ref` is EU personal data (indirect identifier; behavioural when linked to day+slot). Data minimisation: only an opaque `household_ref` stored, never name/apartment/contact (LA-DATA-2). |
| Controls | 700/800/900 | Keep-out-of-logs (R4 / DQ-4); EU-region store + backups + startup residency self-check that refuses non-EU boot; append-only audit (E4). |
| Open policy | 700 | **GATE-DATA-1:** classification, retention (proposed 30d holds / 90d audit), residency, and permitted-use are **proposals, not policy** — DPO/owner sign-off required. |
| Residual risks | 900 | **RR-3** (classification/retention/permitted-use — DPO); **RR-4** (subject-rights access/erasure vs immutable audit — DPO). Neither self-accepted. |
| Test | 600 | Log-scan (TC-29) + residency self-check (TC-30 logic) runnable; **retention (TC-40 / BLK-5) and erasure (TC-41 / BLK-6) blocked** pending GATE-DATA-1. Real-region residency (BLK-3) blocked on G-INFRA-1. |

**Status:** posture is correct and minimised; **policy is unconfirmed** (RR-3) and **subject-rights /
erasure has no designed flow** (RR-4). Both are DPO-owned and block production-like use.

---

## 4. Readiness evidence (what is proven now vs. what is blocked)

**Provable in this run (green when executed):** 12 of 18 SEC-CHK checks; all `mapOutcome`/`deriveState`
unit branches; local concurrency proof (TC-14/16 + DQ-1); mocked-session access gate (TC-24/25/26);
PII-out-of-logs scan (TC-29); residency self-check logic (TC-30/31); refusal immutability
(TC-20/22/23); secrets scan (TC-38); audit append-only (TC-35). Of the six **P1** checks, three
(SEC-CHK-2, 5, 10) are runnable now.

**Blocked-on-gate (unproven, honestly recorded — NOT faked green):**

| Block | Test(s) | Root gate | Blocks what |
|-------|---------|-----------|-------------|
| BLK-1 | TC-18 (real-store UC-1) | GATE-ARCH-1 + G-INFRA-1 | Invariant proof on the real engine (RR-2) |
| BLK-2 | TC-27/28 (real-verifier) | G3/D1 + GATE-SEC-1 | AC-6 identity root (RR-1) |
| BLK-3 | TC-30 real-region half | G-INFRA-1 (region) | EU residency evidence |
| BLK-4 | TC-39 (rate limit) | RR-5 + GATE-BUDGET-1 | No rate-limit control exists to test |
| BLK-5 | TC-40 (retention) | GATE-DATA-1 | Retention/permitted-use policy unconfirmed |
| BLK-6 | TC-41 (erasure) | GATE-DATA-1 / GATE-SEC-1 | No subject-rights flow designed |
| BLK-7 | TC-42 (SCA scan) | G-INFRA-1 (stack) | No stack chosen to scan |

Three of the six **P1** checks (SEC-CHK-1/1b real verifier, SEC-CHK-6 real store, SEC-CHK-11
real-region half) sit in BLK-1/2/3 and **must be green or explicitly owner-accepted before any
production-like use.**

---

## 5. Risk register (consolidated — 11 items; owners carried from upstream, none newly accepted)

Consolidates the residual risks (RR-1..5, Security 900), the architecture/engineering dependency
risks (R1/F1, R2..R5), and the open gates. "Blocking for prod" = must be closed or explicitly
owner-accepted before GATE-REL-1.

| # | Risk | Source | Severity | Owner (role) | Blocking for prod? | Status |
|---|------|--------|:--------:|--------------|:------------------:|--------|
| RG-1 | **AC-6 rests on an unproven identity source** — residents-only is only as strong as the upstream session (TB-2); forge/replay unproven. | RR-1 / F1 / G3/D1 | High | Identity/Security owner | **Yes** | `training-open` → hard-stop for prod |
| RG-2 | **Invariant integrity depends on the store being genuinely atomic** — a non-atomic store (G-INFRA-1) reopens double-booking silently. | RR-2 / F6 / R1 / F1(500) | High | Data/Architecture owner + G-INFRA-1 owner | **Yes** | `training-open` |
| RG-3 | **EU personal-data classification, retention & permitted-use unconfirmed** — 30d/90d + PII classification are proposals. | RR-3 / F12 / GATE-DATA-1 | High (data) | DPO / Data-Protection owner | **Yes** | `training-open` |
| RG-4 | **Subject-rights (access/erasure) vs append-only audit** — no designed flow; lawful basis unresolved. | RR-4 / F13 / F9 | Medium | DPO / Data-Protection owner | **Yes** | `recorded-open` |
| RG-5 | **PII leak into logs/traces/metrics** — `household_ref` exposure, possibly non-EU sink. | F10 | High | Ops + Data-Protection owner | **Yes** (control) — testable now (TC-29) | mitigated in design; prove in run |
| RG-6 | **PII resides/exports outside EU** — residency breach. | F11 | High | Ops + Data-Protection owner | **Yes** — real-region proof blocked (BLK-3) | `training-open` on real region |
| RG-7 | **No rate-limiting / acceptable-use control** — grief-booking + free-tier cost exhaustion. | RR-5 / F14 | Medium | Product owner + Ops (+ GATE-BUDGET-1) | No (pilot) / recommended for prod | `recorded-open` |
| RG-8 | **Slot-grid granularity (G1) undefined** — UC-1 could guard the wrong unit (overlapping "distinct" slots). | R5 / G1 | Medium | Product owner (G1) | **Yes** (RC-10) | `recorded-open` |
| RG-9 | **No deployment stack/artefact** — 500 was framework-neutral; Ops has shape only (LA-800-1). | SEAM-800-1 / G-INFRA-1 | Medium | Infra owner (G-INFRA-1) | **Yes** (blocks BLK-7 SCA + real deploy) | open |
| RG-10 | **Environment access / provisioning & budget** — cloud account, deploy rights, spend cap. | G-INFRA-2 / GATE-BUDGET-1 | Medium | Infra/Budget owner | **Yes** (hard-stop for real spend) | `hard-stop` for prod |
| RG-11 | **Run wired entirely from fallback specs** — no learner Final Kata specs; process confidence capped. | run provenance | Low (process) | Delivery owner | No (advisory) | recorded |

**Count: 11 risk-register items. Blocking for production: 9** (RG-1..RG-6, RG-8, RG-9, RG-10).
RG-7 is a strong recommendation (not a pilot blocker); RG-11 is an advisory limitation on process
confidence. **No item on this list is accepted by this station** — each carries the named upstream
owner and stays open pending sign-off.

---

## 6. Decision gates a human must close before production (with owners)

| Gate | Decision | Owner (role) | Status |
|------|----------|--------------|--------|
| **GATE-SEC-1 / G3-D1** | Prove the identity/session root (forge/replay) + lawful basis/erasure | Identity/Security owner + DPO | `training-open` → **hard-stop for prod** |
| **GATE-ARCH-1** | Confirm Option A as the durable concurrency mechanism | Architecture owner | `training-open` |
| **G-INFRA-1** | Select store product + provider + EU region (must pass RC-1 + SEC-CHK-11) | Infra owner | `training-open` |
| **GATE-DATA-1** | Confirm PII classification, retention (30d/90d), residency, permitted-use | DPO / Data-Protection owner | `training-open` |
| **G1** | Fix the concrete slot grid (sets `slot_key` granularity, RC-10) | Product owner | `recorded-open` |
| **GATE-BUDGET-1** | Spend cap / any paid tier | Budget owner | `hard-stop` for real spend |
| **G-INFRA-2** | Cloud account holder + deploy access (least-privilege) | Infra owner | `hard-stop` |
| **GATE-REL-1** | Production rollout + accept latency/availability budgets | Delivery owner | `hard-stop` — **this plan RECOMMENDS, does not sign** |
| **Spec-approval (200→300)** | Post-run human review of scope/ACs | Product owner | `recorded-open` |
| **G-DESIGN-1** | Approve final refusal/access copy | Product owner | `recorded-open` |
| **G2** | Whether cancellation enters scope (expands invariant + authz + audit) | Product owner | `recorded-open` |

---

## 7. Rollout steps (proposed — execution gated on GATE-REL-1)

1. **Close the blocking gates** in §6 (owners sign off; do not proceed on labelled assumptions for prod).
2. **Select the stack + store + EU region** (G-INFRA-1) and provision staging + prod as **separate**
   stores (no shared store across envs; 800).
3. **Run the real-store / real-verifier / real-region proofs** in staging: TC-18 (BLK-1), TC-27/28
   (BLK-2), TC-30 real-region (BLK-3) — all P1 must be green.
4. **Confirm the release checklist RC-1..RC-10 green** (800), including PII-out-of-logs (TC-29),
   secrets scan (TC-38), kill switches KS-1..KS-4 exercised with named owners, rollback rehearsed.
5. **Fix the slot grid** (G1) before go-live so UC-1 guards the right unit (RC-10).
6. **Rehearse rollback + kill switches** in staging before cutover.
7. **Rollout** (GATE-REL-1 signed): single-region, business-hours best-effort, scale-to-zero app.
   Watch `couldnt_confirm_rate`, `residency_check_failed_total` (must stay 0), and DQ-1 (must stay empty).

## 8. Rollback steps (from 800, consolidated)

- **App:** stateless ⇒ redeploy previous version / shift traffic; in-flight requests degrade to
  `couldn't-confirm` (client re-reads). Safe and fast.
- **Store:** **do not** blind-restore a backup (resurrects stale holds); prefer **forward-fix +
  reconcile from E4 audit** (`claimed_at` earliest wins, human-adjudicated) for integrity incidents.
- **Config:** revert `STORE_REGION`/endpoint to last EU-correct value; startup residency self-check
  blocks a bad region from booting.
- **Kill switches:** KS-1 reserve-disable (invariant break, A4), KS-2 residency-stop (auto on non-EU
  boot, Data-Protection owner), KS-3 read-only (maintenance), KS-4 full-disable (last resort).
- **Recovery principle:** honest `couldn't-confirm` is always preferred over a fake success or a
  risked double-book.

---

## 9. Top seam to harden first

**The identity / session trust root (TB-2 → RG-1 / RR-1 / F1 / GATE-SEC-1 / G3-D1).**

Everything else has a mechanism present that "only" needs proving on the real target (store, region,
retention). The residents-only boundary, by contrast, rests **entirely on an upstream session
assertion this slice consumes but never verifies** — if that assertion can be forged, replayed, or
expired-but-accepted, AC-6 collapses and one household can act as another, regardless of how perfect
the invariant is. It is the one seam where the design cannot self-protect. Harden it first: prove
SEC-CHK-1/1b against the **real** verifier (close BLK-2) and get GATE-SEC-1 owner-confirmed before any
production-like use.

Second seam: RG-2 / BLK-1 (prove UC-1 atomicity on the real chosen store) — the invariant's integrity
depends on a store the run has not selected.

---

## 10. Stakeholder notes

- **Product owner:** three scope decisions await you (G1 slot grid — **prod-blocking**; G2
  cancellation; spec-approval + G-DESIGN-1 copy). G1 must be fixed before go-live. Rate-limiting
  (RG-7) is recommended for prod but not a pilot blocker.
- **DPO / Data-Protection owner:** you own GATE-DATA-1 (RG-3) and the subject-rights/erasure-vs-audit
  question (RG-4). Posture is minimised and EU-pinned by design; **policy confirmation is what's
  missing**, and it blocks production-like use.
- **Identity/Security owner:** you own the top seam (RG-1 / GATE-SEC-1). The real forge/replay proof
  (TC-27/28) cannot run until the real verifier exists — this is the first thing to close.
- **Infra owner:** G-INFRA-1 (store + EU region, must pass RC-1 + SEC-CHK-11), G-INFRA-2 (access),
  and the SEAM-800-1 stack gap (RG-9). No secrets/credentials were requested or stored in this run.
- **Budget owner:** GATE-BUDGET-1 — shape targets a near-zero free/serverless tier; a real spend cap
  is a `hard-stop` you must approve.
- **Delivery owner (release):** GATE-REL-1 is yours. **This plan recommends; it does not sign
  release.** The path to Green is the finite checklist in §7, not a redesign.

---

## 11. Limitations (confidence caveats)

- **All ten stations ran from `fallback` specs — no learner Final Kata specs.** The line is the
  fallback baseline; outputs are consistent and traceable but not learner-adapted. This caps
  *confidence in the process*, not the RAG of the feature evidence (RG-11).
- **All station outputs are plans/designs, not running code.** Engineering (500) is an implementation
  *plan*; no stack, no deployable artefact (SEAM-800-1 / RG-9). Green requires real-target execution.
- **Three P1 assurances are unproven** because their real targets (store, verifier, region) do not
  exist in this run — recorded as BLK-1/2/3, not faked.
- **No secrets, credentials, production data, or live writes** were used at any station (run-bounds
  respected).

---

## 12. Recommendation

### **PILOT WITH FIXES** (constrained pilot — not production; not defer)

The slice is a sound, well-evidenced design: **0 Critical** findings, **0 uncovered ACs**, a
correct-by-construction no-double-booking invariant, a coherent residents-only boundary, and a
disciplined, minimised EU personal-data posture. The gaps are **not** design defects — they are
**open human-owned gates** and **three P1 proofs that require real targets** (store, identity
verifier, EU region) that this run could not stand up. That is precisely a *pilot-with-fixes*
profile, not a defer.

**Adopt for a constrained pilot only when ALL of the following hold:**
1. The in-run P1 checks (SEC-CHK-2, 5, 10) are executed **green** with stored artefacts.
2. The three blocked P1 proofs (RR-1 real verifier / BLK-2, RR-2 real store / BLK-1, RR-6 real region
   / BLK-3) are either **closed** or **explicitly risk-accepted by their named human owners** for the
   limited pilot population.
3. The **top seam (RG-1 / GATE-SEC-1)** is owner-confirmed — no pilot on an unproven identity root.
4. G1 slot grid is fixed (RG-8 / RC-10).

**Do NOT proceed to production** until the nine prod-blocking risk items (§5) are closed and
GATE-REL-1 is signed by the Delivery owner. **This station recommends; it does not authorise
release.**

## Done-when check

The run has a clear recommendation — **pilot with fixes** — with an overall RAG (Amber), an 11-item
risk register (9 prod-blocking, each with a named owner, none self-accepted), a consolidated evidence
chain for all three load-bearing properties, decision gates with owners, rollout/rollback steps, the
single top seam to harden first (the identity/session trust root), and the fallback-provenance caveat
recorded as a confidence limitation rather than a feature-evidence downgrade.
