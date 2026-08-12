# Counterparties + Finance Screen Reorganisation — Design Spec

## Overview

Two sequential phases that each ship working software:

- **Phase 1 — Counterparties CRUD + Administration nav:** new entity, new management screen, nav restructure. Purely additive.
- **Phase 2 — Finance screen reorganisation:** Income tab (Charged/Received sub-tabs), Outcome tab with counterparty picker, tab renames, resident screen cleanup.

Phase 1 must land before Phase 2 because the bill form in Phase 2 requires counterparties to exist.

Both phases target **React (MUI 9)** and **Angular (PrimeNG 22)**.

---

## Data Model

### New table — `dbo.Counterparties`

```sql
CREATE TABLE dbo.Counterparties (
    Id             uniqueidentifier   NOT NULL,
    Name           nvarchar(256)      NOT NULL,
    Category       nvarchar(100)      NOT NULL,  -- e.g. "Electricity"
    ParentCategory nvarchar(100)      NOT NULL,  -- e.g. "Utilities"
    VatNumber      nvarchar(64)       NULL,
    Phone          nvarchar(32)       NULL,
    Email          nvarchar(320)      NULL,
    CreatedAt      datetimeoffset(3)  NOT NULL,
    UpdatedAt      datetimeoffset(3)  NOT NULL,
    CONSTRAINT PK_Counterparties PRIMARY KEY (Id)
);
```

`Category` and `ParentCategory` are free-text (admin-defined). The annual report groups expenses by these values, so admins should use them consistently (e.g. always "Utilities" not "Utility").

### Modified table — `dbo.AssociationExpenses`

Existing `Category` and `ParentCategory` columns are removed. `CounterpartyId` is added as a required FK. Because there is no production data to preserve, the migration truncates the table first:

```sql
IF COL_LENGTH('dbo.AssociationExpenses', 'CounterpartyId') IS NULL
BEGIN
    TRUNCATE TABLE dbo.AssociationExpenses;
    ALTER TABLE dbo.AssociationExpenses DROP COLUMN Category;
    ALTER TABLE dbo.AssociationExpenses DROP COLUMN ParentCategory;
    ALTER TABLE dbo.AssociationExpenses
        ADD CounterpartyId uniqueidentifier NOT NULL
        REFERENCES dbo.Counterparties(Id);
END
```

`Counterparties` must be created in `schema.sql` before this migration block.

No `ON DELETE CASCADE` — the API refuses to delete a counterparty that has bills (409 Conflict).

### Annual report impact

`GetAnnualExpensesAsync` currently reads `Category` and `ParentCategory` from `AssociationExpenses`. After the migration it JOINs `Counterparties` to get them:

```sql
SELECT c.ParentCategory, c.Category,
       MONTH(e.ExpenseDate) AS MonthNum,
       SUM(e.AmountEur)     AS Total
FROM   dbo.AssociationExpenses e
JOIN   dbo.Counterparties      c ON c.Id = e.CounterpartyId
WHERE  YEAR(e.ExpenseDate) = @Year
GROUP BY c.ParentCategory, c.Category, MONTH(e.ExpenseDate);
```

Report output is identical to today.

---

## API

### Phase 1 — Counterparty endpoints (all admin-only)

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/counterparties` | List all counterparties |
| `POST` | `/counterparties` | Create counterparty |
| `GET` | `/counterparties/{id}` | Get one |
| `PUT` | `/counterparties/{id}` | Update |
| `DELETE` | `/counterparties/{id}` | Delete — `409 Conflict` if any expense references this counterparty |

**Request body (POST / PUT):**
```json
{
  "name": "PowerCo",
  "category": "Electricity",
  "parentCategory": "Utilities",
  "vatNumber": "BG123456789",
  "phone": "+359 2 000 0000",
  "email": "billing@powercо.bg"
}
```

**Response DTO:**
```json
{
  "id": "...",
  "name": "PowerCo",
  "category": "Electricity",
  "parentCategory": "Utilities",
  "vatNumber": "BG123456789",
  "phone": "+359 2 000 0000",
  "email": "billing@powercо.bg",
  "createdAt": "...",
  "updatedAt": "..."
}
```

Follows existing layered pattern: Domain record → Application use case → `SqlCounterpartyStore` adapter → `CounterpartyEndpoints`.

### Phase 2 — Modified expense endpoints

**`POST /expenses`** — `counterpartyId` is now required; `category` and `parentCategory` are removed from the request body.

```json
{
  "counterpartyId": "...",
  "amountEur": 142.50,
  "description": "March electricity bill",
  "expenseDate": "2026-03-31",
  "idempotencyKey": "..."
}
```

**`GET /expenses`** — response now includes `counterpartyId`, `counterpartyName`, `counterpartyCategory`, `counterpartyParentCategory` (joined from Counterparties); `category` and `parentCategory` fields removed.

---

## Navigation

### Administration section (admin-only, both apps)

New top-level nav item **Administration** with three children:

- **Counterparties** ← new
- **Households** ← moved from current location
- **Pending Activations** ← moved from current location

Finance, Directory, and Reservations nav items are unchanged.

---

## Admin Finance Screen — 3 tabs

### Income tab

Two sub-tabs rendered as a secondary tab strip inside the Income tab panel:

**Charged sub-tab**
- Form at top: charge a maintenance fee to a household (existing form, unchanged)
- Table below: all `MaintenanceFeeCharges` grouped by household, columns — Household · Period · Description · Amount
- A per-household summary row (or balance column) shows Outstanding = SUM(charges) − SUM(payments) for that household
- Outstanding is household-level, not per-charge-row
- No new backend endpoint needed — existing `getAllCharges` (charge rows) + `getBalance` (per-household totals) compose client-side to produce this view

**Received sub-tab**
- Form at top: record a payment received from a household (existing form, unchanged)
- Table below: all `MaintenanceFeePayments` with columns — Household · Period · Amount · Date Received
- Recording a payment immediately changes the Outstanding column in the Charged sub-tab (both read live from the same two tables)

### Outcome tab (was Bills)

- Counterparty picker: required searchable dropdown showing Name + Category
- On counterparty selection: Category and ParentCategory auto-fill as read-only labels below the picker
- Scan invoice button: pre-fills Amount, Date, Description (vendor field → Description); counterparty must still be selected manually
- Remaining form fields: Amount · Date · Description
- Submit records the expense with `counterpartyId`
- Expenses table below: Date · Counterparty · Category · Description · Amount

### Report tab

Unchanged in structure. The annual P&L matrix now sources category groupings from `Counterparties` via the JOIN described above.

---

## Resident Finance Screen — 2 tabs

No structural change to the resident view. The current `ResidentFinancial` component already shows charges and payments. This phase makes the split explicit with two tabs:

- **Fees tab** — list of `MaintenanceFeeCharges` for this household + outstanding balance
- **Payments tab** — list of `MaintenanceFeePayments` for this household

No bills tab — residents never see bills to external counterparties.

---

## Counterparties Management Screen

Accessible via Administration → Counterparties.

- Table: Name · Category · ParentCategory · VAT · Phone · Email · Edit · Delete
- **Add counterparty** button above table opens a dialog form
- **Edit** opens same dialog pre-filled
- **Delete** shows a confirmation dialog; if API returns 409, displays: "Cannot delete — this counterparty has bills attached"
- Both add and edit use the same `CounterpartyForm` component/dialog

---

## Error handling

| Scenario | Behaviour |
|----------|-----------|
| Delete counterparty with bills | `409 Conflict` → UI shows "Cannot delete — counterparty has bills attached" |
| Submit bill without selecting counterparty | Client-side required field validation |
| Duplicate expense (idempotency key) | Existing behaviour — `200 OK` with existing record |
| Counterparty not found | `404 Not Found` |

---

## Out of scope

- Settlement linking (marking which payment covers which specific charge)
- Counterparty import / bulk upload
- Expense editing or deletion (ledger is append-only by design)
- Invoice attachment storage
