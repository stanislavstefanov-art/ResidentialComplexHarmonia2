# Design — Reserve the shared BBQ zone

**Station:** 300 Design (source: `fallback`)
**Feature slug:** `reserve-bbq-slot`
**Reads:** `runs/reserve-bbq-slot/200-spec.md`
**Writes:** `runs/reserve-bbq-slot/300-design.md`

## Purpose of this document

Give Architecture the user-facing flow and give Engineering the observable UI/API behaviour
for the two in-scope actions: **view a day's availability** and **reserve a free slot**, for
a signed-in resident on a phone. The design makes the no-double-booking refusal (AC-3) and
the lost-the-race outcome (AC-4) explicit, because that is where correctness is felt by a
real person.

## Audience & platform constraints (design-shaping)

- **Who:** a non-technical resident. No training, no manual, no onboarding tour. The screen
  must be self-explanatory on first use.
- **Where:** a phone, one-handed, possibly outdoors near the BBQ zone, possibly on flaky
  signal. Single-column layout, thumb-reachable primary actions, large tap targets.
- **Trust:** the whole point is replacing an untrustworthy paper sheet. Every screen must
  make the current truth obvious ("is Saturday 6pm mine, taken, or free?") and must never
  show a stale "free" as if it were bookable without confirming at reserve time.
- **Assume already signed in** (G3 / D1). This design starts *after* sign-in and does not
  draw sign-in, registration, or "who is a resident" screens.

## User journey (happy path)

1. Resident opens the BBQ feature (already signed in). Lands on the **Day Availability**
   screen for a default day.
2. Resident scans the slot list and sees each slot as **Free**, **Taken (mine)**, or
   **Taken (someone else)**. They may change the day to look ahead.
3. Resident taps a **Free** slot's **Reserve** action.
4. A short **Confirm** step states plainly which slot they are about to hold ("Reserve
   Saturday 12 Jul, 6:00–8:00 PM?").
5. Resident confirms. The slot shows a transient **Reserving…** state.
6. On success: slot flips to **Taken (mine)** and a clear **confirmation** is shown ("This
   slot is yours."). The resident is back on the day view with their slot visibly held.

### Alternate / refused journeys

- **A. Slot already taken when they arrive** — the Reserve action is not offered on a
  Taken slot at all; the slot is visibly labelled and non-interactive for reserve.
- **B. Lost the race (AC-4, the critical moment)** — resident tapped Reserve on a slot that
  *looked* free, but another household confirmed it first (or simultaneously). At confirm
  time the system refuses. The screen shows a calm, non-blaming **"Just taken"** outcome,
  the slot updates to **Taken (someone else)**, and the resident is invited to pick another
  free slot. No error tone, no blame, no dead end.
- **C. Not available / lost access** — if the session is not (or is no longer) a signed-in
  resident, view/reserve is refused (AC-6). Design shows a plain "please sign in" state and
  hands off to the upstream sign-in mechanism (not drawn here).
- **D. Can't load / lost connection** — the day view can't be fetched or a reserve can't be
  confirmed either way. Show a retryable state that never fabricates a result.

## Screen & state inventory

Two screens (Day Availability, Confirm Reservation) plus a set of states that overlay them.
Counted below as discrete states Engineering must implement.

### Screen 1 — Day Availability (the home of this feature)

| # | State | When shown | What the resident sees | Primary action |
|---|-------|-----------|------------------------|----------------|
| S1 | **Loading day** | While the day's slots are being fetched | Day header + skeleton/"Checking availability…" | none (wait) |
| S2 | **Day loaded — has free slots** | Slots fetched, ≥1 free | List of every configured slot for the day, each tagged Free / Taken (mine) / Taken (other) | Reserve on a Free slot; change day |
| S3 | **Day loaded — fully booked (empty of free)** | Slots fetched, 0 free | Same list, all Taken; a gentle "No free slots this day — try another day." | Change day |
| S4 | **Day has no slots configured** | Grid yields zero slots for that day (e.g. outside bookable window per G1) | "No BBQ slots on this day." | Change day |
| S5 | **Can't load day (error)** | Fetch failed | "Couldn't load availability. Check your connection." + Retry | Retry; change day |
| S6 | **Not available (access refused)** | Not a signed-in resident (AC-6) | "You need to be a signed-in resident to view BBQ slots." | Go to sign-in (upstream) |

Per-slot visual states within S2/S3 (the slot is the real unit residents read):

| # | Slot state | Meaning | Interaction |
|---|-----------|---------|-------------|
| SL1 | **Free** | Bookable now | Reserve button enabled |
| SL2 | **Taken (mine)** | This household holds it | Labelled "Yours"; no reserve; no cancel (G2 out of scope) |
| SL3 | **Taken (someone else)** | Another household holds it (AC-3) | Labelled "Taken"; reserve not offered |
| SL4 | **Reserving…** | This resident's confirm is in flight (transient) | Slot locked, spinner/"Reserving…"; no double-tap |

### Screen 2 — Confirm Reservation (lightweight step, prevents mis-taps)

| # | State | When shown | What the resident sees | Primary action |
|---|-------|-----------|------------------------|----------------|
| C1 | **Confirm** | Resident tapped Reserve on a Free slot | Plain-language restatement of exactly which slot + day + time; "Reserve" / "Not now" | Confirm reserve; cancel back |
| C2 | **Reserving… (submitting)** | After confirm, awaiting result | "Reserving…" with the action disabled | none (wait) |
| C3 | **Reserved — success** | Claim succeeded (AC-2) | "Done — this slot is yours." + which slot | Back to day (slot now Taken-mine) |
| C4 | **Just taken — refused (AC-3 / AC-4)** | Claim refused because slot is already held by another household | "Sorry, this slot was just taken by another household." Non-blaming. Slot shown as now Taken. | See other free slots (back to day, refreshed) |
| C5 | **Couldn't confirm (error)** | Reserve request failed with unknown result | "We couldn't confirm your reservation. Check the day view to see if it went through." + go to day | Return to day (which re-reads the source of truth) |

**Total: 15 discrete states** (6 screen states S1–S6 + 4 per-slot states SL1–SL4 + 5 confirm
states C1–C5).

## The no-double-booking refusal, surfaced to a resident (load-bearing)

This is the design promise behind AC-3 / AC-4 / NFR-1. Two failure shapes, one calm message
family:

- **Already visibly taken (AC-3):** a slot held by another household is never shown with a
  Reserve action. The resident cannot even start reserving it, so there is no failure to
  explain — prevention over apology.
- **Lost the race (AC-4):** the slot looked Free, the resident tapped Reserve and Confirm,
  but another household won. This is the moment that must not feel like the old paper sheet
  (two people both think they have Saturday). Design rules:
  - The outcome is **decided by the system, never by the client optimistically**. The UI
    shows **Reserving…**, then either **Reserved (yours)** or **Just taken (theirs)** — it
    never shows "yours" before the system confirms. This is what keeps the screen honest and
    prevents two residents both seeing success. (Mechanism is Architecture/Data per D3; the
    UI contract is: *no success state without a confirmed claim*.)
  - The refusal copy is **non-blaming and specific**: "Sorry, this slot was just taken by
    another household." Not "Error", not "Conflict", not a code.
  - The screen **self-corrects**: on refusal the slot immediately updates to Taken and the
    resident is dropped back onto the day view showing the remaining Free slots, so the next
    action is obvious. Refusal is a redirect to alternatives, not a dead end.
  - **Immutability is invisible but guaranteed (AC-5 / NFR-4):** the winning household's held
    slot is never disturbed by a later refused attempt. Design consequence: a refused attempt
    only ever *reads* newer truth; it never mutates or "downgrades" the existing holder's
    slot in the UI.

## Content requirements (plain-language, non-technical copy)

Design intent, not final regulated copy (see G-DESIGN-1). All copy avoids jargon
("conflict", "lock", "atomic", "409") and blame.

| Context | Message intent |
|---------|----------------|
| Free slot label | "Free" |
| Own held slot | "Yours" |
| Other household's slot | "Taken" |
| Confirm prompt | "Reserve [day], [time]?" |
| Success | "Done — this slot is yours." |
| Lost-the-race refusal | "Sorry, this slot was just taken by another household. Here are the slots still free." |
| Fully booked day | "No free slots this day — try another day." |
| No slots configured | "No BBQ slots on this day." |
| Load error | "Couldn't load availability. Check your connection and try again." |
| Reserve unknown-result | "We couldn't confirm. Check the day view to see if your reservation went through." |
| Access refused | "You need to be a signed-in resident to view or reserve BBQ slots." |

## Accessibility checks

- **Do not rely on colour alone** for Free vs Taken vs Yours — pair colour with a text label
  and/or icon. (Residents may be colour-blind or in bright outdoor light.)
- **Tap targets** for Reserve and Confirm meet a comfortable one-handed minimum; Taken slots
  are clearly non-interactive so no one taps expecting to book.
- **Slot list is a readable list**, screen-reader friendly: each row announces day, time, and
  state ("Saturday 6 to 8 PM, taken"). The critical Reserve action is reachable and labelled.
- **Refusal and success outcomes are announced**, not only shown, so a screen-reader user
  learns they lost the race or won it.
- **No time-pressure UI trap:** the Reserving… state must resolve to a definite outcome; the
  resident is never left unsure whether they hold the slot (ties to NFR-2 trust).
- Copy is short, literal, and readable at a glance for low digital literacy.

## Handoff to Architecture & Engineering (observable behaviour)

- Two surfaces: **read availability for a day** (returns the configured slot set with per-slot
  state derived from the authoritative record) and **reserve a specific slot**.
- The reserve surface must return one of three **resident-observable outcomes**:
  **confirmed-yours**, **refused-already-taken**, or **couldn't-confirm** — the UI has a state
  for each (C3 / C4 / C5). Engineering must not let the client decide success.
- The day view must render **whatever slot grid is configured** (PA1), not a hard-coded
  schedule; count and window come from G1.
- A refused reserve must never alter the existing holder's slot (AC-5 / NFR-4) — the UI relies
  on this to safely re-read and redisplay Taken.
- Design does **not** specify the concurrency mechanism (D3) — only that the observable
  outcome is exactly-one-winner and the loser sees the non-blaming "just taken" state.

## Scope boundaries honoured

- **No cancellation flow designed** (G2 out of scope). "Taken (mine)" therefore has **no**
  cancel/change/release affordance. If the owner reopens G2, this design must add: a release
  action, a freed-slot state, and the freed-slot concurrency copy — flagged, not built.
- **No sign-in / registration screens** (G3 / D1). "Not a signed-in resident" hands off to
  the upstream mechanism; the "please sign in" state is a boundary, not an implementation.
- **One BBQ zone only** — no zone picker (brief A1).

## Open questions / human gates

Design resolved what it could as labelled assumptions below and escalated only the decisions
that need a human owner.

- **G-DESIGN-1 (regulated / final copy — recorded-open, needs owner):** The refusal, access,
  and confirmation strings above are design intent, not approved final copy. If the building
  has house rules or a fair-use/no-blame policy about who may book and what refusal wording is
  allowed, an owner must approve the wording. Blocks final content, not the flow.
- **G1 carried forward (slot grid — recorded-open, upstream owner):** The day view is designed
  to render a parameterised slot set (PA1). The concrete count, duration, and bookable window
  are still an owner decision (G1) and affect how the list looks when long (e.g. scrolling,
  grouping). Design assumes a scrollable single-column list; if the real grid is large, an
  owner may want day/part-of-day grouping. Escalated as an open layout question.
- **G2 carried forward (cancellation — recorded-open, do not design):** Respected as out of
  scope. Recorded so that "Yours" having no exit is a deliberate design decision, not an
  oversight, and reopens cleanly if the owner puts cancellation in scope.
- **G3 carried forward (identity source — recorded-open, upstream owner):** The "signed-in
  resident" boundary and the household-of-a-resident mapping (PA2) are consumed, not designed.

## Labelled assumptions made by Design

- **DA1 (default day):** The Day Availability screen opens on a sensible default day (assume
  "today", or the first day inside the bookable window if today is outside it). Minimal, safe;
  refine once G1 fixes the window.
- **DA2 (confirm step exists):** A lightweight Confirm step (Screen 2) is inserted before a
  claim to prevent accidental one-tap bookings on a phone and to give the lost-the-race
  refusal a natural place to surface. This is a design choice, reversible if the owner prefers
  one-tap booking.
- **DA3 (no optimistic success):** The UI never shows "yours" until the system confirms the
  claim. This directly protects the zero-double-booking outcome at the presentation layer and
  is treated as a hard design rule, not a preference.
- **DA4 (auto-refresh on refusal):** On a lost-the-race refusal, the day view is re-read from
  the authoritative record so the resident sees current truth immediately (supports NFR-2).
