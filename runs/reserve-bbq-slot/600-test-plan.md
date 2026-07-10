# Test Plan — Reserve the shared BBQ zone

**Station:** 600 QA (source: `fallback`)
**Feature slug:** `reserve-bbq-slot`
**Reads:** `runs/reserve-bbq-slot/200-spec.md`, `runs/reserve-bbq-slot/500-implementation.md`,
`runs/reserve-bbq-slot/700-data-design.md`, `runs/reserve-bbq-slot/800-infra.md`,
`runs/reserve-bbq-slot/900-security-review.md`
**Writes:** `runs/reserve-bbq-slot/600-test-plan.md`

## Purpose

Give Delivery (1000) a single verifiable decision surface: whether this slice is **ready for a
pilot, blocked, or deferred**. This plan turns every acceptance criterion (AC-1..AC-6), the
engineering test-approach table (T1..T19), the security checks (SEC-CHK-1..18, six P1), and the
data-quality checks (DQ-1..DQ-6) into named, traceable test cases with pass gates and evidence
requirements.

QA does **not** accept security risk, decide product scope, or approve release. Where a test cannot
be run without a human-owned decision or an unproven upstream dependency, it is recorded as
**blocked-on-gate** (BLK-*), not faked green. Every AC has at least one test case; coverage gaps are
marked explicitly.

## What QA does NOT do here (handoff discipline)

- Does **not** accept RR-1..RR-5 (Security 900 §5) — those need named human owners.
- Does **not** decide the slot grid (G1), cancellation scope (G2), the identity source (G3/D1), the
  store product (G-INFRA-1), retention/classification (GATE-DATA-1), or release (GATE-REL-1).
- Does **not** mark a test "passed" when its precondition is an open gate — it marks it
  **blocked-on-gate** and states what must close first.

---

## Test tiers

| Tier | Meaning | Infra needed |
|------|---------|--------------|
| **U** | Unit — pure/mocked, no I/O (`deriveState`, `mapOutcome`, gate, validation) | none |
| **I** | Integration — real local/ephemeral store, real conditional write | local store (no PII) |
| **C** | Concurrency — simultaneous claims via the 500 barrier hook | store with atomic conditional write |
| **Sec** | Security-lens — adversarial / negative | as per case |
| **Data** | Data-quality assertion (DQ-*) against store contents | store |
| **M** | Manual / exploratory | device |
| **Ops** | Observability / config / boot-safety check | staging shape |

**Data method for AC-4 (the load-bearing concurrency proof):** use the 500 **deterministic
concurrency barrier hook** ("the fake/integration store exposes a barrier so two claims can be
released simultaneously against a real conditional-write") to fire N claimants that all block on the
barrier, then release together, all targeting the **same free `slotId`**. After release, assert
against the store directly (not the API response alone): `DQ-1` — `count(slotId) grouped having > 1`
returns empty (exactly one holder row/item); the `household_ref` on that row equals exactly one
claimant; exactly one caller received `confirmed-yours` (200) and the rest `refused-already-taken`
(409). This is run first at tier **C** against a local store (fast, repeatable), and **must be
repeated at tier C against the real chosen store in the EU region** (SEC-CHK-6 / RC-1) before any
production-like use — that real-store run is **blocked-on-gate** until G-INFRA-1 selects the store.

---

## Test cases

Case IDs: `TC-*` (QA plan). The `Source` column carries forward the engineering T-numbers, the
security SEC-CHK numbers, and the data DQ numbers so nothing is silently dropped. `Neg` marks a
negative/failure-state case.

### A. Availability read (AC-1)

| TC | Case | Tier | Neg | Source | Pass gate |
|----|------|:----:|:---:|--------|-----------|
| TC-01 | `deriveState`: absent holder → `free` | U | | T1 | returns `free` |
| TC-02 | `deriveState`: holder == me → `taken-mine` | U | | T2 | returns `taken-mine` |
| TC-03 | `deriveState`: holder == other → `taken-other` | U | | T3 | returns `taken-other` |
| TC-04 | Read a day: mix of free/taken renders every configured grid slot with correct state | I | | T1-T3, ADR-004 | each `slotKey` in the grid appears once with the right state |
| TC-05 | Read reflects a just-committed claim (no authoritative cache / no stale `free`) | I | | T17 (R3/NFR-2) | slot claimed at t0 shows `taken-*` on read at t0+ |
| TC-06 | Read a slot held by another household returns `taken-other` only — no holder identity leaked | Sec | Neg | **SEC-CHK-4** (F4) | payload contains no `household_ref`/name/apartment |

### B. Reserve a free slot (AC-2)

| TC | Case | Tier | Neg | Source | Pass gate |
|----|------|:----:|:---:|--------|-----------|
| TC-07 | `mapOutcome`: `Claimed` → `confirmed-yours` (200) | U | | T4 | 200 + `confirmed-yours` |
| TC-08 | Single claim on a free slot commits the holder in the store | I | | T11 | one holder row with caller's `household_ref` |
| TC-09 | After a successful claim the slot becomes `taken` for all other residents | I | | AC-2, T17 | second resident's read shows `taken-other` |

### C. Cannot reserve a taken slot — refusal path (AC-3)

| TC | Case | Tier | Neg | Source | Pass gate |
|----|------|:----:|:---:|--------|-----------|
| TC-10 | `mapOutcome`: `AlreadyHeldByOther` → `refused-already-taken` (409) | U | Neg | T5 | 409 + `refused-already-taken` |
| TC-11 | Second sequential claim on a held slot is refused; caller sees a clear "already taken" message | I | Neg | T12, AC-3 | 409 + clear message; no new holder |
| TC-12 | Unknown `slotKey` not in grid → 404, no claim attempted (not treated as a refusal) | U | Neg | T10 (validation) | 404; no store write; no audit `confirmed` |
| TC-13 | Malformed `day` → 400 (validation, not a claim) | U | Neg | 500 validation table | 400; no store write |

### D. Concurrency — exactly one winner (AC-4 / NFR-1) — LOAD-BEARING

| TC | Case | Tier | Neg | Source | Pass gate |
|----|------|:----:|:---:|--------|-----------|
| TC-14 | **Two simultaneous claims on one free slot → exactly one `confirmed-yours`, one `refused-already-taken`, exactly one holder** | C | | **T13**, AC-4/NFR-1 | 1×200, 1×409; DQ-1 empty; one holder row |
| TC-15 | Concurrent claims never leave a slot with two holders **or** with no holder | C | | T14, AC-4/NFR-1 | store has exactly one holder for the contended slot |
| TC-16 | **Adversarial N-way burst (N≫2, e.g. 20 simultaneous)** on one free slot → still exactly one winner | C, Sec | | **SEC-CHK-5** (F5) | exactly 1×`confirmed-yours`; N-1 refused; DQ-1 empty |
| TC-17 | DQ-1 invariant scan: no two records share a `slotId` after any concurrency test | Data | | **DQ-1**, DQ-6 | `count(slotId) having > 1` returns empty |
| **TC-18** | **Repeat TC-14/TC-16 against the REAL chosen store in the EU region (UC-1 conformance)** | C, Sec | | **SEC-CHK-6** (F6), RC-1/RC-2 | same one-winner result on the real engine — **BLOCKED-ON-GATE (BLK-1)** |

**Data method note (TC-14..TC-18):** all use the 500 barrier hook to force true simultaneity, then
assert on **store contents** (DQ-1/DQ-6) plus the API outcomes plus the E4 audit (exactly one
`confirmed-yours` event for the contended slot). TC-14..TC-17 run at tier C against a local store and
can pass in this run. **TC-18 is the same proof against the real store and is blocked on G-INFRA-1 /
GATE-ARCH-1** (see BLK-1) — QA does not assume the store is atomic (Security F6 / engineering F1).

### E. Confirmed reservation immutable to refused attempts (AC-5 / NFR-4)

| TC | Case | Tier | Neg | Source | Pass gate |
|----|------|:----:|:---:|--------|-----------|
| TC-19 | `mapOutcome`: `AlreadyHeldByOther` maps to refusal, existing hold untouched (unit) | U | Neg | T5 | refusal returned; no mutation call issued |
| TC-20 | A losing/second claim leaves original `household_ref` + `claimed_at` **byte-for-byte unchanged**; audit shows `refused-already-taken` (not a mutation) | I, Sec | Neg | **SEC-CHK-7** (F7), T12 | holder + timestamp identical before/after; one refusal audit event |
| TC-21 | Idempotent self-retry: `AlreadyHeldByMe` → `confirmed-yours` (never a false refusal) | U | | T6 | 200 + `confirmed-yours` |
| TC-22 | Retry of own confirmed claim after a simulated `couldn't-confirm` → `confirmed-yours` | I | | T15 (R2/IC-1) | 200; still exactly one holder (no second write) |
| TC-23 | Idempotency abuse: a retry where the current holder is a **different** household → `refused-already-taken`, no write | I, Sec | Neg | **SEC-CHK-8** (F8) | 409; holder unchanged; no write on the idempotent path |

### F. Residents-only access (AC-6 / NFR-3) — the AC-6 root of trust

| TC | Case | Tier | Neg | Source | Pass gate |
|----|------|:----:|:---:|--------|-----------|
| TC-24 | Residency gate refuses a non-resident on **both** read and reserve (unit, mocked session) | U | Neg | T8 | 401/403 both surfaces; no data; no record |
| TC-25 | Non-resident **and** unauthenticated callers refused on both surfaces; assert no `household_ref` written, no audit `confirmed` | I, Sec | Neg | **SEC-CHK-2** (F2), T8 | refused; no E1 write; no `confirmed` audit |
| TC-26 | Reserve ignores a client-supplied household field in the body; hold attributed to the session household only | U, Sec | Neg | **SEC-CHK-3** (F3), T9 | body holder ignored; holder = session ref |
| **TC-27** | Absent/invalid/expired/tampered session token → both `GET` and `POST` refused; no slot data; no record; no audit `confirmed` | Sec | Neg | **SEC-CHK-1** (F1) | refused (401/403) on all four token states — **BLOCKED-ON-GATE (BLK-2)** for the *real verifier* variant |
| **TC-28** | Token-substitution / replay: a session for household A cannot produce a hold attributed to household B (run against the **real** verifier) | Sec | Neg | **SEC-CHK-1b** (F1) | A's token never yields a B-attributed hold — **BLOCKED-ON-GATE (BLK-2)** |

### G. PII / observability / residency (Security P1 + NFRs)

| TC | Case | Tier | Neg | Source | Pass gate |
|----|------|:----:|:---:|--------|-----------|
| TC-29 | `household_ref` appears in **no** log line, trace, error, or metric label across claim, refusal, idempotent retry, error, and timeout paths; log-sink scan for holder-shaped values | Sec, Data | Neg | **SEC-CHK-10** (F10), T16, DQ-4 | zero holder-shaped tokens in any sink |
| TC-30 | Startup with a non-EU `STORE_REGION` **fails to boot** (residency self-check); `residency_check_failed_total == 0`; no cross-region export/backup path for E1/E4 | Ops, Sec | Neg | **SEC-CHK-11** (F11), RC-3 | boot refused on non-EU; counter 0; backups enumerated in-EU — **partially BLOCKED-ON-GATE (BLK-3)** for the real region |
| TC-31 | Boot-time fail-safe assertions (residency self-check, TLS enforced, `SESSION_VERIFIER` set): a misconfigured region or missing verifier fails safe (refuse/boot-fail), never fails open | Ops, Sec | Neg | **SEC-CHK-17** (F17) | misconfig → boot-fail/refuse, never open |

### H. Reliability / failure states

| TC | Case | Tier | Neg | Source | Pass gate |
|----|------|:----:|:---:|--------|-----------|
| TC-32 | `mapOutcome`: `Unavailable` → `couldn't-confirm` (503) | U | Neg | T7 | 503 + `couldn't-confirm` |
| TC-33 | Injected store timeout → `couldn't-confirm` with **no** partial holder written; audit records `couldn't-confirm` | I, Sec | Neg | **SEC-CHK-15** (F15), T18 | no partial write; one `couldn't-confirm` audit event |
| TC-34 | Exploratory: flaky-signal double-tap on a phone renders exactly one honest outcome (never a fabricated success) | M | | T19 (DA3) | one honest rendered outcome |

### I. Audit integrity / tamper-evidence

| TC | Case | Tier | Neg | Source | Pass gate |
|----|------|:----:|:---:|--------|-----------|
| TC-35 | Every claim attempt produces exactly one immutable E4 audit event; attempt to update/delete an E4 record before retention expiry is rejected | Data, Sec | Neg | **SEC-CHK-9** (F9), DQ-5 | append-only enforced; one event per attempt |
| TC-36 | DQ-2: every held Slot has a non-null `household_ref` (no anonymous/orphan holds) | Data | | DQ-2 | no held row with null holder |
| TC-37 | DQ-3: every `slot_key` used in E1/E4 exists in E2 SlotGridConfig (grid integrity / R5) | Data | | DQ-3 | no orphan `slot_key` |

### J. Secrets / config / supply-chain

| TC | Case | Tier | Neg | Source | Pass gate |
|----|------|:----:|:---:|--------|-----------|
| TC-38 | No secrets in image/repo/config/logs; store + session credentials resolved only from the secret manager at runtime | Sec, Ops | Neg | **SEC-CHK-16** (F16), RC-9 | scan finds no secret material |

### K. Blocked-on-gate cases (recorded, NOT run green in this run)

| TC | Case | Tier | Source | Blocked on |
|----|------|:----:|--------|-----------|
| TC-39 | Rate limit throttles an abusive burst on both surfaces **without** defeating a legitimate simultaneous claim (must not break TC-14/TC-16) | Sec | **SEC-CHK-14** (F14) | **BLK-4** — no rate-limit control specified in any input (Security F14 / RR-5); acceptable-use + cost cap owner-owned (GATE-BUDGET-1). Cannot test a control that does not exist. |
| TC-40 | Retention purge: holds past `day_date + RETENTION_HOLDS_DAYS` and audit past `RETENTION_AUDIT_DAYS` are purged; `household_ref` used only for the 3 permitted uses | Data, Sec | **SEC-CHK-12** (F12) | **BLK-5** — retention windows/permitted-use are **proposals**, not policy, until **GATE-DATA-1**. Testing them now would rubber-stamp unconfirmed policy. |
| TC-41 | Erasure request removes/pseudonymises `household_ref` in E1 while preserving the tamper-evident audit per the agreed rule | Sec | **SEC-CHK-13** (F13) | **BLK-6** — no subject-rights/erasure flow designed; lawful-basis + erasure-vs-audit reconciliation is DPO-owned (GATE-DATA-1 / GATE-SEC-1 / RR-4). Nothing to test yet. |
| TC-42 | SCA / dependency vulnerability scan; versions pinned before release | Sec | **SEC-CHK-18** (F18) | **BLK-7** — no stack chosen (SEAM-800-1 / G-INFRA-1). Cannot scan what is not chosen. |
| TC-18 | (listed in section D) Real-store UC-1 conformance | C, Sec | SEC-CHK-6 (F6) | **BLK-1** — real store not selected (G-INFRA-1) / mechanism not confirmed (GATE-ARCH-1). |
| TC-27/TC-28 | (listed in section F) Real-verifier session/replay tests | Sec | SEC-CHK-1/1b (F1) | **BLK-2** — identity source unproven (G3/D1 / GATE-SEC-1). Mocked-session variant runs now; real-verifier variant blocked. |
| TC-30 | (listed in section G) Real-region residency proof | Ops, Sec | SEC-CHK-11 (F11) | **BLK-3** — real EU region not provisioned (G-INFRA-1). Self-check logic testable now; real-region evidence blocked. |

**Total test cases: 42** (TC-01..TC-42).

---

## Traceability matrix — AC → test case(s)

| AC | Requirement | Test cases | Coverage |
|----|-------------|------------|:--------:|
| **AC-1** | View availability (free/taken) for a day | TC-01, TC-02, TC-03, TC-04, TC-05, TC-06 | **Covered (6)** |
| **AC-2** | Reserve a free slot; becomes taken for all; household recorded | TC-07, TC-08, TC-09 | **Covered (3)** |
| **AC-3** | Cannot reserve a taken slot; clear refusal; existing unchanged | TC-10, TC-11, TC-12, TC-13, TC-20 | **Covered (5)** |
| **AC-4** | Concurrent attempts → exactly one winner; never two holders | TC-14, TC-15, TC-16, TC-17, TC-18* | **Covered (5)** — real-store proof (TC-18) blocked (BLK-1) |
| **AC-5** | Confirmed reservation immutable to refused attempts | TC-19, TC-20, TC-21, TC-22, TC-23 | **Covered (5)** |
| **AC-6** | Only signed-in residents may view/reserve | TC-24, TC-25, TC-26, TC-27*, TC-28* | **Covered (5)** — real-verifier proof (TC-27/28) blocked (BLK-2) |

**No AC has zero tests.** Every AC-1..AC-6 has at least three test cases; each has at least one case
runnable in this run without an open gate. The two ACs whose *full* assurance depends on an unproven
upstream (AC-4 real store, AC-6 real identity) have their gate-dependent proof recorded as
blocked-on-gate rather than faked.

### NFR coverage

| NFR | Test cases |
|-----|------------|
| NFR-1 (correctness/concurrency) | TC-14, TC-15, TC-16, TC-17, TC-18* |
| NFR-2 (single source of truth / no stale free) | TC-05, TC-09 |
| NFR-3 (access restriction) | TC-24, TC-25, TC-27* |
| NFR-4 (integrity of confirmed reservations) | TC-20, TC-22, TC-23, TC-33 |

### SEC-CHK coverage (18 checks; 6 P1)

| SEC-CHK | Priority | Test case | In-run status |
|---------|:--------:|-----------|---------------|
| SEC-CHK-1 | **P1** | TC-27 | mocked-session variant runs; real-verifier BLOCKED (BLK-2) |
| SEC-CHK-1b | **P1** | TC-28 | BLOCKED (BLK-2) |
| SEC-CHK-2 | **P1** | TC-25 | runnable |
| SEC-CHK-3 | P2 | TC-26 | runnable |
| SEC-CHK-4 | P2 | TC-06 | runnable |
| SEC-CHK-5 | **P1** | TC-16 | runnable (local store) |
| SEC-CHK-6 | **P1** | TC-18 | BLOCKED (BLK-1) — real store |
| SEC-CHK-7 | P2 | TC-20 | runnable |
| SEC-CHK-8 | P2 | TC-23 | runnable |
| SEC-CHK-9 | P2 | TC-35 | runnable |
| SEC-CHK-10 | **P1** | TC-29 | runnable |
| SEC-CHK-11 | **P1** | TC-30 | logic runnable; real-region evidence BLOCKED (BLK-3) |
| SEC-CHK-12 | P2 | TC-40 | BLOCKED (BLK-5) — GATE-DATA-1 |
| SEC-CHK-13 | P3 | TC-41 | BLOCKED (BLK-6) — subject-rights |
| SEC-CHK-14 | P2 | TC-39 | BLOCKED (BLK-4) — no control exists |
| SEC-CHK-15 | P3 | TC-33 | runnable |
| SEC-CHK-16 | P2 | TC-38 | runnable |
| SEC-CHK-17 | P2 | TC-31 | runnable |
| SEC-CHK-18 | P3 | TC-42 | BLOCKED (BLK-7) — no stack |

**All 18 SEC-CHK checks are covered by a named test case.** 12 are runnable in this run; 6 are
blocked on a gate (SEC-CHK-1/1b, 6, 12, 13, 14, 18) with the real-region half of SEC-CHK-11 also
blocked. **Of the six P1 checks:** SEC-CHK-2, 5, 10 are runnable now; SEC-CHK-1/1b, 6, and the
real-region half of 11 are **blocked on their gates** and must be green (against the real
verifier/store/region) before any production-like use.

### DQ coverage

| DQ | Test case |
|----|-----------|
| DQ-1 | TC-17 (and asserted inside TC-14/15/16/18) |
| DQ-2 | TC-36 |
| DQ-3 | TC-37 |
| DQ-4 | TC-29 |
| DQ-5 | TC-35 |
| DQ-6 | TC-14, TC-16, TC-17 |

### Engineering T-number coverage (19 cases, none dropped)

T1→TC-01/04, T2→TC-02, T3→TC-03, T4→TC-07, T5→TC-10/19, T6→TC-21, T7→TC-32, T8→TC-24/25,
T9→TC-26, T10→TC-12, T11→TC-08, T12→TC-11/20, T13→TC-14, T14→TC-15, T15→TC-22, T16→TC-29,
T17→TC-05/09, T18→TC-33, T19→TC-34. **All 19 engineering test cases are carried into the plan.**

---

## Coverage gaps and blocked-on-gate register

No AC is uncovered. The following are **not** coverage gaps in the plan but **testability blocks**
caused by open upstream gates — recorded so Delivery sees exactly what stays unproven:

| Block | Test(s) | Root gate | Why QA cannot fake a pass |
|-------|---------|-----------|---------------------------|
| **BLK-1** | TC-18 (SEC-CHK-6, RC-1/RC-2, AC-4 real store) | GATE-ARCH-1 + G-INFRA-1 | The one-winner invariant is only real if the **chosen** store enforces UC-1 atomically. A local-fake pass (TC-14..17) does not prove the real engine (Security F6 / Eng F1). No store selected → cannot run the real proof. |
| **BLK-2** | TC-27, TC-28 (SEC-CHK-1/1b, AC-6 real verifier) | G3/D1 + GATE-SEC-1 | AC-6 rests entirely on the upstream session (TB-2). Its minting/validation is unproven. Mocked-session negatives run now; the real forge/replay proof needs the real verifier. |
| **BLK-3** | TC-30 real-region half (SEC-CHK-11) | G-INFRA-1 (region) | Boot-time self-check logic is testable now, but "backups/replicas actually in-EU" needs the provisioned real region. |
| **BLK-4** | TC-39 (SEC-CHK-14) | RR-5 + GATE-BUDGET-1 | No rate-limit control is specified in any input. QA cannot test a control that does not exist; recommends the control be added, but does not invent acceptance. |
| **BLK-5** | TC-40 (SEC-CHK-12) | GATE-DATA-1 | Retention windows/permitted-use are proposals, not policy. Verifying them now would rubber-stamp unconfirmed policy. |
| **BLK-6** | TC-41 (SEC-CHK-13) | GATE-DATA-1 / GATE-SEC-1 (RR-4) | No erasure/subject-rights flow exists to test. |
| **BLK-7** | TC-42 (SEC-CHK-18) | G-INFRA-1 (stack) | No stack chosen → nothing to SCA-scan. |

---

## Regression scope

For any change in this slice, re-run the **load-bearing regression pack** before release:

- **Concurrency invariant:** TC-14, TC-15, TC-16, TC-17 (and TC-18 once BLK-1 clears). Any change
  to the store adapter, `claimSlot`, or the grid key granularity (G1/R5) re-triggers all of these.
- **Access gate:** TC-24, TC-25, TC-26 (and TC-27/28 once BLK-2 clears). Any change to the
  residency gate or session handling re-triggers these.
- **PII-out-of-logs:** TC-29. Any new log/trace/error statement re-triggers this (lint rule + scan).
- **Immutability of confirmed holds:** TC-20, TC-22, TC-23. Any change to the refusal/idempotency
  path re-triggers these.
- **Outcome mapping:** TC-07, TC-10, TC-21, TC-32 (all four `mapOutcome` branches) — cheap unit
  regression on every build.

If **G2 (cancellation) is reopened**, this pack expands: a new free-slot transition needs its own
concurrency proof (mirror of TC-14/16), its own authz test (only the holder may release), and an
audit-event test — flagged, not built here.

---

## Evidence required before Delivery (pilot readiness)

Delivery (1000) should require this evidence pack to decide **pilot / block / defer**:

1. **Green run of the in-run-runnable cases** (TC-01..TC-17 except TC-18; TC-19..TC-26, TC-29,
   TC-31, TC-32..TC-38; mocked-session TC-27) with stored output/log artefacts.
2. **AC-4 concurrency evidence:** TC-14/16 output showing 1 winner + DQ-1 empty + E4 audit with one
   `confirmed-yours` for the contended slot.
3. **PII-out-of-logs scan report** (TC-29) showing zero holder-shaped tokens.
4. **The blocked-on-gate register** (BLK-1..7) surfaced explicitly, each tied to its owning gate, so
   Delivery knows what is *unproven*, not silently green.
5. **Gate status:** which of GATE-ARCH-1, GATE-DATA-1, GATE-SEC-1, G-INFRA-1, GATE-REL-1,
   GATE-BUDGET-1 are signed off vs open.

**QA recommendation basis (not a release decision):** the slice is a candidate for a **constrained
pilot** only once the P1 checks that can be run in-run (SEC-CHK-2, 5, 10) are green **and** the
blocked P1 checks (SEC-CHK-1/1b real verifier, SEC-CHK-6 real store, SEC-CHK-11 real region) are
either closed or explicitly risk-accepted by their named human owners. **QA does not accept those
risks and does not approve release** — that is Delivery's call at GATE-REL-1.

---

## Human gates carried forward (testability lens)

| Gate | QA impact | Status |
|------|-----------|--------|
| **GATE-ARCH-1** (concurrency mechanism = Option A) | Blocks the real-store AC-4 proof (TC-18/BLK-1). Local proof runs; real proof waits. | `training-open` |
| **G-INFRA-1** (store product + EU region) | Blocks TC-18 (real store) and the real-region half of TC-30 (BLK-1/BLK-3) and TC-42 (BLK-7). | `training-open` |
| **G3 / D1 + GATE-SEC-1** (identity source / session policy) | Blocks the real-verifier AC-6 proof (TC-27/28, SEC-CHK-1/1b, BLK-2). | `training-open` → hard-stop for prod |
| **GATE-DATA-1** (classification / retention / permitted use) | Blocks TC-40 retention (BLK-5) and TC-41 erasure (BLK-6). | `training-open` |
| **RR-5 / GATE-BUDGET-1** (no rate-limit control) | Blocks TC-39 (BLK-4) — cannot test a non-existent control. | `recorded-open` |
| **G1** (slot grid granularity) | TC-37 (DQ-3) asserts grid integrity; UC-1 must guard the right unit once the grid is fixed. | `recorded-open` |
| **G2** (cancellation) | Out of scope; if reopened, regression pack expands (concurrency + authz + audit for release). | `recorded-open` |
| **GATE-REL-1** (production rollout) | QA supplies evidence; the release decision and residual-risk acceptance are Delivery's, not QA's. | `hard-stop` for prod |

**Human gate for this station:** release quality threshold, risk acceptance (RR-1..RR-5), and
compliance evidence (GATE-DATA-1) all need **owner approval** — QA pauses on these and does not
self-accept. Recorded for Delivery.

## Done-when check

Delivery (1000) can decide pilot/block/defer: it has 42 traceable test cases, full AC-1..AC-6
coverage (none zero), all 18 SEC-CHK checks mapped (6 P1 called out, 3 runnable + 3 blocked), all 6
DQ checks and all 19 engineering T-cases carried forward, the AC-4 N-way concurrency proof with its
data method (barrier hook + DQ-1 store assertion), a regression pack, an evidence list, and a
blocked-on-gate register (BLK-1..7) tied to the open human gates — none faked, none self-accepted.
