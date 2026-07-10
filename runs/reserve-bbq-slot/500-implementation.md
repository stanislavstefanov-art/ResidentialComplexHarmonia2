# Implementation Plan — Reserve the shared BBQ zone

**Station:** 500 Engineering (source: `fallback`)
**Feature slug:** `reserve-bbq-slot`
**Reads:** `runs/reserve-bbq-slot/400-architecture.md`
**Writes:** `runs/reserve-bbq-slot/500-implementation.md`

## Purpose

Turn the chosen architecture into an inspectable **implementation plan** (not merged code) for one
vertical slice: a resident views a day's BBQ slots and claims a free one, with **exactly one winner**
under concurrent claims. This plan realises **Option A** from Station 400 (ADR-001): a store-level
**atomic conditional claim** ("set holder iff currently unheld"), where the *datastore*, not the app,
decides the race. Merge is human-owned.

This plan does **not** finalise the schema (Station 700 owns it), does **not** size infra (Station
800), does **not** accept security/data risk (Station 900), and does **not** redefine the concurrency
mechanism. It builds on Option A as a **labelled assumption** (LA-500-1) pending **GATE-ARCH-1**.

## Scope of the slice

In scope (this plan):
- Read surface: `GET` day availability → per-slot state (free / taken-mine / taken-other).
- Reserve surface: `POST` claim → exactly one of `confirmed-yours` / `refused-already-taken` /
  `couldn't-confirm`.
- The **atomic-claim path** and the **refused-attempt path**, both explicit.
- Server-side residency re-check and server-derived household reference.
- Idempotent retry ("holder == me" ⇒ success) for flaky-signal re-submits.

Out of scope (delegated, do not build here): schema/store choice (700), infra placement (800), authz
mechanism internals and personal-data retention (900), test execution (600), cancellation/release
(G2), the concrete slot grid (G1), the identity source (G3/D1).

---

## Files / services likely touched (indicative module map)

Language/framework are **not** fixed by architecture (single small app + single small store). This
plan uses framework-neutral module names so Ops/Security/QA can inspect *what* changes without a
prejudged stack. Data (700) owns the store adapter's concrete implementation.

| Module (indicative) | Responsibility | Notes |
|---------------------|----------------|-------|
| `api/availability.read` | Handle `GET /days/{day}/slots`; residency gate; enumerate grid; derive per-slot state | ADR-002/004/005 |
| `api/reserve.claim` | Handle `POST /days/{day}/slots/{slotKey}/claim`; residency gate; derive household; call atomic claim; map outcome | ADR-001/003/005 |
| `domain/slotState` | Pure derivation: (holder, me) → free / taken-mine / taken-other | Unit-testable, no I/O |
| `domain/claimOutcome` | Pure mapping: store result → confirmed-yours / refused-already-taken / couldn't-confirm | Unit-testable, no I/O |
| `store/slotHolder` (interface) | `getDayHolders(day)`, `claimSlot(slotKey, householdRef)` returning a discriminated result | **Contract owned here; impl owned by Data (700)** |
| `config/slotGrid` (interface) | Provide configured slots for a day (PA1/G1) | Data (700) + G1 owner supply values |
| `auth/session` (consumed) | Resolve upstream session → `{ isResident, householdRef }` | Upstream (G3/D1); consumed, not built |

---

## Interfaces (contracts owned by Engineering; shapes only, not schema)

### Read surface — `GET /days/{day}/slots`
- **Request:** `day` (grid-relative date key); identity from upstream session (never from body).
- **Response (200):** `{ day, slots: [ { slotKey, state } ] }` where `state ∈ { free, taken-mine, taken-other }`.
- **Non-resident:** refused (see residency gate) — no slot data returned.
- **No write.** State derived at request time from the authoritative record (ADR-002; mitigates R3).

### Reserve surface — `POST /days/{day}/slots/{slotKey}/claim`
- **Request:** path `day`, `slotKey`; identity from upstream session. **No holder field in the body**
  (household is derived server-side — ADR-005; prevents spoofing another household).
- **Response — exactly one outcome (three-outcome contract, ADR-003):**

  | HTTP | `outcome` | Meaning | Design state (300) |
  |------|-----------|---------|--------------------|
  | 200 | `confirmed-yours` | This household now holds the slot (or already did — idempotent) | C3 confirmed-yours |
  | 409 | `refused-already-taken` | Another household holds it; existing hold untouched (AC-5) | C4 refused-already-taken |
  | 503/504 | `couldn't-confirm` | Unknown result; client must re-read the day | C5 couldn't-confirm → DA4 re-read |

- The client **never** decides success; it renders the returned outcome only (DA3).

### Store contract (defined here, implemented by Data 700)
`claimSlot(slotKey, householdRef)` MUST return a **discriminated result**, not a boolean, so the app
can distinguish the three states without a follow-up read on the happy/refusal paths:

- `Claimed` — this write set the holder to `householdRef` (I won the race).
- `AlreadyHeldByMe` — a holder already existed and equals `householdRef` (idempotent retry, R2).
- `AlreadyHeldByOther` — a holder already existed and differs (I lost the race).
- `Unavailable` — timeout / connection / unknown store error (no evidence of mutation).

The **atomicity guarantee lives inside `claimSlot`** (unique index + conditional insert, or
single-item conditional put) — this is Option A. The app treats it as a single indivisible operation.

---

## Pseudocode — key components

### 1. Residency gate (shared by both surfaces) — ADR-005 / AC-6 / NFR-3
```
function requireResident(session):
    ctx = auth.session.resolve(session)          # upstream G3/D1, consumed
    if ctx is null or not ctx.isResident:
        return Refused(401_or_403)               # non-resident: no data, no record created
    return Resident(householdRef = ctx.householdRef)   # derived server-side, NOT from client body
```

### 2. Read availability — ADR-002 / ADR-004 / AC-1
```
function getDaySlots(day, session):
    resident = requireResident(session); if refused -> return refused

    slots   = config.slotGrid.forDay(day)        # grid is data (G1), enumerated not hard-coded
    holders = store.getDayHolders(day)           # authoritative read AT REQUEST TIME (no auth cache)

    result = []
    for slot in slots:
        holder = holders[slot.slotKey]           # may be absent
        result.append({ slotKey: slot.slotKey,
                        state:  deriveState(holder, resident.householdRef) })
    return Ok({ day, slots: result })

function deriveState(holder, me):                # pure, unit-testable
    if holder is absent:      return "free"
    if holder == me:          return "taken-mine"
    else:                     return "taken-other"
```

### 3. Reserve — the atomic-claim path AND the refused-attempt path — ADR-001 / AC-2..AC-5 / NFR-1/NFR-4
```
function claim(day, slotKey, session):
    resident = requireResident(session); if refused -> return refused

    # THE load-bearing line: one atomic conditional write. The STORE decides the race,
    # not the app. No read-then-write in the app layer (that would reopen the TOCTOU gap
    # Option B/C were rejected to avoid).
    result = store.claimSlot(slotKey, resident.householdRef)

    return mapOutcome(result)

function mapOutcome(result):                     # pure, unit-testable
    switch result:
        case Claimed:            return Ok200(  "confirmed-yours")        # I won the race (C3)
        case AlreadyHeldByMe:    return Ok200(  "confirmed-yours")        # idempotent retry (R2, C3)
        case AlreadyHeldByOther: return Conflict409("refused-already-taken")  # I lost / already taken (C4)
                                                                          #   -> existing hold UNTOUCHED (AC-5)
        case Unavailable:        return Unavail503("couldn't-confirm")    # unknown -> client re-reads (C5/DA4)
```

**Atomic-claim path (winner):** `claimSlot` performs the conditional write, no prior holder exists,
the write commits, returns `Claimed` → `confirmed-yours` (design C3).

**Refused-attempt path (loser / already-taken):** the same conditional write is **rejected by the
store's uniqueness/condition** because a holder already exists. The app performs **no** mutation on
this path — it never reads-then-writes — so the existing holder is provably untouched (AC-5 / NFR-4).
The store returns `AlreadyHeldByOther` → `refused-already-taken` (design C4), which the client renders
as "already taken" and re-reads the day to see the current truth (DA4).

**Flow back to design states:** `Claimed`/`AlreadyHeldByMe` → **C3**; `AlreadyHeldByOther` → **C4**;
`Unavailable` → **C5** → design DA4 re-read. Exactly one of the three observable outcomes is always
returned; no fabricated success (DA3).

### 4. Store-side conditional claim (shape only — Data 700 finalises)
```
# Expressed against the invariant, not a concrete engine. Data(700) picks unique-index+INSERT..ON CONFLICT
# (relational) OR single-item conditional put (managed KV). Both give the SAME discriminated result.
function claimSlot(slotKey, householdRef):
    try:
        # ATOMIC: create holder for slotKey ONLY IF none exists (unique constraint / condition-not-exists)
        writeResult = store.conditionalSetHolder(key=slotKey, holder=householdRef,
                                                 condition="holder is absent")
        if writeResult.committed:  return Claimed
    catch ConditionFailed / UniqueViolation:
        existing = store.readHolder(slotKey)         # only on refusal, to disambiguate me vs other
        if existing == householdRef:  return AlreadyHeldByMe
        else:                          return AlreadyHeldByOther
    catch Timeout / ConnectionError:  return Unavailable
```
Note: the refusal-path read of `existing` is *not* part of the winner decision — the winner was
already decided atomically by the conditional write. The read only classifies an already-lost race
into `me` vs `other`. This preserves Option A's guarantee (no app-level read-then-write on the write
path).

---

## Validation logic

| Check | Where | Rule |
|-------|-------|------|
| Resident identity | Both surfaces | `isResident` true from upstream session; else refuse (AC-6). Never trust a client-supplied residency/household claim. |
| Household derivation | Reserve | `householdRef` comes only from resolved session (ADR-005). Body household fields ignored/rejected. |
| Slot exists in grid | Both | `slotKey` must be in `config.slotGrid.forDay(day)`; unknown slot → 404 (not a claim attempt). |
| Day well-formed | Both | `day` parses to a grid-relative key; malformed → 400. |
| No client success flag | Reserve | Outcome is server-derived from store result only (DA3). |
| Idempotent self-retry | Reserve | `AlreadyHeldByMe` ⇒ `confirmed-yours`, never a false refusal (R2). |
| Personal data in logs | Both | `householdRef` excluded from logs/errors (flagged; Security 900 owns acceptance — R4). |

---

## Test hooks (built into the plan so QA/Security/Infra can verify)

- **Injectable `store` and `auth.session`** interfaces → tests substitute a fake store and fake
  session without real infra or real identity.
- **Deterministic concurrency hook:** the fake/integration store exposes a barrier so two claims can
  be released simultaneously against a real conditional-write, making AC-4 reproducible (QA 600).
- **Pure functions** `deriveState` and `mapOutcome` are I/O-free → fast unit coverage of every state
  and outcome branch.
- **Outcome/log assertion hook:** a test seam asserting `householdRef` never appears in emitted log
  lines (feeds R4 / Security 900).

### Local verification commands (indicative — Ops/QA confirm the concrete stack)
```
# unit + integration (framework-neutral placeholders; actual runner set once stack is chosen)
<pkg> test unit           # deriveState, mapOutcome, residency gate, validation
<pkg> test integration    # real conditional-write against a local store instance
<pkg> test concurrency    # two simultaneous claims via the barrier hook -> assert 1 winner
<pkg> lint                # incl. rule: no householdRef in log statements
```
No production data, no credentials, no live writes are required to run these — all against a
local/ephemeral store (respects run bounds).

---

## Test-approach table

Tiers: **U** = unit (pure/mocked, no I/O), **I** = integration (real local store conditional write),
**C** = concurrency (simultaneous claims via barrier), **Sec** = security-lens check, **M** = manual/exploratory.

| # | Test case | Tier | Realises |
|---|-----------|------|----------|
| T1 | `deriveState`: absent holder → `free` | U | AC-1 |
| T2 | `deriveState`: holder == me → `taken-mine` | U | AC-1 |
| T3 | `deriveState`: holder == other → `taken-other` | U | AC-1 |
| T4 | `mapOutcome`: `Claimed` → `confirmed-yours` (200) | U | AC-2/C3 |
| T5 | `mapOutcome`: `AlreadyHeldByOther` → `refused-already-taken` (409) | U | AC-5/C4 |
| T6 | `mapOutcome`: `AlreadyHeldByMe` → `confirmed-yours` (idempotent) | U | R2/C3 |
| T7 | `mapOutcome`: `Unavailable` → `couldn't-confirm` (503) | U | C5/DA4 |
| T8 | Residency gate refuses non-resident on read and reserve | U | AC-6/NFR-3 |
| T9 | Reserve ignores client-supplied household; uses session-derived ref | U | ADR-005 |
| T10 | Unknown `slotKey` → 404 (no claim attempted) | U | validation |
| T11 | Single claim on free slot commits holder in store | I | AC-2 |
| T12 | Second sequential claim on held slot returns `AlreadyHeldByOther`, holder unchanged | I | AC-5/NFR-4 |
| T13 | **Two simultaneous claims → exactly one `confirmed-yours`, one `refused-already-taken`, one holder** | C | **AC-4/NFR-1** |
| T14 | Concurrent claims never leave slot with two holders / no holder | C | AC-4/NFR-1 |
| T15 | Retry of own confirmed claim after simulated `couldn't-confirm` → `confirmed-yours` | I | R2 |
| T16 | `householdRef` absent from all log output during claim + refusal | Sec | R4 |
| T17 | Read reflects a just-committed claim (no authoritative cache / stale free) | I | R3/NFR-2 |
| T18 | Store timeout injected → `couldn't-confirm`, no partial holder written | I | C5/NFR-4 |
| T19 | Exploratory: flaky-signal double-tap on phone renders one honest outcome | M | DA3 |

**Counts:** Components in pseudocode/interface plan: **6** (residency gate, read availability,
`deriveState`, reserve/claim, `mapOutcome`, store `claimSlot`). Test cases in the table: **19**.

---

## Multi-lens review of this plan

### Correctness / concurrency lens
- The winner is decided by a single atomic conditional write inside the store — no app-layer
  read-then-write on the write path, so there is **no TOCTOU window** (the reason B/C were rejected).
  T13/T14 assert this directly. **No High/Critical finding**, conditional on GATE-ARCH-1 and R1.
- **F1 (High — dependency, not a defect):** correctness *depends entirely* on the store genuinely
  enforcing the conditional write atomically (architecture R1). If Data (700) selects a store without
  a real atomic conditional write / unique constraint, this plan silently degrades to best-effort.
  **Mitigation already owned upstream:** ADR-001 makes atomic-claim support a **disqualifying**
  store-selection criterion for Data (700); the concurrency test T13/T14 must run against the *real*
  chosen store, not only a fake. Carried as a dependency, not accepted here.

### Data / personal-data lens
- `householdRef` is EU personal data. The plan derives it server-side and flags it out of logs (T16),
  but **acceptance of retention/handling is Security (900)'s** — not decided here. No schema defined
  (Data 700 owns it). No finding beyond the delegated R4.

### Security lens
- Residency re-checked server-side on both surfaces; household never taken from client body (T8/T9).
  Detailed session-trust and authz internals delegated to Security (900). No High/Critical from this
  plan; consistent with ADR-005.

### Reliability / failure lens
- `couldn't-confirm` never fabricates success; client re-reads authoritative truth (T7/T18/DA4). The
  refusal-path disambiguation read (me vs other) is off the winner-decision path, so it cannot create
  a double-booking. **No finding.**

### Operability / cost lens
- One app + one store, no lock service or queue → matches near-zero budget. Local verification needs
  no paid infra or credentials. Sizing/placement delegated to Ops (800). **No finding.**

### Scope-discipline lens
- No cancellation/release path built (G2 out of scope) — the store shape needs claim only. No slot
  grid hard-coded (G1 as data). No identity mechanism built (G3/D1 consumed). **No scope expansion.**

**High/Critical findings summary:** one **High** dependency finding **F1** (correctness contingent on
the store's atomic conditional-write guarantee — architecture R1, owned by Data 700 as a disqualifying
selection criterion and by QA 600 to test against the real store). No Critical findings. No plan-level
defect requiring a human gate beyond those already open.

---

## Open questions / human gates (carried forward with labelled assumptions)

- **GATE-ARCH-1 (concurrency mechanism confirmation — `training-open`, needs owner):** this plan is
  built entirely on Option A. Selecting the durable concurrency mechanism remains a human-owned
  confirmation upstream. **LA-500-1:** Option A is assumed confirmed to let this station produce its
  output; this is a labelled assumption, **not** sign-off. A real merge/release requires GATE-ARCH-1
  closed.
- **G1 (slot grid — `recorded-open`, upstream owner):** slot duration/count/window undefined. **LA-500-2:**
  the plan treats the grid as data (`config.slotGrid`) and keys the invariant on `(day, slotKey)`; the
  concrete grid and thus the unique-constraint granularity (R5) must be fixed by the G1 owner and
  finalised by Data (700) before release.
- **G3 / D1 (identity source — `recorded-open`, upstream owner):** the plan consumes
  `auth.session.resolve` → `{ isResident, householdRef }`. **LA-500-3:** an upstream session yields
  resident status and a household reference; the identity mechanism itself is not built here (Security
  900 enforces the gate).
- **G2 (cancellation/release — `recorded-open`, do not design):** out of scope; no release transition
  in this plan. If reopened, the atomic-claim mechanism (ADR-001) must be extended with a free-slot
  transition and its own concurrency handling — flagged, not built.
- **EU personal-data acceptance (Security-owned):** storing a `householdRef` on a slot is EU personal
  data. Flagged (R4, T16); acceptable handling/retention is Security (900)'s decision, not made here.

### Labelled assumptions made by Engineering
- **LA-500-1:** Option A (store-level atomic conditional claim) is assumed the chosen mechanism,
  pending GATE-ARCH-1. Not human sign-off.
- **LA-500-2:** slot identity is `(day, slotKey)` and the grid is configuration/data; exact grid and
  key format finalised by G1 owner + Data (700).
- **LA-500-3:** upstream session provides `isResident` and a server-derivable `householdRef`; consumed,
  not built.
- **LA-500-4:** `claimSlot` returns the four-way discriminated result above so the app maps three
  outcomes without a follow-up read on the happy/refusal winner path; Data (700) implements this
  contract on the chosen store.

## Done-when check
Infra/Ops (800) can see one app + one store, no paid idle services, local-only verification. Security
(900) can see the residency gate, server-derived household, and the log-exclusion hook. QA (600) can
see the 19-case test-approach table with AC-4 (T13/T14) as the priority concurrency proof. Schema is
left to Data (700); the concurrency mechanism is not redefined here.
