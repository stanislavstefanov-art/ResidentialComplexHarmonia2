# Data Design — Reserve the shared BBQ zone

**Station:** 700 Data (source: `fallback`)
**Feature slug:** `reserve-bbq-slot`
**Reads:** `runs/reserve-bbq-slot/400-architecture.md`
**Writes:** `runs/reserve-bbq-slot/700-data-design.md`

## Purpose of this document

Turn the architecture's data *shape* into a verifiable data contract so Infra/Ops (800),
Security (900), and QA (600) can confirm data handling **without inventing policy**. The
load-bearing decision is the **slot-identity key + uniqueness / conditional-write constraint**
that makes Option A (ADR-001, "set holder iff unheld") actually guarantee **exactly one holder
per slot** (AC-4 / NFR-1). This document does **not** choose the physical store or region (Infra
800), does **not** design authz/session (Security 900), and does **not** accept the EU
personal-data policy — it *flags* it and hands the confirmation to a human gate.

Store-agnostic by design: the contract is expressed as logical entities + constraints. Any store
qualifies **only if** it can enforce the atomic conditional write below (ADR-001 makes lack of it
a disqualifying criterion — R1). Both the relational and key-value encodings are given so Ops can
pick without re-deriving the invariant.

---

## Entities (4)

| # | Entity | Purpose | Personal data? |
|---|--------|---------|:---:|
| E1 | **Slot** (bookable slot instance) | The atomic unit that is claimed. One row/item per bookable (day + slot key). Holds the at-most-one-holder guarantee. | Yes (holder ref) |
| E2 | **SlotGridConfig** (slot-grid configuration) | Configured slot definitions (duration / count / window) the read surface enumerates (ADR-004 / PA1 / G1). Data, not code. | No |
| E3 | **Household** (holder reference) | The minimal reference identifying who holds a slot (PA2). Sourced upstream (G3/D1); **not** owned or created here. | Yes |
| E4 | **ClaimAuditEvent** (append-only audit) | Immutable record of each claim attempt + outcome, for QA/Security verification and dispute resolution. | Yes (holder ref) |

**Entity count: 4.**

E3 (Household) is modelled as a *reference* only. This slice stores a `householdRef` on the Slot
and Audit records; it does **not** store or master resident names/apartment/contact. Those live in
the upstream identity source (G3/D1) — see LA-DATA-2.

---

## Load-bearing decision — slot identity + uniqueness constraint (AC-4 / NFR-1)

### Slot identity key

A **Slot** is uniquely identified by:

```
slotId = (dayDate, slotKey)
```

- `dayDate` — the calendar day (EU-local date; date only, no time-of-day component), e.g. `2026-07-11`.
- `slotKey` — the identifier of a configured slot **within** that day, drawn from SlotGridConfig
  (E2). Its granularity is whatever the grid defines (G1) — a named window, an ordinal, or a
  start-time token. The uniqueness guarantee targets **this** granularity (ADR-004 / R5).

`slotId = (dayDate, slotKey)` is the **primary key / partition-item identity** of the Slot entity.
This is the single unit the invariant is enforced on.

### The uniqueness / conditional-write constraint (the invariant)

> **UC-1 (exactly-one-holder):** For any given `slotId`, there is **at most one** holder record.
> A claim is the single atomic write **"set `householdRef` for this `slotId` only if the slot is
> currently unheld"**. The datastore — not the application — decides the race. The winner's write
> commits; every other concurrent writer's write is **rejected by the constraint** and mutates
> nothing.

Two equivalent physical encodings (Ops 800 selects the store; both satisfy UC-1):

**Encoding R (relational)** — one held-slot row per claim, uniqueness on the slot key:

```sql
-- slot identity is the primary key; at-most-one-holder is intrinsic to the PK/unique index
CREATE TABLE bbq_slot_hold (
  day_date     DATE        NOT NULL,
  slot_key     TEXT        NOT NULL,
  household_ref TEXT       NOT NULL,        -- E3 reference; PII-flagged
  claimed_at   TIMESTAMPTZ NOT NULL,
  CONSTRAINT pk_bbq_slot PRIMARY KEY (day_date, slot_key)   -- <-- UC-1
);

-- Claim = one atomic conditional write. First writer wins; second is rejected.
INSERT INTO bbq_slot_hold (day_date, slot_key, household_ref, claimed_at)
VALUES ($day, $slot, $household, now())
ON CONFLICT (day_date, slot_key) DO NOTHING;   -- 0 rows affected => refused-already-taken
```

**Encoding K (key-value / document)** — single item keyed on slotId, conditional put:

```
Key:  slotId = "<dayDate>#<slotKey>"
Item: { slotId, householdRef, claimedAt }
Write condition: attribute_not_exists(slotId)      // create only if no holder  <-- UC-1
  -> success            => confirmed-yours
  -> ConditionalCheckFailed => refused-already-taken (existing item untouched)
```

### Outcome mapping (three-outcome contract, ADR-003 / C3–C5)

| Store result of the atomic conditional write | Surface outcome |
|----------------------------------------------|-----------------|
| Write committed (I am now holder) | `confirmed-yours` (C3) |
| Rejected AND existing `householdRef` == **me** (idempotent retry, R2) | `confirmed-yours` (C3) — see IC-1 |
| Rejected AND existing `householdRef` == **another household** | `refused-already-taken` (C4); existing hold untouched (AC-5/NFR-4) |
| Timeout / unknown / connection error | `couldn't-confirm` (C5) — client re-reads day |

### IC-1 — idempotency guard (holder == me ⇒ success)

> A household re-submitting its own already-confirmed claim (retry after a flaky
> `couldn't-confirm`, design D / R2) must see `confirmed-yours` for **its own** hold, not a false
> refusal. On a rejected conditional write, the surface reads the current holder; if
> `existing.householdRef == caller.householdRef` the outcome is `confirmed-yours`. This is a **read
> after the rejected write**, never a second write — so it cannot alter or steal a hold (NFR-4).
> Exact request/response encoding is Engineering's (500).

This guarantees AC-4 is testable exactly as QA needs: fire two simultaneous claims on one free
`slotId`, assert **exactly one** `confirmed-yours`, **one** `refused-already-taken`, **one** holder
row/item, existing hold untouched.

---

## Schema sketch — full field contract

### E1 — Slot (held-slot record)

| Field | Type | Key / constraint | PII | Notes |
|-------|------|------------------|:---:|-------|
| `day_date` | date (EU-local, date-only) | **PK part 1** (UC-1) | No | From SlotGridConfig-enumerated day |
| `slot_key` | text/token | **PK part 2** (UC-1) | No | Grid granularity per G1 (ADR-004) |
| `household_ref` | opaque token | NOT NULL | **Yes — PII** | Minimal holder reference (PA2); server-derived, never client-supplied (ADR-005) |
| `claimed_at` | timestamp (UTC) | NOT NULL | No | When the winning write committed; supports audit/ordering |

Only claimed slots exist as records. A `slotId` with **no** record = **free**. This makes
"at-most-one-holder" intrinsic to the primary key; there is no separate boolean "isTaken" to drift.
(No `release`/free transition exists — G2 out of scope, see below.)

### E2 — SlotGridConfig

| Field | Type | Key / constraint | PII | Notes |
|-------|------|------------------|:---:|-------|
| `slot_key` | text/token | **PK** | No | Stable identifier used to form `slotId` |
| `label` | text | NOT NULL | No | Human-readable window shown to residents |
| `start_offset` / `duration` | interval / text | — | No | Shape TBD by G1 owner; modelled configurable |
| `active` | boolean | NOT NULL, default true | No | Enumerated-only-if active |

Modelled as **data, not code** (ADR-004). The read surface enumerates `active` entries per day to
render the grid. Concrete values are **G1's open decision** (LA-DATA-1).

### E3 — Household (reference — NOT mastered here)

| Field | Type | Key / constraint | PII | Notes |
|-------|------|------------------|:---:|-------|
| `household_ref` | opaque token | referenced by E1/E4 | **Yes — PII (indirect identifier)** | Resolves to a resident/household in upstream identity (G3/D1). This slice stores only the token, never name/apartment/contact. |

### E4 — ClaimAuditEvent (append-only)

| Field | Type | Key / constraint | PII | Notes |
|-------|------|------------------|:---:|-------|
| `event_id` | uuid | **PK** | No | |
| `day_date` | date | NOT NULL | No | Target slot |
| `slot_key` | text | NOT NULL | No | Target slot |
| `household_ref` | opaque token | NOT NULL | **Yes — PII** | Who attempted |
| `outcome` | enum | NOT NULL | No | `confirmed-yours` / `refused-already-taken` / `couldn't-confirm` |
| `occurred_at` | timestamp (UTC) | NOT NULL | No | |

Append-only, immutable. Verifies AC-4/AC-5/NFR-4 after the fact and supports dispute resolution
("who actually holds Saturday"). See audit + retention below.

---

## Keys & constraints summary

| ID | Constraint | Entity | Enforces |
|----|-----------|--------|----------|
| **UC-1** | Uniqueness on `slotId = (day_date, slot_key)` + atomic conditional write "insert/create iff unheld" | E1 Slot | AC-4 / NFR-1 exactly-one-holder |
| PK-config | `slot_key` unique | E2 | Stable slot identity for `slotId` formation |
| FK-ish | `E1.household_ref`, `E4.household_ref` resolve to upstream identity | E1/E4→E3 | Holder traceability (soft ref; not a DB FK across the boundary) |
| NN-holder | `household_ref` NOT NULL on any held slot | E1 | No anonymous holds; every hold is attributable |
| IC-1 | Idempotent "holder==me ⇒ confirmed" via read-after-reject | E1 | R2 / retry safety, without extra write |
| AUDIT-APPEND | E4 insert-only, no update/delete before retention expiry | E4 | Tamper-evident audit for QA/Security |

**Store-selection gate (handed to Infra 800):** any candidate store is **disqualified** unless it
enforces UC-1 as a single atomic operation (unique constraint + conditional insert, or single-item
conditional put). This is ADR-001's R1 made concrete. A store offering only read-then-write without
atomic conditionality does **not** qualify.

---

## Data classification & PII flags (FLAGGED — human confirmation required)

Classification is **human-owned**. Below is the **proposed** classification; a human owner (DPO /
Security) must confirm before production-like use (GATE-DATA-1).

| Field | Proposed classification | Basis |
|-------|-------------------------|-------|
| `household_ref` (E1, E3, E4) | **Personal data (EU) — indirect identifier** | Architecture flagged householdRef as EU personal data; it resolves to an identifiable household/resident (brief: EU residents) |
| Upstream name / apartment / contact | **Personal data (EU) — direct identifiers** | Present in upstream identity (G3/D1); **not stored in this slice**, flagged for boundary awareness |
| `day_date`, `slot_key`, `claimed_at`, `label`, `outcome` | **Non-personal / operational** | Slot scheduling + config; not identifying on their own |
| `household_ref` **combined with** `day_date`+`slot_key` | **Personal data** | Links an identifiable household to a place/time (behavioural) → must be protected as PII in E1 and E4 |

PII handling rules proposed (Security 900 confirms/hardens):
- **Data minimisation:** store only `household_ref`, never resident name/apartment/contact here.
- **Keep out of logs:** `household_ref` must be excluded from application logs, error traces, and
  analytics (R4). Log the *outcome*, not the holder.
- **EU residency:** all records containing `household_ref` (E1, E4) and their backups must reside in
  an **EU region** (Infra 800 places; Security 900 confirms).

---

## Residency & retention (FLAGGED — human confirmation required)

Retention policy is **customer-data policy** and is **human-owned**. Proposed values below are
labelled assumptions pending confirmation (GATE-DATA-1) — QA/Ops/Security must not treat them as
policy until confirmed.

| Data | Proposed residency | Proposed retention | Confirmation owner |
|------|--------------------|--------------------|--------------------|
| E1 Slot (active holds) | EU region | Keep while the slot day is **current/future**; purge holds for past days after a short grace window (proposed **30 days** past `day_date`) | Owner + Security (GATE-DATA-1) |
| E2 SlotGridConfig | EU region | Retain while active; no personal data | Owner |
| E4 ClaimAuditEvent | EU region | Proposed **90 days** then delete (dispute/audit window) | Owner + Security (GATE-DATA-1) |
| Upstream identity (E3) | EU region (upstream) | **Not owned here** — governed by G3/D1 source | Upstream owner |

Proposed permitted use: `household_ref` may be used **only** to (a) render the resident's own slots,
(b) enforce the one-holder invariant, and (c) support dispute resolution via audit. Any other use
(marketing, profiling, sharing) is **out of scope and not permitted** unless a human owner
authorises it — flagged, not decided.

---

## Data quality checks (verifiable by QA 600 / Ops 800)

| ID | Check | Guards |
|----|-------|--------|
| DQ-1 | No two records share the same `slotId` (UC-1 holds) — count(slotId) grouped > 1 must be **empty** | AC-4 core invariant |
| DQ-2 | Every held Slot has a non-null `household_ref` | NN-holder / no orphan holds |
| DQ-3 | Every `slot_key` used in E1/E4 exists in E2 SlotGridConfig | Grid integrity / R5 |
| DQ-4 | No `household_ref` value appears in any application log or error trace | R4 / PII-out-of-logs |
| DQ-5 | E4 audit is append-only: no updates/deletes before retention expiry | Tamper-evidence |
| DQ-6 | For each concurrent-claim test on one free `slotId`: exactly one `confirmed-yours`, one holder record | AC-4 acceptance |

---

## Audit events (E4 detail)

Emit one **ClaimAuditEvent** per reserve attempt, at outcome time:
- `confirmed-yours` — a hold was created (or idempotent re-confirm, IC-1).
- `refused-already-taken` — attempt rejected; existing hold untouched (proves NFR-4).
- `couldn't-confirm` — unknown; client re-read expected (C5).

Audit is the evidence QA/Security use to prove AC-4/AC-5/NFR-4 held under real concurrency, and to
resolve "who holds Saturday" disputes. Audit records carry `household_ref` and are therefore
PII-classified and subject to the E4 retention above.

---

## Lineage

```
Upstream identity (G3/D1)  --derives-->  household_ref (server-side, ADR-005; never client input)
SlotGridConfig (E2, G1)    --enumerates->  bookable slotId = (day_date, slot_key)
Reserve surface (500)      --atomic UC-1 write-->  Slot hold (E1)  --and-->  ClaimAuditEvent (E4)
Read surface (500)         --reads E1 + E2 at request time-->  free / taken-mine / taken-other
```

No authoritative cache (ADR-002); the read surface derives state from E1 at request time.

---

## Open questions / human gates

- **GATE-DATA-1 (data classification, retention & permitted use — `training-open`, needs owner):**
  Classification of `household_ref` as EU personal data, the proposed retention windows (30d holds /
  90d audit), residency (EU), and permitted-use limits are **flagged for human confirmation**, not
  decided here. Per the station human gate ("pause if retention, classification, or permitted use of
  customer data is unclear"), this blocks production-like use until a data/security owner confirms.
  The training run may continue on the labelled proposals; a real release requires sign-off.
- **G1 carried forward (slot grid — `recorded-open`, upstream owner):** SlotGridConfig (E2) is
  modelled configurable (ADR-004). The concrete grid (duration/count/window) is undecided and sets
  `slot_key` granularity — hence the granularity UC-1 guards (R5). Owner must fix before release.
- **G3 / D1 carried forward (identity/household source — `recorded-open`, upstream owner):**
  `household_ref` (E3) is **referenced, not mastered** here. How the token is minted and resolved to
  a resident is upstream; this slice only stores/uses the opaque token. Security (900) enforces the
  resident gate.
- **G2 carried forward (cancellation — `recorded-open`, do not design):** out of scope. There is
  **no release/free-slot transition** in this schema; a held `slotId` stays held until retention
  purge. If the owner reopens G2, E1 needs a release transition **and** UC-1 must be extended with a
  concurrency-safe free operation (mirror of ADR-001). Flagged, not built.
- **Store choice deferred to Infra (800):** the physical store + EU region placement + backups are
  Ops decisions; this contract only imposes the disqualifying UC-1 atomic-claim requirement (R1).

## Labelled assumptions made by Data

- **LA-DATA-1 (grid modelled configurable):** because G1 is open, SlotGridConfig is modelled as
  configurable data with placeholder fields; concrete slot definitions are the owner's, not invented.
- **LA-DATA-2 (household_ref is a reference, not a master record):** this slice stores only an opaque
  `household_ref`; resident name/apartment/contact remain in the upstream identity source (G3/D1) and
  are not duplicated here (data minimisation).
- **LA-DATA-3 (proposed retention/classification pending GATE-DATA-1):** the 30d/90d retention, EU
  residency, and PII classification are proposed defaults for a single small building; they are
  **not** confirmed policy and must be signed off before production-like use.
- **LA-DATA-4 (store-agnostic contract):** both relational and key-value encodings are provided; the
  binding requirement is UC-1 atomic conditionality, not a specific product (Infra 800 selects).
