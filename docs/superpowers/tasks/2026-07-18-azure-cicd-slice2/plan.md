# Azure CI/CD Slice 2 — UI API URL Configuration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all hardcoded `http://localhost:5000` API base URLs in the React and Angular UIs with configurable values, and add `staticwebapp.config.json` SPA routing config to both UIs.

**Architecture:** React uses a single `config.ts` module exporting `API_BASE = process.env.REACT_APP_API_URL ?? 'http://localhost:5000'`; each api file imports from it. Angular uses the standard `environments/` + `fileReplacements` pattern — dev builds use `environment.ts` (localhost), prod builds use `environment.prod.ts` (empty placeholder until Slice 4 injects the real URL). No test files change; existing assertions still match because the fallback value is `http://localhost:5000`.

**Tech Stack:** React 19 / CRA (`react-scripts 5`), Angular 21 (`@angular/build:application`, vitest), TypeScript

---

## File Map

| File | Action |
|---|---|
| `ui/react-prototype/src/api/config.ts` | Create — single source of truth for React API base URL |
| `ui/react-prototype/src/api/reservations.ts` | Modify — import `API_BASE` from config |
| `ui/react-prototype/src/api/expenses.ts` | Modify — import `API_BASE` from config |
| `ui/react-prototype/src/api/financial.ts` | Modify — import `API_BASE` from config |
| `ui/react-prototype/src/api/maintenanceFees.ts` | Modify — import `API_BASE` from config |
| `ui/react-prototype/src/api/payments.ts` | Modify — import `API_BASE` from config |
| `ui/react-prototype/src/api/notifications.ts` | Modify — import `API_BASE` from config |
| `ui/react-prototype/src/api/contactEdit.ts` | Modify — import `API_BASE` from config |
| `ui/react-prototype/src/api/privacy.ts` | Modify — import `API_BASE` from config |
| `ui/react-prototype/src/api/directory.ts` | Modify — import `API_BASE` from config (uses `const API`, not `const BASE`) |
| `ui/react-prototype/staticwebapp.config.json` | Create — SPA routing fallback |
| `ui/angular-prototype/src/environments/environment.ts` | Create — dev: `apiUrl: 'http://localhost:5000'` |
| `ui/angular-prototype/src/environments/environment.prod.ts` | Create — prod: `apiUrl: ''` (placeholder) |
| `ui/angular-prototype/angular.json` | Modify — add `fileReplacements` to production config |
| `ui/angular-prototype/src/app/reservations/reservations.service.ts` | Modify — use `environment.apiUrl` |
| `ui/angular-prototype/src/app/expenses/expense.service.ts` | Modify — use `environment.apiUrl` |
| `ui/angular-prototype/src/app/financial/financial.service.ts` | Modify — use `environment.apiUrl` |
| `ui/angular-prototype/src/app/maintenance-fees/maintenance-fee.service.ts` | Modify — use `environment.apiUrl` |
| `ui/angular-prototype/src/app/payments/payment.service.ts` | Modify — use `environment.apiUrl` |
| `ui/angular-prototype/src/app/notifications/notification.service.ts` | Modify — class field `private base` → `environment.apiUrl` |
| `ui/angular-prototype/src/app/contact-edit/contact-edit.service.ts` | Modify — class field `private base` → `environment.apiUrl` |
| `ui/angular-prototype/src/app/privacy/privacy.service.ts` | Modify — class field `private base` → `environment.apiUrl` |
| `ui/angular-prototype/src/app/directory/directory.service.ts` | Modify — use `environment.apiUrl` |
| `ui/angular-prototype/staticwebapp.config.json` | Create — SPA routing fallback |

---

### Task 1: React — `config.ts` module + update all 9 api source files

**Files:**
- Create: `ui/react-prototype/src/api/config.ts`
- Modify: `ui/react-prototype/src/api/reservations.ts`
- Modify: `ui/react-prototype/src/api/expenses.ts`
- Modify: `ui/react-prototype/src/api/financial.ts`
- Modify: `ui/react-prototype/src/api/maintenanceFees.ts`
- Modify: `ui/react-prototype/src/api/payments.ts`
- Modify: `ui/react-prototype/src/api/notifications.ts`
- Modify: `ui/react-prototype/src/api/contactEdit.ts`
- Modify: `ui/react-prototype/src/api/privacy.ts`
- Modify: `ui/react-prototype/src/api/directory.ts`

Test-first: no — this is a pure URL refactor with no behaviour change. Verification is that existing tests still pass after the refactor.

- [ ] **Step 1: Create `ui/react-prototype/src/api/config.ts`**

```ts
export const API_BASE = process.env.REACT_APP_API_URL ?? 'http://localhost:5000';
```

- [ ] **Step 2: Update `ui/react-prototype/src/api/reservations.ts`**

```ts
import { ClaimResponse, DaySlotsResponse } from '../types';
import { API_BASE } from './config';

const BASE = API_BASE;

export async function getSlots(day: string): Promise<DaySlotsResponse> {
  const res = await fetch(`${BASE}/days/${day}/slots`);
  if (!res.ok) throw new Error(`getSlots failed: ${res.status}`);
  return res.json();
}

export async function claimSlot(day: string, slotKey: string): Promise<ClaimResponse> {
  const res = await fetch(`${BASE}/days/${day}/slots/${slotKey}/claim`, { method: 'POST' });
  return res.json();
}
```

- [ ] **Step 3: Update `ui/react-prototype/src/api/expenses.ts`**

```ts
import { ExpenseDto, RecordExpenseRequest } from '../types';
import { API_BASE } from './config';

const BASE = API_BASE;

export async function getExpenses(): Promise<ExpenseDto[]> {
  const res = await fetch(`${BASE}/expenses`);
  if (!res.ok) throw new Error(`getExpenses failed: ${res.status}`);
  return res.json();
}

export async function recordExpense(body: RecordExpenseRequest): Promise<ExpenseDto> {
  const res = await fetch(`${BASE}/expenses`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`recordExpense failed: ${res.status}`);
  return res.json();
}
```

- [ ] **Step 4: Update `ui/react-prototype/src/api/financial.ts`**

```ts
import { ChargeDto, PaymentDto, PeriodSummaryDto } from '../types';
import { API_BASE } from './config';

const BASE = API_BASE;

export async function getPeriodSummary(period: string): Promise<PeriodSummaryDto> {
  const res = await fetch(`${BASE}/financial-summary?period=${period}`);
  if (!res.ok) throw new Error(`getPeriodSummary failed: ${res.status}`);
  return res.json();
}

export async function getMyCharges(): Promise<ChargeDto[]> {
  const res = await fetch(`${BASE}/maintenance-fees/charges`);
  if (!res.ok) throw new Error(`getMyCharges failed: ${res.status}`);
  return res.json();
}

export async function getMyPayments(): Promise<PaymentDto[]> {
  const res = await fetch(`${BASE}/payments`);
  if (!res.ok) throw new Error(`getMyPayments failed: ${res.status}`);
  return res.json();
}
```

- [ ] **Step 5: Update `ui/react-prototype/src/api/maintenanceFees.ts`**

```ts
import { ChargeDto, RecordChargeRequest } from '../types';
import { API_BASE } from './config';

const BASE = API_BASE;

export async function getMyCharges(): Promise<ChargeDto[]> {
  const res = await fetch(`${BASE}/maintenance-fees/charges`);
  if (!res.ok) throw new Error(`getMyCharges failed: ${res.status}`);
  return res.json();
}

export async function getAllCharges(): Promise<ChargeDto[]> {
  const res = await fetch(`${BASE}/maintenance-fees/charges/all`);
  if (!res.ok) throw new Error(`getAllCharges failed: ${res.status}`);
  return res.json();
}

export async function recordCharge(
  householdRef: string,
  body: RecordChargeRequest,
): Promise<ChargeDto> {
  const res = await fetch(`${BASE}/maintenance-fees/charges/${encodeURIComponent(householdRef)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`recordCharge failed: ${res.status}`);
  return res.json();
}
```

- [ ] **Step 6: Update `ui/react-prototype/src/api/payments.ts`**

```ts
import { PaymentDto, RecordPaymentRequest, BalanceDto } from '../types';
import { API_BASE } from './config';

const BASE = API_BASE;

export async function getMyPayments(): Promise<PaymentDto[]> {
  const res = await fetch(`${BASE}/payments`);
  if (!res.ok) throw new Error(`getMyPayments failed: ${res.status}`);
  return res.json();
}

export async function getAllPayments(): Promise<PaymentDto[]> {
  const res = await fetch(`${BASE}/payments/all`);
  if (!res.ok) throw new Error(`getAllPayments failed: ${res.status}`);
  return res.json();
}

export async function recordPayment(body: RecordPaymentRequest): Promise<PaymentDto> {
  const res = await fetch(`${BASE}/payments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`recordPayment failed: ${res.status}`);
  return res.json();
}

export async function getBalance(period?: string): Promise<BalanceDto> {
  const url = period ? `${BASE}/balance?period=${encodeURIComponent(period)}` : `${BASE}/balance`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`getBalance failed: ${res.status}`);
  return res.json();
}
```

- [ ] **Step 7: Update `ui/react-prototype/src/api/notifications.ts`**

```ts
import { NotificationRecordDto, AnnouncementRequest } from '../types';
import { API_BASE } from './config';

const BASE = API_BASE;

export async function getHistory(): Promise<NotificationRecordDto[]> {
  const res = await fetch(`${BASE}/notifications`);
  if (!res.ok) throw new Error(`getHistory failed: ${res.status}`);
  return res.json();
}

export async function sendAnnouncement(req: AnnouncementRequest): Promise<void> {
  const res = await fetch(`${BASE}/notifications/announce`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  if (!res.ok) throw new Error(`sendAnnouncement failed: ${res.status}`);
}
```

- [ ] **Step 8: Update `ui/react-prototype/src/api/contactEdit.ts`**

```ts
import { API_BASE } from './config';

const BASE = API_BASE;

export interface UpdateContactRequest {
  displayName?: string | null;
  phone?: string | null;
  email?: string | null;
  optedOut?: boolean | null;
}

export async function updateMyContact(body: UpdateContactRequest): Promise<void> {
  const res = await fetch(`${BASE}/directory/contact`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`updateMyContact failed: ${res.status}`);
}

export async function updateContact(householdRef: string, body: UpdateContactRequest): Promise<void> {
  const res = await fetch(`${BASE}/directory/${encodeURIComponent(householdRef)}/contact`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`updateContact failed: ${res.status}`);
}

export async function updateNotes(householdRef: string, notes: string | null): Promise<void> {
  const res = await fetch(`${BASE}/directory/${encodeURIComponent(householdRef)}/notes`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ notes }),
  });
  if (!res.ok) throw new Error(`updateNotes failed: ${res.status}`);
}
```

- [ ] **Step 9: Update `ui/react-prototype/src/api/privacy.ts`**

```ts
import { API_BASE } from './config';

const BASE = API_BASE;

export async function eraseMyContact(): Promise<void> {
  const res = await fetch(`${BASE}/directory/contact`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`eraseMyContact failed: ${res.status}`);
}

export async function eraseContact(householdRef: string): Promise<'erased' | 'not-found'> {
  const res = await fetch(`${BASE}/directory/${encodeURIComponent(householdRef)}/contact`, { method: 'DELETE' });
  if (res.status === 204) return 'erased';
  if (res.status === 404) return 'not-found';
  throw new Error(`eraseContact failed: ${res.status}`);
}

export async function markDeparted(householdRef: string): Promise<'ok' | 'not-found'> {
  const res = await fetch(`${BASE}/directory/${encodeURIComponent(householdRef)}/departed`, { method: 'DELETE' });
  if (res.ok) return 'ok';
  if (res.status === 404) return 'not-found';
  throw new Error(`markDeparted failed: ${res.status}`);
}

export async function purgeExpired(): Promise<{ deleted: number }> {
  const res = await fetch(`${BASE}/directory/purge-expired`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`purgeExpired failed: ${res.status}`);
  return res.json();
}
```

- [ ] **Step 10: Update `ui/react-prototype/src/api/directory.ts`**

Note: this file uses `const API` (not `const BASE`) — keep the name as-is.

```ts
import {
  AdminDirectoryListResponse,
  AdminUpdateContactRequest,
  DirectoryEntry,
  DirectoryEntryAdmin,
  DirectoryListResponse,
  UpdateContactRequest,
} from '../types';
import { API_BASE } from './config';

const API = API_BASE;

export async function getDirectory(): Promise<DirectoryEntry[]> {
  const res = await fetch(`${API}/directory`);
  if (!res.ok) throw new Error(`GET /directory failed: ${res.status}`);
  const body: DirectoryListResponse = await res.json();
  return body.entries ?? [];
}

export async function getAdminDirectory(): Promise<DirectoryEntryAdmin[]> {
  const res = await fetch(`${API}/directory/admin`);
  if (!res.ok) throw new Error(`GET /directory/admin failed: ${res.status}`);
  const body: AdminDirectoryListResponse = await res.json();
  return body.entries ?? [];
}

export async function updateMyContact(req: UpdateContactRequest): Promise<void> {
  const res = await fetch(`${API}/directory/contact`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  if (!res.ok) throw new Error(`PUT /directory/contact failed: ${res.status}`);
}

export async function adminUpdateContact(
  householdRef: string,
  req: AdminUpdateContactRequest,
): Promise<void> {
  const res = await fetch(`${API}/directory/${householdRef}/contact`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  if (!res.ok) throw new Error(`PUT /directory/${householdRef}/contact failed: ${res.status}`);
}

export async function markDeparted(householdRef: string): Promise<void> {
  const res = await fetch(`${API}/directory/${householdRef}/departed`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error(`DELETE /directory/${householdRef}/departed failed: ${res.status}`);
}
```

- [ ] **Step 11: Run React tests — verify they still pass**

```bash
cd ui/react-prototype
CI=true npm test
```

PowerShell alternative:
```powershell
cd ui/react-prototype; $env:CI='true'; npm test
```

Expected: all tests pass. In Jest, `process.env.REACT_APP_API_URL` is `undefined` so `API_BASE` resolves to `'http://localhost:5000'` — same value as before. If any test fails, the URL being generated by a source file does not match what the test expects. Check that the import was added correctly.

- [ ] **Step 12: Commit**

```bash
git add ui/react-prototype/src/api/config.ts \
        ui/react-prototype/src/api/reservations.ts \
        ui/react-prototype/src/api/expenses.ts \
        ui/react-prototype/src/api/financial.ts \
        ui/react-prototype/src/api/maintenanceFees.ts \
        ui/react-prototype/src/api/payments.ts \
        ui/react-prototype/src/api/notifications.ts \
        ui/react-prototype/src/api/contactEdit.ts \
        ui/react-prototype/src/api/privacy.ts \
        ui/react-prototype/src/api/directory.ts
git commit -m "feat(deploy): extract React API base URL to config module"
```

---

### Task 2: Angular — environment files + `angular.json` + all 9 service files

**Files:**
- Create: `ui/angular-prototype/src/environments/environment.ts`
- Create: `ui/angular-prototype/src/environments/environment.prod.ts`
- Modify: `ui/angular-prototype/angular.json`
- Modify: `ui/angular-prototype/src/app/reservations/reservations.service.ts`
- Modify: `ui/angular-prototype/src/app/expenses/expense.service.ts`
- Modify: `ui/angular-prototype/src/app/financial/financial.service.ts`
- Modify: `ui/angular-prototype/src/app/maintenance-fees/maintenance-fee.service.ts`
- Modify: `ui/angular-prototype/src/app/payments/payment.service.ts`
- Modify: `ui/angular-prototype/src/app/notifications/notification.service.ts`
- Modify: `ui/angular-prototype/src/app/contact-edit/contact-edit.service.ts`
- Modify: `ui/angular-prototype/src/app/privacy/privacy.service.ts`
- Modify: `ui/angular-prototype/src/app/directory/directory.service.ts`

Test-first: no — this is a pure URL refactor. Verification: existing Angular tests still pass, and `ng build --configuration production` succeeds.

- [ ] **Step 1: Create `ui/angular-prototype/src/environments/environment.ts`**

```ts
export const environment = {
  apiUrl: 'http://localhost:5000'
};
```

- [ ] **Step 2: Create `ui/angular-prototype/src/environments/environment.prod.ts`**

```ts
export const environment = {
  apiUrl: ''
};
```

Empty string is an intentional placeholder. Slice 4 GitHub Actions will inject the real Container App URL at build time.

- [ ] **Step 3: Add `fileReplacements` to `ui/angular-prototype/angular.json`**

Open `ui/angular-prototype/angular.json`. Find the `"production"` configuration block inside `"architect" > "build" > "configurations"`. It currently starts with:

```json
"production": {
  "budgets": [
```

Replace it with:

```json
"production": {
  "fileReplacements": [
    {
      "replace": "src/environments/environment.ts",
      "with": "src/environments/environment.prod.ts"
    }
  ],
  "budgets": [
```

The rest of the `production` block (`budgets`, `outputHashing`) stays unchanged.

- [ ] **Step 4: Update `ui/angular-prototype/src/app/reservations/reservations.service.ts`**

```ts
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ClaimResponse, DaySlotsResponse } from './models';
import { environment } from '../../environments/environment';

const API = environment.apiUrl;

@Injectable({ providedIn: 'root' })
export class ReservationsService {
  private readonly http = inject(HttpClient);

  getSlots(day: string): Observable<DaySlotsResponse> {
    return this.http.get<DaySlotsResponse>(`${API}/days/${day}/slots`);
  }

  claimSlot(day: string, slotKey: string): Observable<ClaimResponse> {
    return this.http.post<ClaimResponse>(`${API}/days/${day}/slots/${slotKey}/claim`, null);
  }
}
```

- [ ] **Step 5: Update `ui/angular-prototype/src/app/expenses/expense.service.ts`**

```ts
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ExpenseDto, RecordExpenseRequest } from './models';
import { environment } from '../../environments/environment';

const API = environment.apiUrl;

@Injectable({ providedIn: 'root' })
export class ExpenseService {
  private readonly http = inject(HttpClient);

  getExpenses(): Observable<ExpenseDto[]> {
    return this.http.get<ExpenseDto[]>(`${API}/expenses`);
  }

  recordExpense(body: RecordExpenseRequest): Observable<ExpenseDto> {
    return this.http.post<ExpenseDto>(`${API}/expenses`, body);
  }
}
```

- [ ] **Step 6: Update `ui/angular-prototype/src/app/financial/financial.service.ts`**

```ts
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ChargeDto, PaymentDto, PeriodSummaryDto } from './models';
import { environment } from '../../environments/environment';

const API = environment.apiUrl;

@Injectable({ providedIn: 'root' })
export class FinancialService {
  private readonly http = inject(HttpClient);

  getPeriodSummary(period: string): Observable<PeriodSummaryDto> {
    return this.http.get<PeriodSummaryDto>(`${API}/financial-summary?period=${period}`);
  }

  getMyCharges(): Observable<ChargeDto[]> {
    return this.http.get<ChargeDto[]>(`${API}/maintenance-fees/charges`);
  }

  getMyPayments(): Observable<PaymentDto[]> {
    return this.http.get<PaymentDto[]>(`${API}/payments`);
  }
}
```

- [ ] **Step 7: Update `ui/angular-prototype/src/app/maintenance-fees/maintenance-fee.service.ts`**

```ts
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ChargeDto, RecordChargeRequest } from './models';
import { environment } from '../../environments/environment';

const API = environment.apiUrl;

@Injectable({ providedIn: 'root' })
export class MaintenanceFeeService {
  private readonly http = inject(HttpClient);

  getMyCharges(): Observable<ChargeDto[]> {
    return this.http.get<ChargeDto[]>(`${API}/maintenance-fees/charges`);
  }

  getAllCharges(): Observable<ChargeDto[]> {
    return this.http.get<ChargeDto[]>(`${API}/maintenance-fees/charges/all`);
  }

  recordCharge(householdRef: string, body: RecordChargeRequest): Observable<ChargeDto> {
    return this.http.post<ChargeDto>(`${API}/maintenance-fees/charges/${householdRef}`, body);
  }
}
```

- [ ] **Step 8: Update `ui/angular-prototype/src/app/payments/payment.service.ts`**

```ts
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { PaymentDto, RecordPaymentRequest, BalanceDto } from './models';
import { environment } from '../../environments/environment';

const API = environment.apiUrl;

@Injectable({ providedIn: 'root' })
export class PaymentService {
  private readonly http = inject(HttpClient);

  getMyPayments(): Observable<PaymentDto[]> {
    return this.http.get<PaymentDto[]>(`${API}/payments`);
  }

  getAllPayments(): Observable<PaymentDto[]> {
    return this.http.get<PaymentDto[]>(`${API}/payments/all`);
  }

  recordPayment(body: RecordPaymentRequest): Observable<PaymentDto> {
    return this.http.post<PaymentDto>(`${API}/payments`, body);
  }

  getBalance(period?: string): Observable<BalanceDto> {
    const params = period ? new HttpParams().set('period', period) : undefined;
    return this.http.get<BalanceDto>(`${API}/balance`, { params });
  }
}
```

- [ ] **Step 9: Update `ui/angular-prototype/src/app/notifications/notification.service.ts`**

Note: this service uses `private base` (class field) not `const API`. Replace the class field with `environment.apiUrl`.

```ts
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { NotificationRecordDto, AnnouncementRequest } from './models';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl;

  getHistory(): Observable<NotificationRecordDto[]> {
    return this.http.get<NotificationRecordDto[]>(`${this.base}/notifications`);
  }

  sendAnnouncement(body: AnnouncementRequest): Observable<void> {
    return this.http.post<void>(`${this.base}/notifications/announce`, body);
  }
}
```

- [ ] **Step 10: Update `ui/angular-prototype/src/app/contact-edit/contact-edit.service.ts`**

Note: this service uses `private base` (class field). Replace with `environment.apiUrl`.

```ts
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { UpdateContactRequest } from './models';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ContactEditService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl;

  /** Resident updates their own contact — householdRef is session-derived (R2). */
  updateMyContact(body: UpdateContactRequest): Observable<void> {
    return this.http
      .put(`${this.base}/directory/contact`, body, { responseType: 'text' })
      .pipe(map(() => undefined));
  }

  /** Board updates any household's contact details. */
  updateContact(householdRef: string, body: UpdateContactRequest): Observable<void> {
    return this.http
      .put(`${this.base}/directory/${encodeURIComponent(householdRef)}/contact`, body, { responseType: 'text' })
      .pipe(map(() => undefined));
  }

  /** Board updates internal notes for a household. */
  updateNotes(householdRef: string, notes: string | null): Observable<void> {
    return this.http
      .put(`${this.base}/directory/${encodeURIComponent(householdRef)}/notes`, { notes }, { responseType: 'text' })
      .pipe(map(() => undefined));
  }
}
```

- [ ] **Step 11: Update `ui/angular-prototype/src/app/privacy/privacy.service.ts`**

Note: this service uses `private base` (class field). Replace with `environment.apiUrl`.

```ts
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, map, of, throwError } from 'rxjs';
import { EraseContactOutcome, MarkDepartedOutcome, PurgeExpiredResult } from './models';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class PrivacyService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl;

  /** Resident Art. 17 self-erase — householdRef is session-derived (R2). */
  eraseMyContact(): Observable<void> {
    return this.http
      .delete(`${this.base}/directory/contact`, { responseType: 'text' })
      .pipe(map(() => undefined));
  }

  /** Board DSAR hard-delete. 204 = erased, 404 = not found. */
  eraseContact(householdRef: string): Observable<EraseContactOutcome> {
    return this.http
      .delete(`${this.base}/directory/${encodeURIComponent(householdRef)}/contact`, { responseType: 'text' })
      .pipe(
        map(() => 'erased' as EraseContactOutcome),
        catchError(err => {
          if (err.status === 404) return of('not-found' as EraseContactOutcome);
          return throwError(() => err);
        }),
      );
  }

  /** Board sets departure date on a household. DELETE 200 = ok, 404 = not found. */
  markDeparted(householdRef: string): Observable<MarkDepartedOutcome> {
    return this.http
      .delete(`${this.base}/directory/${encodeURIComponent(householdRef)}/departed`, { responseType: 'text' })
      .pipe(
        map(() => 'ok' as MarkDepartedOutcome),
        catchError(err => {
          if (err.status === 404) return of('not-found' as MarkDepartedOutcome);
          return throwError(() => err);
        }),
      );
  }

  /** Board annual retention sweep — deletes contacts whose departed date has expired. */
  purgeExpired(): Observable<PurgeExpiredResult> {
    return this.http.delete<PurgeExpiredResult>(`${this.base}/directory/purge-expired`);
  }
}
```

- [ ] **Step 12: Update `ui/angular-prototype/src/app/directory/directory.service.ts`**

```ts
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  AdminDirectoryListResponse,
  AdminUpdateContactRequest,
  DirectoryEntry,
  DirectoryEntryAdmin,
  DirectoryListResponse,
  UpdateContactRequest,
} from './models';
import { environment } from '../../environments/environment';

const API = environment.apiUrl;

@Injectable({ providedIn: 'root' })
export class DirectoryService {
  private readonly http = inject(HttpClient);

  getDirectory(): Observable<DirectoryEntry[]> {
    return this.http
      .get<DirectoryListResponse>(`${API}/directory`)
      .pipe(map(r => r.entries ?? []));
  }

  getAdminDirectory(): Observable<DirectoryEntryAdmin[]> {
    return this.http
      .get<AdminDirectoryListResponse>(`${API}/directory/admin`)
      .pipe(map(r => r.entries ?? []));
  }

  updateMyContact(req: UpdateContactRequest): Observable<void> {
    return this.http.put<void>(`${API}/directory/contact`, req);
  }

  adminUpdateContact(householdRef: string, req: AdminUpdateContactRequest): Observable<void> {
    return this.http.put<void>(`${API}/directory/${householdRef}/contact`, req);
  }

  markDeparted(householdRef: string): Observable<void> {
    return this.http.delete<void>(`${API}/directory/${householdRef}/departed`);
  }
}
```

- [ ] **Step 13: Run Angular tests — verify they still pass**

```bash
cd ui/angular-prototype
CI=true npx ng test
```

PowerShell alternative:
```powershell
cd ui/angular-prototype; $env:CI='true'; npx ng test
```

Expected: all existing spec tests pass. Angular specs run under the dev build config so `environment.apiUrl = 'http://localhost:5000'` — the `http.expectOne('http://localhost:5000/...')` assertions still match.

If a test fails with "Expected one matching request...", the service is generating a different URL. Check that the `environment` import path (`../../environments/environment`) is correct for that service's directory depth. All 9 services are at `src/app/<domain>/` depth, so the path is always `../../environments/environment`.

- [ ] **Step 14: Verify production build succeeds**

```bash
cd ui/angular-prototype
npx ng build --configuration production
```

PowerShell:
```powershell
cd ui/angular-prototype; npx ng build --configuration production
```

Expected: build completes with output in `dist/angular-prototype/browser/`. The `fileReplacements` will swap `environment.ts` with `environment.prod.ts`, so `environment.apiUrl` will be `''` in the production bundle. No errors or TS warnings should appear (the empty string is a valid string value).

If the build fails with "Cannot find module '../../environments/environment'", verify `angular.json` `fileReplacements` is pointing to `src/environments/environment.ts` (relative to the project root, not the source root).

- [ ] **Step 15: Commit**

```bash
git add ui/angular-prototype/src/environments/environment.ts \
        ui/angular-prototype/src/environments/environment.prod.ts \
        ui/angular-prototype/angular.json \
        ui/angular-prototype/src/app/reservations/reservations.service.ts \
        ui/angular-prototype/src/app/expenses/expense.service.ts \
        ui/angular-prototype/src/app/financial/financial.service.ts \
        ui/angular-prototype/src/app/maintenance-fees/maintenance-fee.service.ts \
        ui/angular-prototype/src/app/payments/payment.service.ts \
        ui/angular-prototype/src/app/notifications/notification.service.ts \
        ui/angular-prototype/src/app/contact-edit/contact-edit.service.ts \
        ui/angular-prototype/src/app/privacy/privacy.service.ts \
        ui/angular-prototype/src/app/directory/directory.service.ts
git commit -m "feat(deploy): extract Angular API base URL to environment files"
```

---

### Task 3: `staticwebapp.config.json` for both UIs

**Files:**
- Create: `ui/react-prototype/staticwebapp.config.json`
- Create: `ui/angular-prototype/staticwebapp.config.json`

Test-first: no — SPA routing config is verified by file presence and content. Azure Static Web Apps reads this file from the deployment root at runtime.

- [ ] **Step 1: Create `ui/react-prototype/staticwebapp.config.json`**

```json
{
  "navigationFallback": {
    "rewrite": "/index.html",
    "exclude": ["/api/*", "/*.{css,js,png,svg,ico,woff,woff2,map}"]
  }
}
```

- [ ] **Step 2: Create `ui/angular-prototype/staticwebapp.config.json`**

```json
{
  "navigationFallback": {
    "rewrite": "/index.html",
    "exclude": ["/api/*", "/*.{css,js,png,svg,ico,woff,woff2,map}"]
  }
}
```

- [ ] **Step 3: Verify Angular production build output includes the config file**

The Angular CLI copies `public/` assets to `dist/`. `staticwebapp.config.json` at the project root (`ui/angular-prototype/`) is NOT automatically included — it must be listed in `angular.json` assets or placed in the `public/` directory.

Check `ui/angular-prototype/angular.json` assets section:
```json
"assets": [
  {
    "glob": "**/*",
    "input": "public"
  }
]
```

Move the Angular `staticwebapp.config.json` into `ui/angular-prototype/public/staticwebapp.config.json` so the Angular CLI copies it to the build output automatically.

So the final state is:
- `ui/react-prototype/staticwebapp.config.json` — at project root (CRA copies all root-level public files from `public/` dir, so actually move it to `ui/react-prototype/public/staticwebapp.config.json`)
- `ui/angular-prototype/public/staticwebapp.config.json` — in public/ so Angular CLI copies it to dist

Check CRA's `public/` directory convention: CRA copies everything in `public/` to the build output. The `staticwebapp.config.json` must go in `ui/react-prototype/public/staticwebapp.config.json`.

**Correction:** Create both config files in their respective `public/` directories:

`ui/react-prototype/public/staticwebapp.config.json`:
```json
{
  "navigationFallback": {
    "rewrite": "/index.html",
    "exclude": ["/api/*", "/*.{css,js,png,svg,ico,woff,woff2,map}"]
  }
}
```

`ui/angular-prototype/public/staticwebapp.config.json`:
```json
{
  "navigationFallback": {
    "rewrite": "/index.html",
    "exclude": ["/api/*", "/*.{css,js,png,svg,ico,woff,woff2,map}"]
  }
}
```

- [ ] **Step 4: Verify React build includes the config**

```bash
cd ui/react-prototype
CI=true npm run build
ls build/staticwebapp.config.json
```

Expected: file exists in `build/`.

- [ ] **Step 5: Verify Angular build includes the config**

```bash
cd ui/angular-prototype
npx ng build --configuration production
ls dist/angular-prototype/browser/staticwebapp.config.json
```

Expected: file exists in `dist/angular-prototype/browser/`.

- [ ] **Step 6: Commit**

```bash
git add ui/react-prototype/public/staticwebapp.config.json \
        ui/angular-prototype/public/staticwebapp.config.json
git commit -m "feat(deploy): add staticwebapp.config.json SPA routing fallback to both UIs"
```
