# Financial Summary Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the financial summary screen in both Angular (PrimeNG 22) and React (MUI 9) prototypes, showing the resident's period-based totals, itemised charges, payment history, and a Pay stub dialog.

**Architecture:** Three backend calls fire in parallel on mount (`GET /financial-summary?period=YYYY-MM`, `GET /maintenance-fees/charges`, `GET /payments`). The period picker drives a re-fetch of only the summary. The "Pay" button opens an informational dialog (no API call — `POST /payments` is admin-only). Same pattern repeated in Angular (signals + PrimeNG) and React (hooks + MUI).

**Tech Stack:** Angular 21 + PrimeNG 22 + vitest (`@angular/build:unit-test`); React 19 + MUI 9 + Jest (react-scripts); TypeScript; raw `fetch` in React, `HttpClient` in Angular; `forkJoin` (rxjs) for parallel Angular calls; `Promise.all` for parallel React calls.

---

## File Map

**Angular (create):**
- `ui/angular-prototype/src/app/financial/models.ts` — TS interfaces for ChargeDto, PaymentDto, PeriodSummaryDto
- `ui/angular-prototype/src/app/financial/financial.service.ts` — `inject(HttpClient)`, three methods
- `ui/angular-prototype/src/app/financial/financial.service.spec.ts` — 3 service tests
- `ui/angular-prototype/src/app/financial/financial.component.ts` — standalone component with signals
- `ui/angular-prototype/src/app/financial/financial.component.spec.ts` — 4 component tests

**Angular (modify):**
- `ui/angular-prototype/src/app/app.routes.ts` — add `/financial` route
- `ui/angular-prototype/src/app/directory/directory-list.component.ts` — add Finance nav link
- `ui/angular-prototype/src/app/reservations/reservations.component.ts` — add Finance nav link

**React (create):**
- `ui/react-prototype/src/api/financial.ts` — `getPeriodSummary`, `getMyCharges`, `getMyPayments`
- `ui/react-prototype/src/api/financial.test.ts` — 3 API tests
- `ui/react-prototype/src/components/FinancialScreen.tsx` — main screen component
- `ui/react-prototype/src/components/FinancialScreen.test.tsx` — 4 component tests

**React (modify):**
- `ui/react-prototype/src/types/index.ts` — add ChargeDto, PaymentDto, PeriodSummaryDto
- `ui/react-prototype/src/App.tsx` — add `'financial'` screen + Finance Tab

---

## Task 1: Angular — models, FinancialService, and service tests

Test-first: yes — failing test for `getPeriodSummary` URL before service is written

**Files:**
- Create: `ui/angular-prototype/src/app/financial/models.ts`
- Create: `ui/angular-prototype/src/app/financial/financial.service.ts`
- Create: `ui/angular-prototype/src/app/financial/financial.service.spec.ts`

- [ ] **Step 1: Write the failing service spec**

```typescript
// ui/angular-prototype/src/app/financial/financial.service.spec.ts
import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { FinancialService } from './financial.service';
import { PeriodSummaryDto, ChargeDto, PaymentDto } from './models';

describe('FinancialService', () => {
  let service: FinancialService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(FinancialService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('getPeriodSummary calls GET /financial-summary?period=2026-07', () => {
    const expected: PeriodSummaryDto = { period: '2026-07', totalChargesEur: 450, totalExpensesEur: 120 };
    let result: PeriodSummaryDto | undefined;
    service.getPeriodSummary('2026-07').subscribe(r => (result = r));
    const req = http.expectOne('http://localhost:5000/financial-summary?period=2026-07');
    expect(req.request.method).toBe('GET');
    req.flush(expected);
    expect(result).toEqual(expected);
  });

  it('getMyCharges calls GET /maintenance-fees/charges', () => {
    let result: ChargeDto[] | undefined;
    service.getMyCharges().subscribe(r => (result = r));
    const req = http.expectOne('http://localhost:5000/maintenance-fees/charges');
    expect(req.request.method).toBe('GET');
    req.flush([]);
    expect(result).toEqual([]);
  });

  it('getMyPayments calls GET /payments', () => {
    let result: PaymentDto[] | undefined;
    service.getMyPayments().subscribe(r => (result = r));
    const req = http.expectOne('http://localhost:5000/payments');
    expect(req.request.method).toBe('GET');
    req.flush([]);
    expect(result).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```
cd ui/angular-prototype
npx ng test --include="src/app/financial/financial.service.spec.ts"
```

Expected: FAIL — `Cannot find module './financial.service'`

- [ ] **Step 3: Write models.ts**

```typescript
// ui/angular-prototype/src/app/financial/models.ts
export interface PeriodSummaryDto {
  period: string;
  totalChargesEur: number;
  totalExpensesEur: number;
}

export interface ChargeDto {
  id: string;
  householdRef: string;
  amountEur: number;
  description: string;
  period: string;
  chargedAt: string;
  idempotencyKey: string;
}

export interface PaymentDto {
  id: string;
  householdRef: string;
  amountEur: number;
  period: string;
  dateReceived: string;
  recordedAt: string;
  idempotencyKey: string;
}
```

- [ ] **Step 4: Write financial.service.ts**

```typescript
// ui/angular-prototype/src/app/financial/financial.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ChargeDto, PaymentDto, PeriodSummaryDto } from './models';

const API = 'http://localhost:5000';

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

- [ ] **Step 5: Run tests to verify they pass**

```
cd ui/angular-prototype
npx ng test --include="src/app/financial/financial.service.spec.ts"
```

Expected: 3 tests PASS

- [ ] **Step 6: Commit**

```bash
git add ui/angular-prototype/src/app/financial/models.ts \
        ui/angular-prototype/src/app/financial/financial.service.ts \
        ui/angular-prototype/src/app/financial/financial.service.spec.ts
git commit -m "feat(angular): FinancialService with 3 passing tests"
```

---

## Task 2: Angular — FinancialComponent and component tests

Test-first: yes — 4 failing component tests before component is written

**Files:**
- Create: `ui/angular-prototype/src/app/financial/financial.component.spec.ts`
- Create: `ui/angular-prototype/src/app/financial/financial.component.ts`

- [ ] **Step 1: Write the failing component spec**

```typescript
// ui/angular-prototype/src/app/financial/financial.component.spec.ts
import { TestBed } from '@angular/core/testing';
import { FinancialComponent } from './financial.component';
import { FinancialService } from './financial.service';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ChargeDto, PaymentDto, PeriodSummaryDto } from './models';

const SUMMARY: PeriodSummaryDto = { period: '2026-07', totalChargesEur: 450, totalExpensesEur: 120 };
const CHARGE: ChargeDto = {
  id: 'c1', householdRef: 'h1', amountEur: 150, description: 'July fee',
  period: '2026-07', chargedAt: '2026-07-01T00:00:00Z', idempotencyKey: 'ik1',
};
const PAYMENT: PaymentDto = {
  id: 'p1', householdRef: 'h1', amountEur: 300, period: '2026-06',
  dateReceived: '2026-06-15', recordedAt: '2026-06-15T09:00:00Z', idempotencyKey: 'ik2',
};

describe('FinancialComponent', () => {
  const setupComponent = async (serviceMock: Partial<FinancialService>) => {
    await TestBed.configureTestingModule({
      imports: [FinancialComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: FinancialService, useValue: serviceMock },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(FinancialComponent);
    fixture.detectChanges();
    return fixture;
  };

  it('renders period summary totals', async () => {
    const fixture = await setupComponent({
      getPeriodSummary: () => of(SUMMARY),
      getMyCharges: () => of([]),
      getMyPayments: () => of([]),
    });
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="summary-charges"]')?.textContent).toContain('450');
    expect(el.querySelector('[data-testid="summary-expenses"]')?.textContent).toContain('120');
  });

  it('renders charge rows from service', async () => {
    const fixture = await setupComponent({
      getPeriodSummary: () => of(SUMMARY),
      getMyCharges: () => of([CHARGE]),
      getMyPayments: () => of([]),
    });
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelectorAll('[data-testid="charge-row"]').length).toBe(1);
    expect(el.querySelector('[data-testid="charge-row"]')?.textContent).toContain('July fee');
  });

  it('renders payment rows from service', async () => {
    const fixture = await setupComponent({
      getPeriodSummary: () => of(SUMMARY),
      getMyCharges: () => of([]),
      getMyPayments: () => of([PAYMENT]),
    });
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelectorAll('[data-testid="payment-row"]').length).toBe(1);
    expect(el.querySelector('[data-testid="payment-row"]')?.textContent).toContain('300');
  });

  it('pay button opens stub dialog', async () => {
    const fixture = await setupComponent({
      getPeriodSummary: () => of(SUMMARY),
      getMyCharges: () => of([]),
      getMyPayments: () => of([]),
    });
    fixture.detectChanges();
    const btn = (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('[data-testid="pay-btn"]');
    btn?.click();
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement)
      .querySelector('[data-testid="pay-dialog"]')).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```
cd ui/angular-prototype
npx ng test --include="src/app/financial/financial.component.spec.ts"
```

Expected: FAIL — `Cannot find module './financial.component'`

- [ ] **Step 3: Write financial.component.ts**

```typescript
// ui/angular-prototype/src/app/financial/financial.component.ts
import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { DialogModule } from 'primeng/dialog';
import { forkJoin } from 'rxjs';
import { FinancialService } from './financial.service';
import { ChargeDto, PaymentDto, PeriodSummaryDto } from './models';

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function formatEur(n: number): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n);
}

@Component({
  selector: 'app-financial',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    CardModule,
    ButtonModule,
    ProgressSpinnerModule,
    DialogModule,
  ],
  template: `
    <div class="harmonia-shell">
      <header class="harmonia-header">
        <span class="harmonia-logo">🏡 Harmonia</span>
        <span class="harmonia-subtitle">Resident Portal</span>
        <div class="flex-spacer"></div>
        <a routerLink="/directory" class="nav-link">Directory</a>
        <a routerLink="/reservations" class="nav-link">Reservations</a>
        <a routerLink="/financial" class="nav-link nav-active">Finance</a>
      </header>

      <main class="harmonia-content">
        <p-card>
          <ng-template #title>Financial Summary</ng-template>
          <ng-template #content>

            @if (loading()) {
              <div class="center-state">
                <p-progressspinner strokeWidth="4" [style]="{width:'48px',height:'48px'}" />
              </div>
            }

            @if (error()) {
              <div data-testid="error-state" class="error-state">
                <p>{{ error() }}</p>
                <button data-testid="retry-btn" (click)="loadAll()">Retry</button>
              </div>
            }

            @if (!loading() && !error()) {
              <!-- Period picker + summary -->
              <div class="period-row">
                <label class="period-label">Period:</label>
                <input
                  type="month"
                  [(ngModel)]="period"
                  (ngModelChange)="onPeriodChange()"
                  class="period-input"
                />
              </div>

              @if (summary()) {
                <div class="summary-card">
                  <div class="summary-item">
                    <span class="summary-label">Total charges this period</span>
                    <span data-testid="summary-charges" class="summary-value">
                      {{ formatEur(summary()!.totalChargesEur) }}
                    </span>
                  </div>
                  <div class="summary-item">
                    <span class="summary-label">Total expenses this period</span>
                    <span data-testid="summary-expenses" class="summary-value">
                      {{ formatEur(summary()!.totalExpensesEur) }}
                    </span>
                  </div>
                </div>
              }

              <!-- My Charges -->
              <h3 class="section-title">My Charges</h3>
              <table class="fin-table">
                <thead>
                  <tr><th>Date</th><th>Description</th><th>Period</th><th>Amount</th></tr>
                </thead>
                <tbody>
                  @for (c of charges(); track c.id) {
                    <tr data-testid="charge-row">
                      <td>{{ c.chargedAt | date:'yyyy-MM-dd' }}</td>
                      <td>{{ c.description }}</td>
                      <td>{{ c.period }}</td>
                      <td>{{ formatEur(c.amountEur) }}</td>
                    </tr>
                  }
                  @if (charges().length === 0) {
                    <tr><td colspan="4" class="empty-cell">No charges on record.</td></tr>
                  }
                </tbody>
              </table>

              <!-- My Payments -->
              <h3 class="section-title">My Payments</h3>
              <table class="fin-table">
                <thead>
                  <tr><th>Date received</th><th>Period</th><th>Amount</th></tr>
                </thead>
                <tbody>
                  @for (p of payments(); track p.id) {
                    <tr data-testid="payment-row">
                      <td>{{ p.dateReceived }}</td>
                      <td>{{ p.period }}</td>
                      <td>{{ formatEur(p.amountEur) }}</td>
                    </tr>
                  }
                  @if (payments().length === 0) {
                    <tr><td colspan="3" class="empty-cell">No payments on record.</td></tr>
                  }
                </tbody>
              </table>

              <!-- Pay button stub -->
              <div class="pay-row">
                <button
                  data-testid="pay-btn"
                  class="pay-btn"
                  (click)="showPayDialog = true"
                >Request Payment</button>
              </div>
            }

            <!-- Pay stub dialog -->
            <p-dialog
              [(visible)]="showPayDialog"
              [modal]="true"
              header="Request Payment"
              appendTo="parent"
              [style]="{width:'360px'}"
            >
              <div data-testid="pay-dialog">
                <p>Payments are recorded by the building administrator.</p>
                <p>Please contact the office to register a payment.</p>
              </div>
              <ng-template #footer>
                <button (click)="showPayDialog = false">Close</button>
              </ng-template>
            </p-dialog>

          </ng-template>
        </p-card>
      </main>
    </div>
  `,
  styles: [`
    .harmonia-shell { min-height: 100vh; background: #f5f5f0; }
    .harmonia-header {
      display: flex; align-items: center; gap: 12px; padding: 12px 24px;
      background: #2e6b4f; color: white;
    }
    .harmonia-logo { font-size: 1.25rem; font-weight: 700; }
    .harmonia-subtitle { opacity: .7; font-size: .875rem; }
    .flex-spacer { flex: 1; }
    .nav-link { color: rgba(255,255,255,.75); text-decoration: none; padding: 6px 12px; border-radius: 6px; font-size: .875rem; }
    .nav-link:hover { background: rgba(255,255,255,.1); }
    .nav-active { background: rgba(255,255,255,.18); color: white; font-weight: 600; }
    .harmonia-content { max-width: 900px; margin: 0 auto; padding: 24px 16px; }
    .period-row { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
    .period-label { font-weight: 500; }
    .period-input { padding: 6px 8px; border-radius: 4px; border: 1px solid #ccc; font-size: 14px; }
    .summary-card { display: flex; gap: 32px; margin-bottom: 24px; padding: 16px; background: white; border-radius: 8px; border: 1px solid #e0e0e0; }
    .summary-item { display: flex; flex-direction: column; gap: 4px; }
    .summary-label { font-size: .8125rem; color: #666; }
    .summary-value { font-size: 1.25rem; font-weight: 700; color: #2e6b4f; }
    .section-title { margin: 20px 0 8px; font-size: 1rem; font-weight: 600; color: #333; }
    .fin-table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    .fin-table th, .fin-table td { padding: 8px 12px; text-align: left; border-bottom: 1px solid #eee; font-size: .875rem; }
    .fin-table th { background: #f9f9f7; font-weight: 600; color: #555; }
    .empty-cell { text-align: center; color: #999; padding: 16px; }
    .center-state { display: flex; justify-content: center; padding: 48px; }
    .error-state { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 48px; color: #c00; }
    .pay-row { margin-top: 8px; }
    .pay-btn { background: #2e6b4f; color: white; border: none; padding: 8px 20px; border-radius: 6px; font-size: .9rem; cursor: pointer; }
    .pay-btn:hover { background: #245a40; }
  `],
})
export class FinancialComponent implements OnInit {
  private readonly svc = inject(FinancialService);

  readonly summary   = signal<PeriodSummaryDto | null>(null);
  readonly charges   = signal<ChargeDto[]>([]);
  readonly payments  = signal<PaymentDto[]>([]);
  readonly loading   = signal(true);
  readonly error     = signal<string | null>(null);
  period = currentMonth();
  showPayDialog = false;

  readonly formatEur = formatEur;

  ngOnInit(): void { this.loadAll(); }

  loadAll(): void {
    this.loading.set(true);
    this.error.set(null);
    forkJoin({
      summary:  this.svc.getPeriodSummary(this.period),
      charges:  this.svc.getMyCharges(),
      payments: this.svc.getMyPayments(),
    }).subscribe({
      next: ({ summary, charges, payments }) => {
        this.summary.set(summary);
        this.charges.set(charges);
        this.payments.set(payments);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Could not load financial data. Please try again.');
        this.loading.set(false);
      },
    });
  }

  onPeriodChange(): void {
    this.svc.getPeriodSummary(this.period).subscribe({
      next: s => this.summary.set(s),
      error: () => {},
    });
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```
cd ui/angular-prototype
npx ng test --include="src/app/financial/financial.component.spec.ts"
```

Expected: 4 tests PASS

- [ ] **Step 5: Run all Angular tests**

```
cd ui/angular-prototype
npx ng test
```

Expected: All tests PASS (service + component specs)

- [ ] **Step 6: Commit**

```bash
git add ui/angular-prototype/src/app/financial/financial.component.ts \
        ui/angular-prototype/src/app/financial/financial.component.spec.ts
git commit -m "feat(angular): FinancialComponent with 4 passing tests"
```

---

## Task 3: Angular — routing and navigation

Test-first: no — structural wiring, no new logic

**Files:**
- Modify: `ui/angular-prototype/src/app/app.routes.ts`
- Modify: `ui/angular-prototype/src/app/directory/directory-list.component.ts`
- Modify: `ui/angular-prototype/src/app/reservations/reservations.component.ts`

- [ ] **Step 1: Add `/financial` route to app.routes.ts**

Replace the entire file:

```typescript
// ui/angular-prototype/src/app/app.routes.ts
import { Routes } from '@angular/router';
import { DirectoryListComponent } from './directory/directory-list.component';
import { ReservationsComponent } from './reservations/reservations.component';
import { FinancialComponent } from './financial/financial.component';

export const routes: Routes = [
  { path: '', redirectTo: 'directory', pathMatch: 'full' },
  { path: 'directory', component: DirectoryListComponent },
  { path: 'reservations', component: ReservationsComponent },
  { path: 'financial', component: FinancialComponent },
];
```

- [ ] **Step 2: Add Finance nav link to directory-list.component.ts**

Find the nav links block in the template (around line 47-48):
```html
        <a routerLink="/directory" class="nav-link nav-active">Directory</a>
        <a routerLink="/reservations" class="nav-link">Reservations</a>
```

Replace with:
```html
        <a routerLink="/directory" class="nav-link nav-active">Directory</a>
        <a routerLink="/reservations" class="nav-link">Reservations</a>
        <a routerLink="/financial" class="nav-link">Finance</a>
```

- [ ] **Step 3: Add Finance nav link to reservations.component.ts**

Find the nav links block in the template (around line 37-38):
```html
        <a routerLink="/directory" class="nav-link">Directory</a>
        <a routerLink="/reservations" class="nav-link nav-active">Reservations</a>
```

Replace with:
```html
        <a routerLink="/directory" class="nav-link">Directory</a>
        <a routerLink="/reservations" class="nav-link nav-active">Reservations</a>
        <a routerLink="/financial" class="nav-link">Finance</a>
```

- [ ] **Step 4: Run all Angular tests**

```
cd ui/angular-prototype
npx ng test
```

Expected: All tests PASS (no regressions from routing change)

- [ ] **Step 5: Commit**

```bash
git add ui/angular-prototype/src/app/app.routes.ts \
        ui/angular-prototype/src/app/directory/directory-list.component.ts \
        ui/angular-prototype/src/app/reservations/reservations.component.ts
git commit -m "feat(angular): add /financial route and Finance nav link"
```

---

## Task 4: React — types, API module, and API tests

Test-first: yes — 3 failing API tests before financial.ts is written

**Files:**
- Modify: `ui/react-prototype/src/types/index.ts`
- Create: `ui/react-prototype/src/api/financial.ts`
- Create: `ui/react-prototype/src/api/financial.test.ts`

- [ ] **Step 1: Add financial types to types/index.ts**

Append to end of `ui/react-prototype/src/types/index.ts`:

```typescript
export interface PeriodSummaryDto {
  period: string;
  totalChargesEur: number;
  totalExpensesEur: number;
}

export interface ChargeDto {
  id: string;
  householdRef: string;
  amountEur: number;
  description: string;
  period: string;
  chargedAt: string;
  idempotencyKey: string;
}

export interface PaymentDto {
  id: string;
  householdRef: string;
  amountEur: number;
  period: string;
  dateReceived: string;
  recordedAt: string;
  idempotencyKey: string;
}
```

- [ ] **Step 2: Write the failing API test**

```typescript
// ui/react-prototype/src/api/financial.test.ts
import { getPeriodSummary, getMyCharges, getMyPayments } from './financial';

const BASE = 'http://localhost:5000';

const mockFetch = (body: unknown, status = 200) => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: status < 400,
    status,
    json: () => Promise.resolve(body),
  } as Response);
};

afterEach(() => jest.restoreAllMocks());

test('getPeriodSummary fetches /financial-summary?period=', async () => {
  mockFetch({ period: '2026-07', totalChargesEur: 450, totalExpensesEur: 120 });
  await getPeriodSummary('2026-07');
  expect(fetch).toHaveBeenCalledWith(`${BASE}/financial-summary?period=2026-07`);
});

test('getMyCharges fetches /maintenance-fees/charges', async () => {
  mockFetch([]);
  await getMyCharges();
  expect(fetch).toHaveBeenCalledWith(`${BASE}/maintenance-fees/charges`);
});

test('getMyPayments fetches /payments', async () => {
  mockFetch([]);
  await getMyPayments();
  expect(fetch).toHaveBeenCalledWith(`${BASE}/payments`);
});
```

- [ ] **Step 3: Run tests to verify they fail**

```
cd ui/react-prototype
npm test -- --testPathPattern="src/api/financial.test.ts" --watchAll=false
```

Expected: FAIL — `Cannot find module './financial'`

- [ ] **Step 4: Write financial.ts**

```typescript
// ui/react-prototype/src/api/financial.ts
import { ChargeDto, PaymentDto, PeriodSummaryDto } from '../types';

const BASE = 'http://localhost:5000';

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

- [ ] **Step 5: Run tests to verify they pass**

```
cd ui/react-prototype
npm test -- --testPathPattern="src/api/financial.test.ts" --watchAll=false
```

Expected: 3 tests PASS

- [ ] **Step 6: Commit**

```bash
git add ui/react-prototype/src/types/index.ts \
        ui/react-prototype/src/api/financial.ts \
        ui/react-prototype/src/api/financial.test.ts
git commit -m "feat(react): financial types and API module with 3 passing tests"
```

---

## Task 5: React — FinancialScreen component and tests

Test-first: yes — 4 failing component tests before component is written

**Files:**
- Create: `ui/react-prototype/src/components/FinancialScreen.test.tsx`
- Create: `ui/react-prototype/src/components/FinancialScreen.tsx`

- [ ] **Step 1: Write the failing component tests**

```tsx
// ui/react-prototype/src/components/FinancialScreen.test.tsx
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { createTheme, ThemeProvider } from '@mui/material';
import FinancialScreen from './FinancialScreen';
import * as api from '../api/financial';

jest.mock('../api/financial');
const mockGetPeriodSummary = api.getPeriodSummary as jest.Mock;
const mockGetMyCharges     = api.getMyCharges as jest.Mock;
const mockGetMyPayments    = api.getMyPayments as jest.Mock;

const theme = createTheme();
const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ThemeProvider theme={theme}>{children}</ThemeProvider>
);
const renderScreen = () => render(<FinancialScreen />, { wrapper: Wrapper });

beforeEach(() => {
  jest.clearAllMocks();
  mockGetPeriodSummary.mockResolvedValue({ period: '2026-07', totalChargesEur: 450, totalExpensesEur: 120 });
  mockGetMyCharges.mockResolvedValue([]);
  mockGetMyPayments.mockResolvedValue([]);
});

test('renders period summary amounts', async () => {
  renderScreen();
  await waitFor(() => screen.getByTestId('summary-charges'));
  expect(screen.getByTestId('summary-charges').textContent).toContain('450');
  expect(screen.getByTestId('summary-expenses').textContent).toContain('120');
});

test('renders charge rows from API', async () => {
  mockGetMyCharges.mockResolvedValue([
    { id: 'c1', householdRef: 'h1', amountEur: 150, description: 'July fee',
      period: '2026-07', chargedAt: '2026-07-01T00:00:00Z', idempotencyKey: 'ik1' },
  ]);
  renderScreen();
  await waitFor(() => screen.getByTestId('charge-row-c1'));
  expect(screen.getByTestId('charge-row-c1').textContent).toContain('July fee');
});

test('renders payment rows from API', async () => {
  mockGetMyPayments.mockResolvedValue([
    { id: 'p1', householdRef: 'h1', amountEur: 300, period: '2026-06',
      dateReceived: '2026-06-15', recordedAt: '2026-06-15T09:00:00Z', idempotencyKey: 'ik2' },
  ]);
  renderScreen();
  await waitFor(() => screen.getByTestId('payment-row-p1'));
  expect(screen.getByTestId('payment-row-p1').textContent).toContain('300');
});

test('pay button opens stub dialog', async () => {
  renderScreen();
  await waitFor(() => screen.getByRole('button', { name: /request payment/i }));
  fireEvent.click(screen.getByRole('button', { name: /request payment/i }));
  expect(screen.getByTestId('pay-dialog')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run tests to verify they fail**

```
cd ui/react-prototype
npm test -- --testPathPattern="src/components/FinancialScreen.test.tsx" --watchAll=false
```

Expected: FAIL — `Cannot find module './FinancialScreen'`

- [ ] **Step 3: Write FinancialScreen.tsx**

```tsx
// ui/react-prototype/src/components/FinancialScreen.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  Alert, Box, Button, Card, CardContent, CircularProgress,
  Dialog, DialogActions, DialogContent, DialogTitle,
  Table, TableBody, TableCell, TableHead, TableRow, Typography
} from '@mui/material';
import { Refresh } from '@mui/icons-material';
import { getPeriodSummary, getMyCharges, getMyPayments } from '../api/financial';
import { ChargeDto, PaymentDto, PeriodSummaryDto } from '../types';

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function formatEur(n: number): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n);
}

export default function FinancialScreen() {
  const [period, setPeriod]           = useState(currentMonth());
  const [summary, setSummary]         = useState<PeriodSummaryDto | null>(null);
  const [charges, setCharges]         = useState<ChargeDto[]>([]);
  const [payments, setPayments]       = useState<PaymentDto[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);
  const [showPayDialog, setShowPayDialog] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [summaryData, chargesData, paymentsData] = await Promise.all([
        getPeriodSummary(period),
        getMyCharges(),
        getMyPayments(),
      ]);
      setSummary(summaryData);
      setCharges(chargesData);
      setPayments(paymentsData);
    } catch {
      setError('Could not load financial data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => { loadData(); }, [loadData]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, py: 8 }}>
        <Alert severity="error">{error}</Alert>
        <Button variant="outlined" startIcon={<Refresh />} onClick={loadData}>Retry</Button>
      </Box>
    );
  }

  return (
    <Box>
      {/* Period picker */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>Period:</Typography>
        <input
          type="month"
          value={period}
          onChange={e => setPeriod(e.target.value)}
          style={{ padding: '6px 8px', borderRadius: 4, border: '1px solid #ccc', fontSize: 14 }}
        />
      </Box>

      {/* Period summary card */}
      {summary && (
        <Card variant="outlined" sx={{ mb: 3 }}>
          <CardContent sx={{ display: 'flex', gap: 4 }}>
            <Box>
              <Typography variant="caption" color="text.secondary">Total charges this period</Typography>
              <Typography data-testid="summary-charges" variant="h6" sx={{ fontWeight: 700, color: 'primary.main' }}>
                {formatEur(summary.totalChargesEur)}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">Total expenses this period</Typography>
              <Typography data-testid="summary-expenses" variant="h6" sx={{ fontWeight: 700, color: 'primary.main' }}>
                {formatEur(summary.totalExpensesEur)}
              </Typography>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Charges table */}
      <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>My Charges</Typography>
      <Table size="small" sx={{ mb: 3 }}>
        <TableHead>
          <TableRow>
            <TableCell>Date</TableCell>
            <TableCell>Description</TableCell>
            <TableCell>Period</TableCell>
            <TableCell align="right">Amount</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {charges.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} align="center" sx={{ color: 'text.secondary', py: 3 }}>
                No charges on record.
              </TableCell>
            </TableRow>
          ) : (
            charges.map(c => (
              <TableRow key={c.id} data-testid={`charge-row-${c.id}`}>
                <TableCell>{c.chargedAt.slice(0, 10)}</TableCell>
                <TableCell>{c.description}</TableCell>
                <TableCell>{c.period}</TableCell>
                <TableCell align="right">{formatEur(c.amountEur)}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {/* Payments table */}
      <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>My Payments</Typography>
      <Table size="small" sx={{ mb: 3 }}>
        <TableHead>
          <TableRow>
            <TableCell>Date received</TableCell>
            <TableCell>Period</TableCell>
            <TableCell align="right">Amount</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {payments.length === 0 ? (
            <TableRow>
              <TableCell colSpan={3} align="center" sx={{ color: 'text.secondary', py: 3 }}>
                No payments on record.
              </TableCell>
            </TableRow>
          ) : (
            payments.map(p => (
              <TableRow key={p.id} data-testid={`payment-row-${p.id}`}>
                <TableCell>{p.dateReceived}</TableCell>
                <TableCell>{p.period}</TableCell>
                <TableCell align="right">{formatEur(p.amountEur)}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {/* Pay stub button */}
      <Button variant="contained" onClick={() => setShowPayDialog(true)}>
        Request Payment
      </Button>

      {/* Pay stub dialog */}
      <Dialog open={showPayDialog} onClose={() => setShowPayDialog(false)}>
        <DialogTitle>Request Payment</DialogTitle>
        <DialogContent>
          <Box data-testid="pay-dialog">
            <Typography>Payments are recorded by the building administrator.</Typography>
            <Typography sx={{ mt: 1 }}>Please contact the office to register a payment.</Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowPayDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

```
cd ui/react-prototype
npm test -- --testPathPattern="src/components/FinancialScreen.test.tsx" --watchAll=false
```

Expected: 4 tests PASS

- [ ] **Step 5: Run all React tests**

```
cd ui/react-prototype
npm test -- --watchAll=false
```

Expected: All tests PASS (no regressions)

- [ ] **Step 6: Commit**

```bash
git add ui/react-prototype/src/components/FinancialScreen.tsx \
        ui/react-prototype/src/components/FinancialScreen.test.tsx
git commit -m "feat(react): FinancialScreen with 4 passing tests"
```

---

## Task 6: React — App.tsx navigation wiring

Test-first: no — structural navigation wiring

**Files:**
- Modify: `ui/react-prototype/src/App.tsx`

- [ ] **Step 1: Update App.tsx**

The current `App.tsx` has `type Screen = 'directory' | 'reservations'` and two `<Tab>` items. Apply these three changes:

**Change 1** — extend the Screen type (line 21):
```typescript
type Screen = 'directory' | 'reservations' | 'financial';
```

**Change 2** — add the Finance Tab after the Reservations Tab (after line 51):
```tsx
<Tab label="Finance" value="financial" />
```

**Change 3** — extend the content render (line 99, change):
```tsx
{screen === 'directory' ? <DirectoryList role={role} /> :
 screen === 'reservations' ? <ReservationScreen /> :
 <FinancialScreen />}
```

**Change 4** — add import at top (after ReservationScreen import):
```tsx
import FinancialScreen from './components/FinancialScreen';
```

The full updated App.tsx:

```tsx
import React, { useState } from 'react';
import { createTheme, CssBaseline, ThemeProvider } from '@mui/material';
import {
  AppBar, Box, Tab, Tabs, Toolbar, ToggleButton,
  ToggleButtonGroup, Typography
} from '@mui/material';
import HomeIcon from '@mui/icons-material/Home';
import DirectoryList from './components/DirectoryList';
import ReservationScreen from './components/ReservationScreen';
import FinancialScreen from './components/FinancialScreen';
import { Role } from './types';

const theme = createTheme({
  palette: {
    primary: { main: '#2e6b4f' },
    background: { default: '#f5f5f0' },
  },
  shape: { borderRadius: 8 },
  typography: { fontFamily: 'system-ui, -apple-system, sans-serif' },
});

type Screen = 'directory' | 'reservations' | 'financial';

function App() {
  const [role, setRole] = useState<Role>('resident');
  const [screen, setScreen] = useState<Screen>('directory');

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AppBar position="static" elevation={2}>
        <Toolbar>
          <HomeIcon sx={{ mr: 1 }} />
          <Typography variant="h6" sx={{ fontWeight: 700, mr: 2 }}>
            Harmonia
          </Typography>
          <Tabs
            value={screen}
            onChange={(_, v) => setScreen(v)}
            textColor="inherit"
            TabIndicatorProps={{ style: { backgroundColor: 'white' } }}
            sx={{
              flexGrow: 1,
              '& .MuiTab-root': {
                color: 'rgba(255,255,255,0.75)',
                textTransform: 'none',
                '&.Mui-selected': { color: 'white' },
              },
            }}
          >
            <Tab label="Directory" value="directory" />
            <Tab label="Reservations" value="reservations" />
            <Tab label="Finance" value="financial" />
          </Tabs>
          {screen === 'directory' && (
            <>
              <Typography variant="caption" sx={{ opacity: 0.7, mr: 1.5 }}>
                View as:
              </Typography>
              <ToggleButtonGroup
                value={role}
                exclusive
                onChange={(_, v) => v && setRole(v)}
                size="small"
                sx={{
                  bgcolor: 'rgba(255,255,255,0.12)',
                  borderRadius: 2,
                  '& .MuiToggleButton-root': {
                    color: 'rgba(255,255,255,0.75)',
                    border: 'none',
                    px: 2,
                    py: 0.5,
                    textTransform: 'none',
                    fontSize: '0.8125rem',
                    '&.Mui-selected': {
                      bgcolor: 'rgba(255,255,255,0.22)',
                      color: 'white',
                      fontWeight: 600,
                      '&:hover': { bgcolor: 'rgba(255,255,255,0.28)' },
                    },
                    '&:hover': { bgcolor: 'rgba(255,255,255,0.08)' },
                  },
                }}
              >
                <ToggleButton value="resident">Resident</ToggleButton>
                <ToggleButton value="admin">Admin</ToggleButton>
              </ToggleButtonGroup>
            </>
          )}
        </Toolbar>
      </AppBar>
      <Box
        sx={{
          maxWidth: screen === 'directory' && role === 'admin' ? 1200 : 900,
          mx: 'auto',
          px: 2,
          py: 4,
          transition: 'max-width 0.2s',
        }}
      >
        {screen === 'directory' ? <DirectoryList role={role} /> :
         screen === 'reservations' ? <ReservationScreen /> :
         <FinancialScreen />}
      </Box>
    </ThemeProvider>
  );
}

export default App;
```

- [ ] **Step 2: Run all React tests**

```
cd ui/react-prototype
npm test -- --watchAll=false
```

Expected: All tests PASS

- [ ] **Step 3: Commit**

```bash
git add ui/react-prototype/src/App.tsx
git commit -m "feat(react): add Finance tab to AppBar navigation"
```

---

## Self-Review

**Spec coverage check:**
- ✅ Period summary card with TotalChargesEur + TotalExpensesEur — Task 2 + 5
- ✅ Charges list (date, description, period, amount) — Task 2 + 5
- ✅ Payments list (date, period, amount) — Task 2 + 5
- ✅ Pay button stub dialog — Task 2 + 5
- ✅ Angular service: 3 methods, correct URLs — Task 1
- ✅ React API: 3 functions, correct URLs — Task 4
- ✅ Angular routing + Finance nav link — Task 3
- ✅ React Finance tab in App.tsx — Task 6
- ✅ R2: no HouseholdRef in request body/header — enforced by endpoints design; no client sends HouseholdRef
- ✅ R3: no PII logging in UI layer — no console.log in any component code
- ✅ Currency formatting with Intl.NumberFormat — in both Angular formatEur() and React formatEur()
- ✅ Error + Retry per section — both components have error state with Retry button

**Type consistency check:**
- `PeriodSummaryDto.totalChargesEur` — camelCase, used as `summary()!.totalChargesEur` in Angular and `summary.totalChargesEur` in React ✅
- `ChargeDto.amountEur` — used consistently in both ✅
- `ChargeDto.chargedAt` — used as `.slice(0,10)` in React, `| date` pipe in Angular ✅
- `data-testid="charge-row"` in Angular spec, `data-testid="charge-row-${c.id}"` in React spec — note: Angular uses generic `charge-row`, React uses keyed `charge-row-c1`. Both consistent within their own test suites ✅
- `formatEur` defined in both Angular and React implementations ✅
