# Architecture — Reserve the shared BBQ zone

**Station:** 400 Architecture (source: `fallback`)
**Feature slug:** `reserve-bbq-slot`
**Reads:** `runs/reserve-bbq-slot/300-design.md` (primary), with facts carried from `200-spec.md` / brief
**Writes:** `runs/reserve-bbq-slot/400-architecture.md`

## Purpose of this document

Give Engineering (500), Data (700), Infra/Ops (800), Security (900), and QA (600) a thin but
unambiguous structure to work from. The load-bearing decision is **how the no-double-booking
invariant (AC-4 / NFR-1) is guaranteed under concurrency** — exactly one winner, durable,
deterministic. Everything else in this note is sized so that guarantee is cheap to keep and hard
to break.

This note does **not** write implementation code (Station 500) and does **not** finalise the data
schema (Station 700). It sketches only the component and data *shape* the invariant requires, and
records the architecture-option choice as a human confirmation gate.

## Business constraints honoured (carried from design/spec/brief)

These shape every option score below.

| Constraint | Source | Architectural consequence |
|-----------|--------|---------------------------|
| **Near-zero budget** | brief | No paid infra, no premium managed queue/lock service, no per-request cost that scales with idle time. Favour a single small managed datastore that already gives atomicity for free. |
| **Low / spiky usage** | brief | Contention is rare but real (a popular Saturday slot). No need to scale horizontally; the invariant must hold at the *single-slot* granularity, not at fleet scale. |
| **Non-technical phone users** | design (S1–C5) | Server owns the truth; client shows only confirmed outcomes (DA3). No client-side "optimistic" claim. Three observable outcomes only: confirmed-yours / refused-already-taken / couldn't-confirm. |
| **EU personal data** | brief (residents) | Holder identity = household/resident reference is personal data. Store the minimum (a household reference on the slot), keep it in an EU region, and keep it out of logs. Detailed handling delegated to Security (900) and Data (700). |
| **Residents-only trust boundary** | AC-6 / NFR-3 | View and reserve are gated on "signed-in resident" established upstream (G3 / D1). The reserve surface re-checks identity server-side; it never trusts the client's claim of residency. |

## System boundary (unchanged — no human gate triggered on boundary)

This slice adds **one application + one datastore** behind an **existing** identity/sign-in
mechanism (D1/G3, upstream, not built here). It does **not** introduce a new external platform
dependency beyond a single small database, and it does **not** move the trust boundary: the
resident boundary already exists upstream and is merely consumed. Therefore the fallback's
"changes system boundaries / new platform dependency" human gate is **not** tripped by the
boundary itself. It *is* tripped by accepting a concurrency mechanism as the durable invariant —
recorded as gate **GATE-ARCH-1** below.

```
[ Resident phone (browser/PWA) ]
        |  HTTPS, session from upstream identity (D1/G3)
        v
[ Identity / sign-in gate ]  <-- upstream, NOT built here (consumed)
        |  "signed-in resident" + household ref (PA2)
        v
+-------------------------------------------------+
|   BBQ Reservation Application (this slice)       |
|                                                  |
|   - Read surface:  GET day availability          |  --> reads authoritative record
|   - Reserve surface: POST claim a free slot      |  --> performs the ATOMIC CLAIM
|         returns: yours / already-taken / unknown |
+-------------------------------------------------+
        |  single connection
        v
[ Authoritative datastore ]  <-- the ONE source of truth (NFR-2)
   holds: slot identity + at-most-one holder per slot (the invariant lives HERE)
```

## Data flow (two surfaces, from design handoff)

1. **Read availability (US-1 / AC-1).** Client requests a day. Server derives, per configured slot
   (PA1 / G1), one of: free / taken-mine / taken-other, from the authoritative record. No write.
2. **Reserve a slot (US-2 / AC-2..AC-5).** Client POSTs a claim on a specific free slot. Server
   performs the **atomic claim** (see chosen option) and returns exactly one of:
   - `confirmed-yours` (C3) — this household now holds it,
   - `refused-already-taken` (C4) — another household holds it; existing hold untouched (AC-5),
   - `couldn't-confirm` (C5) — unknown result; client re-reads the day (source of truth) to learn
     the real state. No fabricated outcome.

The **client never decides success** (DA3). The reserve response is authoritative.

---

## The load-bearing decision — guaranteeing exactly-one-winner (AC-4 / NFR-1)

### Options considered

**Option A — Database unique constraint on (slot) + insert/conditional-write "claim".**
Model each held slot as a row (or item) whose key includes the slot identity, with a uniqueness
guarantee on the slot. The claim is a single conditional write ("create the holder record for this
slot only if none exists"). The database rejects the second writer. The loser's rejection maps to
`refused-already-taken`. Works on a small relational DB (unique index + `INSERT ... ON CONFLICT`)
or a single-item conditional put on a small managed key-value store.

**Option B — Application-level lock (mutex / advisory lock) around read-then-write.**
The app acquires a lock keyed on the slot, reads "is it free?", writes the holder, releases. Correct
only if every writer shares one lock authority.

**Option C — Serialized writer (single-threaded queue / actor per slot).**
All reserve attempts for a slot funnel through one processor that handles them one at a time; the
first grants, the rest are refused.

### Scored comparison

Weights reflect this feature's priorities: correctness of the invariant dominates; then cost
(near-zero budget); then operational simplicity (no ops team); then latency (spiky, low volume, so
low weight); then EU-data fit.

| Criterion (weight) | A — DB unique/conditional claim | B — App-level lock | C — Serialized writer |
|--------------------|:---:|:---:|:---:|
| Invariant strength — durable exactly-one (×5) | 5 | 3 | 4 |
| Near-zero cost (×4) | 5 | 3 | 2 |
| Operational simplicity — no extra moving part (×3) | 5 | 2 | 2 |
| Low latency under spiky load (×2) | 4 | 3 | 3 |
| EU-data / single-store fit (×1) | 5 | 4 | 4 |
| **Weighted total (max 75)** | **72** | **43** | **44** |

Scoring notes:
- **A** puts the invariant *inside the durable store*, so it survives process crashes and needs no
  extra service — cheapest and strongest. Its only real risk is depending on the store actually
  enforcing uniqueness/conditional writes (verified below).
- **B** re-introduces a distributed-lock problem: a lock that lives in app memory fails the moment
  there is more than one app instance or a restart mid-hold; a lock in a separate service adds a
  new platform dependency (violates near-zero budget and trips a boundary gate). It also risks a
  hold "leaking" if the writer dies before writing.
- **C** is correct but adds a queue/actor runtime to build, deploy, and monitor — cost and ops
  weight it down for a spiky, low-volume single-zone feature.

### Chosen option: **Option A — atomic conditional claim enforced by the datastore**

The no-double-booking invariant is enforced by a **single atomic write that succeeds for exactly
one writer**, backed by a uniqueness/conditional-write guarantee in the one authoritative datastore.
Concretely (shape only — schema is Station 700's to finalise):

- The authoritative record has an at-most-one-holder-per-slot guarantee keyed on the slot identity
  (unique index on the slot key, or single-item conditional put).
- **Reserve = one atomic conditional write:** "record this household as holder of this slot **only
  if the slot has no holder**." The store, not the app, decides the race.
- Success → `confirmed-yours`. Constraint/condition failure → `refused-already-taken`. The refused
  writer performs **no** mutation, so the existing holder is untouched (AC-5 / NFR-4). Any other
  error (timeout, unknown) → `couldn't-confirm`, and the client re-reads (C5).
- **Idempotency guard:** a household re-submitting its own confirmed claim (retry after a flaky
  `couldn't-confirm`, per design D) must see `confirmed-yours` for *its own* hold, not a false
  refusal — i.e. "holder already == me" is a success, "holder == someone else" is a refusal. Exact
  encoding delegated to Data (700) + Engineering (500).

This choice keeps budget near zero (no lock service, no queue), keeps operations trivial (one
store), and makes AC-4 testable exactly as QA needs (fire two simultaneous claims, assert one
success + one clean refusal + one holder).

---

## ADR-style records (all status: **proposed**)

### ADR-001 — Atomic conditional claim in the datastore is the concurrency mechanism
- **Status:** proposed (awaiting GATE-ARCH-1 human confirmation)
- **Context:** AC-4 / NFR-1 require a durable, deterministic exactly-one-winner under simultaneous
  claims, on a near-zero budget with no ops team.
- **Decision:** Enforce the invariant with a store-level uniqueness/conditional-write on the slot
  key; reserve is a single atomic conditional write. Refused writers do not mutate state.
- **Consequences:** Invariant survives crashes and needs no extra service. Depends on the chosen
  store genuinely providing atomic conditional writes / unique constraints — this becomes a **hard
  selection criterion** handed to Data (700): a store without that guarantee is disqualified.
- **Alternatives:** app-level lock (B), serialized writer (C) — both scored lower (cost + ops).

### ADR-002 — Single authoritative datastore as the one source of truth (NFR-2)
- **Status:** proposed
- **Context:** Feature exists to replace paper + spreadsheet split-brain. Availability shown must
  reflect the real record.
- **Decision:** One datastore holds slot-holder truth; both surfaces read/write only it. No cache
  is treated as authoritative; the read surface derives state at request time.
- **Consequences:** No stale "free" beyond normal refresh. Read-after-refuse (design DA4) re-reads
  this store. Simplifies EU-data residency (one place to locate and protect the personal data).

### ADR-003 — Server-authoritative outcomes; client never decides success (DA3)
- **Status:** proposed
- **Context:** Non-technical phone users on flaky signal; the trust win is that the screen never
  lies. Design rule DA3.
- **Decision:** The reserve surface returns exactly one of three outcomes; the client renders that
  outcome and never shows "yours" before the server confirms. Unknown → re-read, never assume.
- **Consequences:** Eliminates the "two people both think they hold Saturday" failure at the
  presentation layer. Requires the reserve response to be unambiguous (three-outcome contract).

### ADR-004 — Configured slot grid is data, not code (PA1 / G1)
- **Status:** proposed
- **Context:** Slot duration/count/window are an unresolved owner decision (G1) but the read surface
  must render *whatever* grid is configured.
- **Decision:** Treat the slot grid as configuration/data the read surface enumerates; do not
  hard-code a schedule. The invariant is per-slot-identity regardless of grid shape.
- **Consequences:** G1 can be resolved later without re-architecting. Data (700) defines how a slot
  identity is formed (day + slot key) so the unique constraint targets the right granularity.

### ADR-005 — Residents-only enforced server-side at both surfaces (AC-6 / NFR-3)
- **Status:** proposed
- **Context:** Trust boundary is residents-only; identity is upstream (G3/D1) and consumed here.
- **Decision:** Both the read and reserve surfaces re-verify "signed-in resident" server-side on
  every request from the upstream session; the household reference (PA2) is derived server-side, not
  taken from client input. Non-resident → refused, no record created.
- **Consequences:** The client cannot forge residency or spoof another household as holder. Detailed
  authz/session validation and personal-data handling delegated to Security (900).

---

## Component sketch (shape for downstream stations — not implementation)

| Component | Responsibility | Owner station |
|-----------|----------------|---------------|
| **Availability read surface** | Enumerate configured slots for a day, derive per-slot state from the authoritative record, gate on resident identity | Engineering (500) |
| **Reserve surface** | Perform the atomic conditional claim; return exactly one of yours / already-taken / unknown; gate on resident identity; derive household ref server-side | Engineering (500) |
| **Authoritative record (slot-holder store)** | Hold at-most-one-holder-per-slot with a store-enforced uniqueness/conditional-write guarantee; be the single source of truth | Data (700) |
| **Slot-grid configuration** | Provide the configured slot set (PA1/G1) the read surface enumerates | Data (700) + owner (G1) |
| **Identity/session boundary** | Establish "signed-in resident" + household mapping | Upstream (G3/D1) — consumed only |

**Data shape the invariant needs (sketch only — Station 700 finalises):**
- a **slot identity** = (day, slot key) that is unique per bookable slot;
- an **at-most-one holder** guarantee on that slot identity (unique index / single-item key);
- a **holder reference** = household (PA2), stored as the minimum personal-data reference;
- claim = conditional write "set holder iff currently unheld"; refusal leaves the record unchanged.

## Non-functional requirements & budgets

NFR-1..NFR-4 come from the spec; the numbers below are **architecture-proposed budgets** for a
low/spiky, single-zone, single-building feature. They are starting sizes for Ops (800) and QA (600)
to confirm, not committed SLAs — the brief did not quantify performance, so these are labelled
assumptions (see LA-ARCH-1) rather than invented facts.

| NFR | Requirement | Proposed budget / target | Verified by |
|-----|-------------|--------------------------|-------------|
| NFR-1 Correctness | Exactly-one-winner, durable, deterministic | **Zero** double-booked slots under concurrent claims — hard invariant, no tolerance | QA (600): simultaneous-claim test |
| NFR-2 Single source of truth | Availability reflects the record | Read reflects committed writes; no authoritative cache; stale window ≈ 0 within a request | QA (600) / Data (700) |
| NFR-3 Access | Residents-only, server-enforced | 100% of view/reserve requests re-checked; non-resident → refused | Security (900) / QA (600) |
| NFR-4 Integrity | Refused attempt never alters existing hold | Existing holder invariant preserved across concurrent + retry cases | QA (600) |
| Latency (proposed) | Reserve feels immediate on a phone | p95 reserve outcome ≤ ~1s under expected spiky peak (small single building) | Ops (800) |
| Availability (proposed) | Best-effort for a single building | Business-hours best-effort; no HA/multi-region required at near-zero budget | Ops (800) |
| Cost (proposed) | Near-zero | Single small datastore + single small app; no idle-scaling paid services | Ops (800) |
| EU data residency | Personal data stays in EU | Datastore + backups in an EU region; holder ref excluded from logs | Security (900) / Ops (800) |

## Risks

| ID | Risk | Impact | Mitigation / owner |
|----|------|--------|--------------------|
| R1 | Chosen datastore does not truly provide atomic conditional-write / unique constraint | Invariant silently becomes best-effort → double-booking | ADR-001 makes atomic-claim support a **disqualifying** store-selection criterion → Data (700) |
| R2 | Retry after `couldn't-confirm` (flaky signal, design D/C5) causes a false refusal of one's own hold | Resident who actually won is told "just taken" — trust damage | ADR-001 idempotency guard (holder==me ⇒ success) → Engineering (500) + Data (700) |
| R3 | Read surface serves stale "free" and hides a taken slot | Resident tries a dead slot; extra lost-the-race refusals | ADR-002 read-at-request-time from authoritative store; no authoritative cache → Engineering (500) |
| R4 | Household reference (personal data) leaks into logs/errors/analytics | EU personal-data exposure | Exclude holder ref from logs; minimise stored fields → Security (900) + Ops (800) |
| R5 | Grid granularity (G1) undefined; slot identity keyed at wrong granularity | Unique constraint guards the wrong unit; overlap possible | ADR-004 slot-as-data; Data (700) defines slot identity; **G1 owner** must fix grid before release |
| R6 | Concurrency mechanism accepted without human confirmation | Line proceeds on an assumed invariant | GATE-ARCH-1: 400→500 confirmation gate (below) |

## Decisions delegated to downstream stations (so each can produce its output without guessing)

- **Engineering (500):** the two surface contracts (request/response shapes for read + reserve),
  the three-outcome mapping, server-side residency check + household derivation, and the retry/
  idempotency behaviour of the claim. Implements ADR-001/003/004/005. Does **not** redefine the
  invariant mechanism.
- **Data (700):** finalise the schema/store choice; encode slot identity (day + slot key), the
  at-most-one-holder uniqueness/conditional-write, and the idempotent "holder==me" success. Confirm
  the store genuinely provides atomic conditional writes (R1) — a store lacking it is disqualified.
- **Infra/Ops (800):** size and place the single datastore + app in an **EU region**, confirm the
  proposed latency/availability/cost budgets or renegotiate them, backups in-region, no paid idle
  scaling.
- **Security (900):** authz at both surfaces (AC-6/NFR-3), personal-data minimisation and EU
  handling of the household reference, keep holder ref out of logs (R4), session/identity trust from
  upstream (G3/D1).
- **QA (600):** turn AC-1..AC-6 into tests, with AC-4 as the priority — simultaneous claims assert
  exactly one `confirmed-yours`, one `refused-already-taken`, one holder, existing hold untouched;
  plus the retry-idempotency case (R2) and the residents-only gate.

## Open questions / human gates

- **GATE-ARCH-1 (concurrency mechanism confirmation — 400→500 — `training-open`, needs owner):**
  Option A (store-level atomic conditional claim) is the **recommended** mechanism for the AC-4/
  NFR-1 invariant, but selecting the durable concurrency mechanism (and thereby accepting the
  residual NFR risk R1) is a human-owned confirmation, per the fallback human-gate rule (accepting a
  non-functional risk). **Recorded as open, not assumed signed off.** The run may continue to
  Station 500 on the labelled assumption that Option A is confirmed; a real release must have an
  owner confirm ADR-001. Status stays open until confirmed.
- **G1 carried forward (slot grid — recorded-open, upstream owner):** slot duration/count/window
  still undefined; ADR-004 lets architecture proceed with slot-as-data, but the concrete grid must
  be fixed by the owner before release, and it sets the unique-constraint granularity (R5).
- **G3 / D1 carried forward (identity source — recorded-open, upstream owner):** "signed-in
  resident" and household mapping (PA2) are consumed, not designed. Security (900) enforces the gate;
  the identity mechanism itself is upstream.
- **G2 carried forward (cancellation — recorded-open, do not design):** out of scope. Note for
  downstream: no release/free-slot transition exists yet, so the store shape only needs claim, not
  release. If the owner reopens G2, ADR-001 must be extended with a free-slot transition and its own
  concurrency copy.
- **EU personal-data acceptance (Security-owned):** storing a household reference on a slot is EU
  personal data. Architecture flags it; the acceptable handling/retention decision is delegated to
  Security (900) and is not decided here.

## Labelled assumptions made by Architecture

- **LA-ARCH-1 (NFR budgets are proposed, not committed):** latency/availability/cost numbers are
  architecture starting sizes for a single small building on near-zero budget, since the brief did
  not quantify them. Ops (800) confirms or renegotiates. Not invented business SLAs.
- **LA-ARCH-2 (Option A confirmed for continuation):** to let Station 500 produce its output, the
  run assumes Option A is the chosen mechanism. This is a labelled assumption pending GATE-ARCH-1;
  it does not constitute human sign-off.
- **LA-ARCH-3 (single small managed store suffices):** given low/spiky single-zone usage, one small
  datastore that provides atomic conditional writes meets NFR-1..NFR-4 without a lock service or
  queue. Data (700) validates the concrete store against the atomic-claim requirement.
