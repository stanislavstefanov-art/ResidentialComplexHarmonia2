# Opportunity Brief — Reserve the shared BBQ zone

**Station:** 100 Consulting / SME (source: `fallback`)
**Feature slug:** `reserve-bbq-slot`
**Input:** `runs/reserve-bbq-slot/feature.md`

## Business trigger
Residents of the building share a single BBQ zone. Today it is booked on a paper sheet
by the entrance plus a shared spreadsheet. These two uncoordinated records let the same
slot be claimed twice, producing double-bookings and "we both thought we had Saturday"
disputes. The trigger is the recurring conflict and the goodwill it costs between
neighbours — there is no single source of truth for who holds a slot.

## Target users
- **Primary:** A signed-in resident of the building who wants to see availability and
  reserve a time slot for the shared BBQ zone.
- **Implied stakeholder:** Whoever manages resident sign-in / who counts as "a resident of
  the building" (definition owned upstream — see open questions).

## Current pain
- Two parallel records (paper sheet + spreadsheet) that disagree with each other.
- Double-bookings: the same slot ends up held by two households.
- Disputes and lost trust when both households believe they had the slot.
- No authoritative, real-time view of which slots are free versus taken.

## One measurable outcome
Zero double-booked slots: for any given slot, at most one household ever holds it, and
concurrent attempts on the same free slot resolve to exactly one success. Success is
measured as the elimination of double-booking incidents that occur under the paper +
spreadsheet process.

## Constraints
- Only a signed-in resident of the building may view or reserve (access is restricted).
- A confirmed reservation must be authoritative: once taken, a slot shows as taken and an
  existing reservation is never altered by a later refused attempt.
- Concurrency safety is required — simultaneous attempts on the same free slot must yield
  exactly one winner, never both.
- Scope is one thin slice: viewing availability for a day and reserving a free slot.

## Assumptions (labelled, safe defaults for downstream stations)
- **A1:** There is exactly one shared BBQ zone in scope for this slice (the feature says
  "one BBQ zone").
- **A2:** Availability is expressed as discrete, predefined time slots per day; the feature
  refers to "slots" without defining their length or the bookable day range — treated as a
  downstream (Product/BA) detail, not a business decision.
- **A3:** "Resident of the building" and the sign-in mechanism already exist or are owned by
  an upstream identity concern; this brief does not define authentication.
- **A4:** The business goal is conflict-free booking, not scheduling optimisation, pricing,
  penalties, or capacity beyond one household per slot.

## Open questions / human gates
- **G1 (scope — recorded-open):** Slot definition (duration, how many slots per day, which
  days/hours are bookable) is unspecified. This is a Product/BA scoping detail, not a
  business-reason gap; flagged so it is defined before acceptance criteria are finalised.
- **G2 (stakeholder priority — recorded-open):** The feature does not mention
  cancellation, changing, or releasing a reservation. If a resident's plans change, is a
  held slot ever freed again? Whether cancellation is in this slice is a scope/priority
  choice for the human owner — not decided here.
- **G3 (definition owned upstream — recorded-open):** How "resident of the building" is
  established and where sign-in comes from is assumed (A3) but not stated in the feature.
  Confirm the identity source before the access constraint is treated as buildable.

None of these block the Product/BA station from writing scope for the core slice
(view availability + reserve a free slot with conflict-free, resident-only access); they are
recorded so downstream work does not invent a business reason or silently expand the slice.

## Done-when check
The Product / BA station can now write scope and acceptance criteria from a clear business
reason — conflict-free booking of one shared BBQ zone by signed-in residents — without
inventing why the feature exists.
