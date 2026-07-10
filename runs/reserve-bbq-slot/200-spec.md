# Feature Spec — Reserve the shared BBQ zone

**Station:** 200 Product / BA (source: `fallback`)
**Feature slug:** `reserve-bbq-slot`
**Reads:** `runs/reserve-bbq-slot/100-opportunity-brief.md`
**Writes:** `runs/reserve-bbq-slot/200-spec.md`

## Summary

Signed-in residents of the building share a single BBQ zone. This slice replaces the
uncoordinated paper sheet + spreadsheet with one authoritative record so residents can
view which time slots are free for a day and reserve a free slot, with a guarantee that
no slot is ever double-booked. The single measurable outcome from the brief is **zero
double-booked slots**: for any slot, at most one household ever holds it, and concurrent
attempts on the same free slot resolve to exactly one success.

## User stories

- **US-1 — View availability for a day.**
  As a signed-in resident, I want to see which BBQ slots are free vs. taken for a given
  day, so that I know when I can book. (Traces: brief "One measurable outcome — real-time
  view", Current pain "no authoritative, real-time view".)

- **US-2 — Reserve a free slot.**
  As a signed-in resident, I want to reserve a free slot for a day, so that my household
  authoritatively holds it and it shows as taken to everyone else. (Traces: Target users —
  primary; Constraints — "a confirmed reservation must be authoritative".)

- **US-3 — Conflict-free reservation under concurrency.**
  As a resident, I want the system to guarantee that when two of us try to grab the same
  free slot at the same time, exactly one of us wins and the other is clearly refused, so
  that we never both believe we hold Saturday. (Traces: Constraints — "concurrency safety";
  One measurable outcome — "concurrent attempts... resolve to exactly one success".)

- **US-4 — Resident-only access.**
  As the building, I want only signed-in residents to view or reserve slots, so that access
  to the shared zone is restricted to the building's residents. (Traces: Constraints —
  "only a signed-in resident... may view or reserve".)

## In scope

- View availability (free vs. taken) for the shared BBQ zone for a selected day.
- Reserve a single free slot for the signed-in resident's household.
- Enforce one household per slot (no double-booking), including under concurrent attempts.
- Restrict all view/reserve actions to signed-in residents.
- Show a slot as taken once reserved; never alter an existing reservation by a later
  refused attempt.

## Out of scope (this slice)

- Cancelling, changing, releasing, or rescheduling a reservation (see G2).
- Defining or building the sign-in / identity mechanism and the definition of "resident"
  (see G3; assumed to exist per brief A3).
- More than one BBQ zone (brief A1: exactly one zone).
- Scheduling optimisation, pricing, penalties, waitlists, no-show handling, or capacity
  beyond one household per slot (brief A4).
- Notifications, reminders, or approval workflows.
- Historical reporting / analytics on bookings.

## Acceptance criteria

Gherkin-style, derived so QA can turn each directly into a test. Slot vocabulary uses the
labelled assumption **PA1** below; the concrete slot grid is a G1 human-gate decision.

### AC-1 — View availability (US-1)
```
Given I am a signed-in resident
When I open availability for a given day
Then I see each predefined slot for that day marked as either "free" or "taken"
And a slot already held by any household is shown as "taken"
```

### AC-2 — Reserve a free slot (US-2)
```
Given I am a signed-in resident
And a slot for the day is "free"
When I reserve that slot
Then the reservation is confirmed to me
And the slot becomes "taken" for all residents
And my household is recorded as the holder of that slot
```

### AC-3 — Cannot reserve a taken slot (US-2, US-3)
```
Given I am a signed-in resident
And a slot is already "taken" by another household
When I attempt to reserve that slot
Then my attempt is refused with a clear "already taken" message
And the existing reservation is unchanged (the original holder still holds it)
```

### AC-4 — Concurrent attempts on the same free slot resolve to exactly one winner (US-3)
```
Given a slot is "free"
And two signed-in residents attempt to reserve that same slot at the same time
When both attempts are processed
Then exactly one attempt succeeds and the slot becomes "taken" for that household
And the other attempt is refused with a clear "already taken" message
And the slot is never held by two households
```
Note: this is the load-bearing no-double-booking AC. Exactly-one-winner must hold as an
invariant, not a best effort. The mechanism (e.g. atomic claim / unique constraint /
locking) is an Architecture/Data concern, not decided here; the *observable* guarantee is
specified above so QA can test it (e.g. by simulating simultaneous claims).

### AC-5 — A confirmed reservation is authoritative and immutable to refused attempts (US-2, US-3)
```
Given a slot is "taken" by household A
When any later reserve attempt on that slot is refused
Then household A's reservation is never altered, downgraded, or reassigned by that refusal
```

### AC-6 — Only signed-in residents may view or reserve (US-4)
```
Given a user is not a signed-in resident
When they attempt to view availability or reserve a slot
Then the action is refused / not available
And no reservation is created
```
Note: the definition of "signed-in resident" and how it is established is out of scope
(G3 / brief A3). This AC tests only that the view/reserve actions are gated on that status
being true.

## Non-functional constraints (NFRs)

- **NFR-1 (Correctness / concurrency):** No-double-booking is a hard invariant. Under
  simultaneous claims on one free slot, exactly one succeeds; the outcome must be
  deterministic and durable (a confirmed hold survives concurrent contention). This is the
  primary success measure from the brief and takes precedence over convenience features.
- **NFR-2 (Authoritative single source of truth):** There is one authoritative record of
  who holds each slot, replacing the paper + spreadsheet split. Availability shown reflects
  that record (no stale "free" shown for a slot that is actually taken beyond normal
  refresh).
- **NFR-3 (Access restriction):** View and reserve are available only to signed-in
  residents; unauthenticated/non-resident access is refused.
- **NFR-4 (Integrity of confirmed reservations):** A confirmed reservation is never
  silently altered or lost as a side effect of a refused later attempt.

Performance, availability targets, and refresh cadence are not quantified in the brief and
are not invented here; they are left for Architecture/Ops to size (dependency below).

## Traceability to the opportunity brief

| Spec item | Brief source |
|-----------|--------------|
| US-1, AC-1 | "no authoritative, real-time view"; measurable outcome (real-time view) |
| US-2, AC-2 | Target users (primary); Constraints ("reservation must be authoritative") |
| US-3, AC-4, NFR-1 | "Concurrency safety... exactly one winner, never both"; measurable outcome |
| AC-3, AC-5, NFR-4 | "existing reservation is never altered by a later refused attempt" |
| US-4, AC-6, NFR-3 | "Only a signed-in resident... may view or reserve" |
| NFR-2 | "no single source of truth"; two-parallel-records pain |
| One BBQ zone | Brief A1 |
| Slot = discrete predefined times | Brief A2 → spec assumption PA1 |
| Out of scope (optimisation/pricing/penalties) | Brief A4 |

## Dependencies

- **D1 — Identity / sign-in:** relies on an upstream mechanism to establish "signed-in
  resident" (brief A3 / G3). This spec consumes that status; it does not define it.
- **D2 — Slot grid definition:** ACs reference "predefined slots per day"; the concrete
  grid (duration, count, bookable window) must be provided before ACs are fully
  parameterised (G1 / PA1).
- **D3 — Concurrency mechanism (downstream):** Architecture + Data stations must supply the
  atomic-claim mechanism that makes AC-4 / NFR-1 hold. Named here as a required capability,
  not designed here.

## Labelled assumptions carried forward

- **PA1 (slot vocabulary, from brief A2 — labelled, minimal):** For writing testable ACs,
  a "slot" is treated as a discrete, predefined time block on a given day, and a day
  exposes a fixed set of such slots. The spec deliberately does **not** fix the duration,
  the number of slots per day, or the bookable day/hour window — those remain the G1
  owner decision. ACs are written to hold for whatever concrete grid G1 defines.
- **PA2 (household as holder unit, from brief measurable outcome):** The unit that "holds"
  a slot is a household (the brief measures "at most one household ever holds it"). Mapping
  a signed-in resident to a household is assumed available via the identity source (D1);
  not defined here.

## Open questions / human gates

Carried forward from the brief; none block writing this core-slice spec, but each must be
owned before the slice is treated as buildable/releasable.

- **G1 (scope — slot definition — recorded-open):** Duration, number of slots per day, and
  the bookable day/hour window are undefined. Owner must supply the concrete slot grid so
  AC-1..AC-6 can be parameterised. Assumption PA1 lets Design and QA proceed structurally;
  the actual grid is an owner decision, not decided here.
- **G2 (scope / priority — cancellation — recorded-open):** The brief does not mention
  cancel/change/release. This spec places cancellation **out of scope** for this slice as
  the smallest safe reading, but "can a held slot ever be freed again?" is a
  priority/scope decision for the human owner. If cancellation must be in this slice, this
  spec expands (new stories + freeing-a-slot concurrency ACs). **Flagged for owner
  approval before scope is locked.**
- **G3 (definition owned upstream — resident / sign-in — recorded-open):** How "resident of
  the building" is established and where sign-in comes from is assumed (D1 / brief A3), not
  defined. AC-6 tests only the gate, not the identity mechanism. Owner must confirm the
  identity source before the access constraint is treated as fully buildable.

## Handoff note for Design (Station 300)

- Design the flows/states for: viewing a day's availability, and reserving a free slot,
  for a signed-in resident.
- Key states per slot: **free**, **taken (mine)**, **taken (other)**; plus the transient
  **reserving** state and the **refused / already-taken** outcome (drives AC-3, AC-4).
- The critical UX moment is the **lost-the-race** case (AC-4): when a resident's attempt is
  refused because someone else just took the slot, the screen must update to "taken" and
  give a clear, non-blaming message. Design this explicitly.
- Treat the slot grid as parameterised (PA1 / G1): the day view should render whatever
  fixed set of slots is configured, not a hard-coded schedule.
- Do **not** design cancellation flows (G2 out of scope) unless the owner reopens G2.
- Do **not** design sign-in / registration screens (G3 / D1 upstream); assume the resident
  is already signed in when they reach these flows.
