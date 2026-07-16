# Financial Summary Screen — Design Spec

**Date**: 2026-07-16  
**Run**: 20260716-1851-master  
**Status**: approved (autonomous)

---

## Scope Correction (backend contract differs from task description)

The task description assumed a fictional `GET /financial-summary` returning `{ balance, charges, payments }`. The actual backend:

| Endpoint | Auth | Returns |
|---|---|---|
| `GET /financial-summary?period=YYYY-MM` | resident + admin | `{ Period, TotalChargesEur, TotalExpensesEur }` |
| `GET /maintenance-fees/charges` | resident (session) | `ChargeDto[]` — resident's own charges |
| `GET /payments` | resident (session) | `PaymentDto[]` — resident's own payments |
| `POST /payments` | **admin only** | not accessible from resident UI |

The design uses the three resident-accessible endpoints. The "Pay" button becomes a clearly-labelled stub that opens a dialog explaining that payments are recorded by the building administrator — no API call is made.

---

## Screen: FinancialSummaryScreen

### Layout

```
[ Period Summary Card ]
  Period picker: YYYY-MM (default: current month)
  Total charges this period:  €NNN
  Total expenses this period: €NNN

[ My Charges table ]
  Date | Description | Period | Amount
  (row per charge, sorted newest first)

[ My Payments table ]
  Date | Period | Amount
  (row per payment, sorted newest first)

[ Pay button — disabled stub ]
  "Request Payment" button opens Alert dialog:
  "Payments are recorded by the building administrator.
   Contact the office to register a payment."
```

### Data loading

- On mount: fire all three GET calls in parallel
- Period summary re-fetches when the period picker changes
- Loading spinners per section (not a full-page spinner)
- Per-section error + Retry button

### Currency formatting

Use `Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' })` in both Angular and React. Values come as `decimal` (number in JSON).

---

## Angular implementation (`ui/angular-prototype/src/app/financial/`)

### Files

| File | Role |
|---|---|
| `financial.service.ts` | `inject(HttpClient)` — `getPeriodSummary(period)`, `getMyCharges()`, `getMyPayments()` |
| `financial.component.ts` | Standalone, signals for state, `@for`/`@if` control flow |
| `financial.component.spec.ts` | 4 tests (render charges+payments, period change re-fetch, pay stub dialog) |
| `models.ts` | `ChargeDto`, `PaymentDto`, `PeriodSummaryDto` type aliases |

### Angular component signals

```typescript
readonly summary   = signal<PeriodSummaryDto | null>(null);
readonly charges   = signal<ChargeDto[]>([]);
readonly payments  = signal<PaymentDto[]>([]);
readonly loading   = signal(true);
readonly error     = signal<string | null>(null);
readonly period    = signal(currentMonth());   // 'YYYY-MM'
readonly showPayDialog = signal(false);
```

### PrimeNG imports

`TableModule`, `CardModule`, `ButtonModule`, `InputTextModule`, `DialogModule`, `ProgressSpinnerModule`, `ToastModule`, `TagModule`

### Navigation

Add `/financial` route to `app.routes.ts`. Add "Finance" nav link to `directory-list.component.ts` header (alongside existing Directory / Reservations links).

---

## React implementation (`ui/react-prototype/src/`)

### Files

| File | Role |
|---|---|
| `api/financial.ts` | `getPeriodSummary(period)`, `getMyCharges()`, `getMyPayments()` — `fetch` wrappers |
| `api/financial.test.ts` | 3 tests — URL correctness |
| `components/FinancialScreen.tsx` | `useState` + `useEffect`, MUI `Table`, `Card`, `Dialog` |
| `components/FinancialScreen.test.tsx` | 4 tests |

### React state

```typescript
const [period, setPeriod] = useState(currentMonth());
const [summary, setSummary] = useState<PeriodSummaryDto | null>(null);
const [charges, setCharges] = useState<ChargeDto[]>([]);
const [payments, setPayments] = useState<PaymentDto[]>([]);
const [loading, setLoading] = useState(true);
const [error, setError] = useState<string | null>(null);
const [showPayDialog, setShowPayDialog] = useState(false);
```

### MUI components

`Table`/`TableHead`/`TableRow`/`TableCell`/`TableBody`, `Card`/`CardContent`, `CircularProgress`, `Alert`, `Button`, `Dialog`/`DialogTitle`/`DialogContent`/`DialogActions`, `Typography`, native `<input type="month">` for period picker.

### Navigation

Add `'financial'` to the `Screen` union in `App.tsx`. Add "Finance" `<Tab>` to the `<Tabs>` bar.

---

## Wire contract (confirmed from backend source)

### `GET /financial-summary?period=YYYY-MM`
```
→ 200: { "Period": "2026-07", "TotalChargesEur": 450.00, "TotalExpensesEur": 1230.50 }
→ 400: "Period must be in YYYY-MM format."
→ 403: (not resident or admin)
→ 500
```

### `GET /maintenance-fees/charges`
```
→ 200: [{ "Id": "uuid", "HouseholdRef": "...", "AmountEur": 150.00, "Description": "July fee",
          "Period": "2026-07", "ChargedAt": "2026-07-01T00:00:00Z", "IdempotencyKey": "..." }]
→ 403
→ 500
```

### `GET /payments`
```
→ 200: [{ "Id": "uuid", "HouseholdRef": "...", "AmountEur": 300.00, "Period": "2026-06",
          "DateReceived": "2026-06-15", "RecordedAt": "2026-06-15T09:00:00Z", "IdempotencyKey": "..." }]
→ 403
→ 500
```

---

## Security constraints

- **R2**: All three endpoints derive the household from the session; the UI sends no HouseholdRef in any request body or header.
- **R3**: `AmountEur`, `HouseholdRef`, `Description` are personal data — never in console.log or logger calls in the UI layer.
- `POST /payments` is not called from the resident UI. The Pay button is a stub dialog.

---

## Tests

### Angular (vitest via `@angular/build:unit-test`)

1. Renders period summary card with TotalChargesEur and TotalExpensesEur
2. Renders charge rows from mock service
3. Renders payment rows from mock service
4. Pay button opens stub dialog

### React (Jest via react-scripts)

**API tests (3):**
1. `getPeriodSummary` calls correct URL
2. `getMyCharges` calls correct URL
3. `getMyPayments` calls correct URL

**Component tests (4):**
1. Renders summary card with formatted amounts
2. Renders charge rows
3. Renders payment rows
4. Pay button shows dialog

---

## Out of scope

- Resident-initiated payment (no R2-compliant backend endpoint exists)
- Admin financial views (separate admin screen, not part of this slice)
- Pagination (all charges/payments returned in one call for the prototype)
- Period-filtered charges/payments (backend charges/payments endpoints don't filter by period yet)
