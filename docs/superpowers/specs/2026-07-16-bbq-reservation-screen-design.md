# BBQ Reservation Screen — Design Spec

**Date:** 2026-07-16  
**Run:** 20260716-1722-master

---

## Goal

A resident selects a date, sees BBQ slot availability, and claims a free slot — implemented to the same feature parity in both Angular (PrimeNG 22) and React (MUI).

---

## Architecture

Three-layer separation matches the existing directory feature:

- **Service / API layer:** thin fetch/HTTP wrapper; translates raw JSON to typed models
- **Component / UI layer:** reactive state via Angular signals or React hooks; no business logic
- **No identity in the request body:** claim calls POST with day + slotKey only; session identity is server-side (R2)

---

## Wire Contract

```
GET  /days/{day}/slots
     → 200: { day: "yyyy-MM-dd", slots: [{ slotKey: string, state: "free"|"taken-mine"|"taken-other" }] }
     → 401: Unauthorized
     → 500: Internal error

POST /days/{day}/slots/{slotKey}/claim
     → 200: { outcome: "confirmed-yours" }
     → 409: { outcome: "refused-already-taken" }
     → 503: { outcome: "couldnt-confirm" }
     → 401: Unauthorized, 404: Unknown slot
```

---

## Angular Implementation

### Files

| File | Action | Purpose |
|---|---|---|
| `src/app/reservations/models.ts` | Create | TS types: `Slot`, `DaySlotsResponse`, `ClaimResponse` |
| `src/app/reservations/reservations.service.ts` | Create | HttpClient service: `getSlots(day)`, `claimSlot(day, slotKey)` |
| `src/app/reservations/reservations.component.ts` | Create | Standalone component with date picker, slot grid, claim flow |
| `src/app/reservations/reservations.component.spec.ts` | Create | Jasmine-style specs with TestBed |
| `src/app/app.routes.ts` | Modify | Add `{ path: 'reservations', component: ReservationsComponent }` |
| `src/app/app.ts` | Modify | Add nav bar with `RouterLink` to `/directory` and `/reservations` |
| `package.json` | Modify | Add jest-preset-angular devDependencies |
| `jest.config.ts` | Create | Jest configuration |
| `tsconfig.spec.json` | Create | TypeScript config for specs |

### Component Design

```
ReservationsComponent
  ├── header (Harmonia nav bar)
  ├── p-card
  │   ├── p-datepicker (ngModel: selectedDay, minDate: today, dateFormat: yy-mm-dd)
  │   ├── loading spinner (p-progressbar or p-skeleton) while fetching
  │   ├── error state + Retry button (signal: error)
  │   └── slot grid (ngFor on slots signal)
  │       └── slot-card [free | taken-mine | taken-other]
  │           └── [Claim] button (only on free slots)
  └── p-toast (claim feedback)
```

**State signals:**
```typescript
slots = signal<Slot[]>([]);
loading = signal(false);
error = signal<string | null>(null);
claimInFlight = signal<string | null>(null); // slotKey being claimed
selectedDay = signal<Date>(new Date());
```

**Slot visual:**
- `free` → green badge, "Claim" button enabled
- `taken-mine` → blue badge, "Yours" label, no button
- `taken-other` → grey badge, "Taken" label, no button

**Claim outcome handling:**
- `confirmed-yours` (200) → toast success + slot flips to `taken-mine`
- `refused-already-taken` (409) → toast warning + slot flips to `taken-other`
- `couldnt-confirm` (503) → toast error "Could not confirm booking. Please try again."

**Date change:** triggers new `getSlots` call; `selectedDay` defaults to today; dates before today are disabled via `minDate`.

### Test Plan (Angular)

1. Renders slot grid from mocked HTTP response
2. Claim button calls POST and slot flips to `taken-mine` on success
3. Conflict (409) flips slot to `taken-other` and shows warning toast
4. HTTP error shows error state with Retry button

---

## React Implementation

### Files

| File | Action | Purpose |
|---|---|---|
| `src/types/index.ts` | Modify | Add `Slot`, `DaySlotsResponse`, `ClaimResponse` types |
| `src/api/reservations.ts` | Create | Fetch-based API: `getSlots(day)`, `claimSlot(day, slotKey)` |
| `src/components/ReservationScreen.tsx` | Create | Main screen with date input, slot grid, claim flow |
| `src/components/ReservationScreen.test.tsx` | Create | RTL tests |
| `src/App.tsx` | Modify | Add MUI `Tabs` in AppBar for Directory / Reservations screens |

### Component Design

```
ReservationScreen
  ├── TextField type="date" (value: day, inputProps: {min: today})
  ├── CircularProgress (while loading)
  ├── Alert severity="error" + Retry button (on API error)
  └── slot grid (CSS grid, 2–4 columns)
      └── Card per slot [free | taken-mine | taken-other]
          ├── Chip (color coded)
          └── Button "Claim" (only if free, disabled while claimInFlight)
```

**State:**
```typescript
const [slots, setSlots] = useState<Slot[]>([]);
const [loading, setLoading] = useState(false);
const [error, setError] = useState<string | null>(null);
const [claimInFlight, setClaimInFlight] = useState<string | null>(null);
const [day, setDay] = useState<string>(todayString());
const [feedback, setFeedback] = useState<{msg: string; severity: 'success'|'warning'|'error'} | null>(null);
```

**Claim outcome handling:**
- `confirmed-yours` (200) → green `Alert` / `Snackbar` + slot flips
- `refused-already-taken` (409) → warning `Alert` + slot flips to `taken-other`
- `couldnt-confirm` (503) → error `Alert` "Could not confirm booking. Please try again."

**Navigation:** `App.tsx` gains MUI `Tabs` below the Toolbar row (or inline), switching `screen` state between `'directory'` and `'reservations'`. Role toggle stays visible only on directory screen.

### Test Plan (React)

1. Renders slot cards from mocked `getSlots`
2. Clicking Claim calls `claimSlot` and renders success feedback
3. 409 response renders warning and flips slot state
4. Network error renders error alert with Retry button

---

## Out of Scope

- Admin view for reservations
- Slot creation / management
- Push notifications for reservation confirmations
- Pagination of slots (backend returns all slots for a day)
- Past-date slot viewing
