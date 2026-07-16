# BBQ Reservation Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the BBQ reservation screen (date picker + slot grid + claim flow) in Angular (PrimeNG 22) and React (MUI 9) with matching feature parity and component tests.

**Architecture:** Thin service/API layer → stateful component with signals (Angular) or hooks (React). No identity in request body (R2). Slot state rendered from server response only.

**Tech Stack:** Angular 21 + PrimeNG 22 (Vitest via @angular/build:unit-test); React 19 + MUI 9 (Jest + RTL via react-scripts); API base `http://localhost:5000`.

---

## Task 1: Angular — Install Vitest and wire test target

**Files:**
- Modify: `ui/angular-prototype/package.json` (add vitest devDep)
- Modify: `ui/angular-prototype/angular.json` (add test target)
- `tsconfig.spec.json` already has `"types": ["vitest/globals"]` — no change needed

- [ ] **Step 1: Install vitest**

```bash
cd ui/angular-prototype
npm install -D vitest
```

- [ ] **Step 2: Add test target to angular.json**

In `ui/angular-prototype/angular.json`, inside `"architect"` (after the `"serve"` block), add:

```json
"test": {
  "builder": "@angular/build:unit-test",
  "options": {
    "buildTarget": "angular-prototype:build",
    "runner": "vitest"
  }
}
```

- [ ] **Step 3: Verify the runner resolves**

Run: `cd ui/angular-prototype && npx ng test --watch=false --no-progress 2>&1 | head -20`
Expected: Output mentions vitest or "no spec files found" — NOT a "runner not found" error.

- [ ] **Step 4: Commit**

```bash
cd ui/angular-prototype
git add package.json package-lock.json angular.json
git commit -m "test(angular): wire vitest via @angular/build:unit-test"
```

---

## Task 2: Angular — Types and service

**Files:**
- Create: `ui/angular-prototype/src/app/reservations/models.ts`
- Create: `ui/angular-prototype/src/app/reservations/reservations.service.ts`

- [ ] **Step 1: Write the failing test for ReservationsService**

Create `ui/angular-prototype/src/app/reservations/reservations.service.spec.ts`:

```typescript
import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { ReservationsService } from './reservations.service';
import { DaySlotsResponse } from './models';

describe('ReservationsService', () => {
  let service: ReservationsService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ReservationsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('getSlots calls GET /days/{day}/slots', () => {
    const expected: DaySlotsResponse = {
      day: '2026-07-16',
      slots: [{ slotKey: 'morning', state: 'free' }],
    };
    let result: DaySlotsResponse | undefined;
    service.getSlots('2026-07-16').subscribe(r => (result = r));
    const req = http.expectOne('http://localhost:5000/days/2026-07-16/slots');
    expect(req.request.method).toBe('GET');
    req.flush(expected);
    expect(result).toEqual(expected);
  });

  it('claimSlot calls POST /days/{day}/slots/{slotKey}/claim', () => {
    let result: { outcome: string } | undefined;
    service.claimSlot('2026-07-16', 'morning').subscribe(r => (result = r));
    const req = http.expectOne('http://localhost:5000/days/2026-07-16/slots/morning/claim');
    expect(req.request.method).toBe('POST');
    req.flush({ outcome: 'confirmed-yours' });
    expect(result?.outcome).toBe('confirmed-yours');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ui/angular-prototype && npx ng test --watch=false --no-progress 2>&1 | tail -20`
Expected: FAIL — `Cannot find module './reservations.service'`

- [ ] **Step 3: Create models.ts**

Create `ui/angular-prototype/src/app/reservations/models.ts`:

```typescript
export type SlotState = 'free' | 'taken-mine' | 'taken-other';

export interface Slot {
  slotKey: string;
  state: SlotState;
}

export interface DaySlotsResponse {
  day: string;
  slots: Slot[];
}

export interface ClaimResponse {
  outcome: 'confirmed-yours' | 'refused-already-taken' | 'couldnt-confirm';
}
```

- [ ] **Step 4: Create reservations.service.ts**

Create `ui/angular-prototype/src/app/reservations/reservations.service.ts`:

```typescript
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ClaimResponse, DaySlotsResponse } from './models';

const API = 'http://localhost:5000';

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

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd ui/angular-prototype && npx ng test --watch=false --no-progress 2>&1 | tail -20`
Expected: PASS — 2 specs, 0 failures

- [ ] **Step 6: Commit**

```bash
cd ui/angular-prototype
git add src/app/reservations/models.ts src/app/reservations/reservations.service.ts src/app/reservations/reservations.service.spec.ts
git commit -m "feat(angular): ReservationsService with getSlots and claimSlot"
```

---

## Task 3: Angular — ReservationsComponent (slot grid + claim flow)

**Files:**
- Create: `ui/angular-prototype/src/app/reservations/reservations.component.ts`
- Create: `ui/angular-prototype/src/app/reservations/reservations.component.spec.ts`

- [ ] **Step 1: Write failing tests**

Create `ui/angular-prototype/src/app/reservations/reservations.component.spec.ts`:

```typescript
import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ReservationsComponent } from './reservations.component';
import { ReservationsService } from './reservations.service';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { of, throwError } from 'rxjs';
import { provideRouter } from '@angular/router';

const mockService = () => ({
  getSlots: vi.fn(),
  claimSlot: vi.fn(),
});

describe('ReservationsComponent', () => {
  let service: ReturnType<typeof mockService>;

  const setup = async () => {
    service = mockService();
    await TestBed.configureTestingModule({
      imports: [ReservationsComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ReservationsService, useValue: service },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(ReservationsComponent);
    fixture.detectChanges();
    return fixture;
  };

  it('renders slot cards from API response', fakeAsync(async () => {
    service.getSlots.mockReturnValue(of({
      day: '2026-07-16',
      slots: [
        { slotKey: 'morning', state: 'free' },
        { slotKey: 'afternoon', state: 'taken-mine' },
        { slotKey: 'evening', state: 'taken-other' },
      ],
    }));
    const fixture = await setup();
    tick();
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelectorAll('[data-testid="slot-card"]').length).toBe(3);
    expect(el.querySelector('[data-testid="slot-card"][data-state="free"]')).not.toBeNull();
    expect(el.querySelector('[data-testid="slot-card"][data-state="taken-mine"]')).not.toBeNull();
  }));

  it('claim happy path flips slot to taken-mine and shows success', fakeAsync(async () => {
    service.getSlots.mockReturnValue(of({
      day: '2026-07-16',
      slots: [{ slotKey: 'morning', state: 'free' }],
    }));
    service.claimSlot.mockReturnValue(of({ outcome: 'confirmed-yours' }));
    const fixture = await setup();
    tick();
    fixture.detectChanges();
    const btn = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('[data-testid="claim-btn"]');
    btn?.click();
    tick();
    fixture.detectChanges();
    const card = (fixture.nativeElement as HTMLElement).querySelector('[data-testid="slot-card"]');
    expect(card?.getAttribute('data-state')).toBe('taken-mine');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('confirmed');
  }));

  it('conflict (409) flips slot to taken-other', fakeAsync(async () => {
    service.getSlots.mockReturnValue(of({
      day: '2026-07-16',
      slots: [{ slotKey: 'morning', state: 'free' }],
    }));
    service.claimSlot.mockReturnValue(of({ outcome: 'refused-already-taken' }));
    const fixture = await setup();
    tick();
    fixture.detectChanges();
    const btn = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('[data-testid="claim-btn"]');
    btn?.click();
    tick();
    fixture.detectChanges();
    const card = (fixture.nativeElement as HTMLElement).querySelector('[data-testid="slot-card"]');
    expect(card?.getAttribute('data-state')).toBe('taken-other');
  }));

  it('API error shows error state', fakeAsync(async () => {
    service.getSlots.mockReturnValue(throwError(() => new Error('Network error')));
    const fixture = await setup();
    tick();
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="error-state"]')).not.toBeNull();
    expect(el.querySelector('[data-testid="retry-btn"]')).not.toBeNull();
  }));
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd ui/angular-prototype && npx ng test --watch=false --no-progress 2>&1 | tail -20`
Expected: FAIL — `Cannot find module './reservations.component'`

- [ ] **Step 3: Create reservations.component.ts**

Create `ui/angular-prototype/src/app/reservations/reservations.component.ts`:

```typescript
import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { ToastModule } from 'primeng/toast';
import { TagModule } from 'primeng/tag';
import { DatePicker } from 'primeng/datepicker';
import { MessageService } from 'primeng/api';
import { ReservationsService } from './reservations.service';
import { Slot } from './models';

@Component({
  selector: 'app-reservations',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    CardModule,
    ButtonModule,
    ProgressSpinnerModule,
    ToastModule,
    TagModule,
    DatePicker,
  ],
  providers: [MessageService],
  template: `
    <p-toast />
    <div class="harmonia-shell">
      <header class="harmonia-header">
        <span class="harmonia-logo">🏡 Harmonia</span>
        <span class="harmonia-subtitle">Resident Portal</span>
        <div class="flex-spacer"></div>
        <a routerLink="/directory" class="nav-link">Directory</a>
        <a routerLink="/reservations" class="nav-link nav-active">Reservations</a>
      </header>

      <main class="harmonia-content">
        <p-card>
          <ng-template #title>BBQ Reservations</ng-template>
          <ng-template #content>

            <div class="date-row">
              <label class="date-label">Select date:</label>
              <p-datepicker
                [(ngModel)]="selectedDate"
                [minDate]="today"
                dateFormat="yy-mm-dd"
                [showIcon]="true"
                (ngModelChange)="onDateChange($event)"
              />
            </div>

            @if (loading()) {
              <div class="center-state">
                <p-progressspinner strokeWidth="4" [style]="{width:'48px',height:'48px'}" />
              </div>
            }

            @if (error() && !loading()) {
              <div class="center-state" data-testid="error-state">
                <p class="error-msg">{{ error() }}</p>
                <p-button
                  label="Retry"
                  icon="pi pi-refresh"
                  severity="secondary"
                  data-testid="retry-btn"
                  (click)="loadSlots()"
                />
              </div>
            }

            @if (!loading() && !error() && slots().length > 0) {
              <div class="slot-grid">
                @for (slot of slots(); track slot.slotKey) {
                  <div
                    class="slot-card slot-{{ slot.state }}"
                    [attr.data-testid]="'slot-card'"
                    [attr.data-state]="slot.state"
                  >
                    <div class="slot-key">{{ slot.slotKey }}</div>
                    <p-tag
                      [value]="stateLabel(slot.state)"
                      [severity]="stateSeverity(slot.state)"
                    />
                    @if (slot.state === 'free') {
                      <p-button
                        label="Claim"
                        size="small"
                        data-testid="claim-btn"
                        [loading]="claimInFlight() === slot.slotKey"
                        (click)="claim(slot.slotKey)"
                      />
                    }
                  </div>
                }
              </div>
            }

            @if (!loading() && !error() && slots().length === 0 && selectedDate) {
              <p class="no-slots">No slots available for this day.</p>
            }

          </ng-template>
        </p-card>
      </main>
    </div>
  `,
  styles: [`
    .harmonia-shell { min-height: 100vh; background: #f5f5f0; }
    .harmonia-header {
      display: flex; align-items: center; gap: 12px;
      background: #2e6b4f; color: white; padding: 12px 24px;
    }
    .harmonia-logo { font-size: 1.25rem; font-weight: 700; }
    .harmonia-subtitle { opacity: .7; font-size: .85rem; }
    .flex-spacer { flex: 1; }
    .nav-link { color: rgba(255,255,255,.75); text-decoration: none; padding: 6px 12px; border-radius: 6px; font-size: .875rem; }
    .nav-link:hover { background: rgba(255,255,255,.1); }
    .nav-active { background: rgba(255,255,255,.22); color: white; font-weight: 600; }
    .harmonia-content { max-width: 900px; margin: 0 auto; padding: 32px 16px; }
    .date-row { display: flex; align-items: center; gap: 12px; margin-bottom: 24px; }
    .date-label { font-weight: 500; }
    .slot-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 12px; margin-top: 8px; }
    .slot-card { background: white; border-radius: 8px; padding: 16px; display: flex; flex-direction: column; gap: 8px; box-shadow: 0 1px 3px rgba(0,0,0,.08); }
    .slot-free { border-left: 4px solid #2e6b4f; }
    .slot-taken-mine { border-left: 4px solid #1976d2; }
    .slot-taken-other { border-left: 4px solid #9e9e9e; }
    .slot-key { font-weight: 600; text-transform: capitalize; }
    .center-state { display: flex; flex-direction: column; align-items: center; gap: 16px; padding: 48px 0; }
    .error-msg { color: #d32f2f; }
    .no-slots { color: #757575; text-align: center; padding: 32px 0; }
  `],
})
export class ReservationsComponent implements OnInit {
  private readonly svc = inject(ReservationsService);
  private readonly msg = inject(MessageService);

  readonly today = new Date();
  selectedDate: Date = new Date();

  readonly slots = signal<Slot[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly claimInFlight = signal<string | null>(null);

  private currentDay(): string {
    const d = this.selectedDate ?? this.today;
    return d.toISOString().slice(0, 10);
  }

  ngOnInit(): void {
    this.loadSlots();
  }

  loadSlots(): void {
    this.loading.set(true);
    this.error.set(null);
    this.svc.getSlots(this.currentDay()).subscribe({
      next: r => {
        this.slots.set(r.slots);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Could not load slots. Check your connection and try again.');
        this.loading.set(false);
      },
    });
  }

  onDateChange(_date: Date): void {
    this.loadSlots();
  }

  claim(slotKey: string): void {
    this.claimInFlight.set(slotKey);
    this.svc.claimSlot(this.currentDay(), slotKey).subscribe({
      next: r => {
        this.claimInFlight.set(null);
        if (r.outcome === 'confirmed-yours') {
          this.slots.update(list =>
            list.map(s => s.slotKey === slotKey ? { ...s, state: 'taken-mine' } : s)
          );
          this.msg.add({ severity: 'success', summary: 'Booking confirmed', detail: `Slot "${slotKey}" is now yours.` });
        } else if (r.outcome === 'refused-already-taken') {
          this.slots.update(list =>
            list.map(s => s.slotKey === slotKey ? { ...s, state: 'taken-other' } : s)
          );
          this.msg.add({ severity: 'warn', summary: 'Slot taken', detail: 'Someone else just claimed this slot.' });
        } else {
          this.msg.add({ severity: 'error', summary: 'Could not confirm', detail: 'Please try again in a moment.' });
        }
      },
      error: () => {
        this.claimInFlight.set(null);
        this.msg.add({ severity: 'error', summary: 'Error', detail: 'Could not reach the server. Please try again.' });
      },
    });
  }

  stateLabel(state: string): string {
    return state === 'free' ? 'Free' : state === 'taken-mine' ? 'Yours' : 'Taken';
  }

  stateSeverity(state: string): 'success' | 'info' | 'secondary' {
    return state === 'free' ? 'success' : state === 'taken-mine' ? 'info' : 'secondary';
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd ui/angular-prototype && npx ng test --watch=false --no-progress 2>&1 | tail -30`
Expected: PASS — 6 specs, 0 failures

- [ ] **Step 5: Commit**

```bash
cd ui/angular-prototype
git add src/app/reservations/
git commit -m "feat(angular): ReservationsComponent — slot grid, date picker, claim flow"
```

---

## Task 4: Angular — Routing and navigation

**Files:**
- Modify: `ui/angular-prototype/src/app/app.routes.ts`
- Modify: `ui/angular-prototype/src/app/app.ts` (add nav links to `directory-list.component.ts` header area)
- Modify: `ui/angular-prototype/src/app/directory/directory-list.component.ts` (add nav links in header)

- [ ] **Step 1: Add reservations route**

Edit `ui/angular-prototype/src/app/app.routes.ts`:

```typescript
import { Routes } from '@angular/router';
import { DirectoryListComponent } from './directory/directory-list.component';
import { ReservationsComponent } from './reservations/reservations.component';

export const routes: Routes = [
  { path: '', redirectTo: 'directory', pathMatch: 'full' },
  { path: 'directory', component: DirectoryListComponent },
  { path: 'reservations', component: ReservationsComponent },
];
```

- [ ] **Step 2: Add nav links to directory-list header**

In `ui/angular-prototype/src/app/directory/directory-list.component.ts`, add `RouterModule` to the imports array, then in the template, update the `<header class="harmonia-header">` section to include nav links after `<div class="flex-spacer"></div>` and before the role toggle:

```html
<a routerLink="/directory" class="nav-link nav-active">Directory</a>
<a routerLink="/reservations" class="nav-link">Reservations</a>
```

Add to styles:
```css
.nav-link { color: rgba(255,255,255,.75); text-decoration:none; padding:6px 12px; border-radius:6px; font-size:.875rem; }
.nav-link:hover { background: rgba(255,255,255,.1); }
.nav-active { background: rgba(255,255,255,.22); color:white; font-weight:600; }
```

- [ ] **Step 3: Build to verify no compile errors**

Run: `cd ui/angular-prototype && npx ng build 2>&1 | tail -10`
Expected: Build succeeds, "Application bundle generation complete"

- [ ] **Step 4: Commit**

```bash
cd ui/angular-prototype
git add src/app/app.routes.ts src/app/directory/directory-list.component.ts
git commit -m "feat(angular): add /reservations route and nav links"
```

---

## Task 5: React — Types and API service

**Files:**
- Modify: `ui/react-prototype/src/types/index.ts`
- Create: `ui/react-prototype/src/api/reservations.ts`

- [ ] **Step 1: Write failing test for the API service**

Create `ui/react-prototype/src/api/reservations.test.ts`:

```typescript
import { getSlots, claimSlot } from './reservations';

const BASE = 'http://localhost:5000';

const mockFetch = (body: unknown, status = 200) => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: status < 400,
    status,
    json: () => Promise.resolve(body),
  } as Response);
};

afterEach(() => jest.restoreAllMocks());

test('getSlots fetches correct URL', async () => {
  mockFetch({ day: '2026-07-16', slots: [] });
  await getSlots('2026-07-16');
  expect(fetch).toHaveBeenCalledWith(`${BASE}/days/2026-07-16/slots`);
});

test('claimSlot POSTs correct URL with no body', async () => {
  mockFetch({ outcome: 'confirmed-yours' });
  await claimSlot('2026-07-16', 'morning');
  expect(fetch).toHaveBeenCalledWith(
    `${BASE}/days/2026-07-16/slots/morning/claim`,
    expect.objectContaining({ method: 'POST' })
  );
});

test('claimSlot returns outcome on 409', async () => {
  mockFetch({ outcome: 'refused-already-taken' }, 409);
  const result = await claimSlot('2026-07-16', 'morning');
  expect(result.outcome).toBe('refused-already-taken');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ui/react-prototype && npm test -- --testPathPattern=reservations.test --watchAll=false 2>&1 | tail -15`
Expected: FAIL — `Cannot find module './reservations'`

- [ ] **Step 3: Add reservation types to index.ts**

Add to the end of `ui/react-prototype/src/types/index.ts`:

```typescript
export type SlotState = 'free' | 'taken-mine' | 'taken-other';

export interface Slot {
  slotKey: string;
  state: SlotState;
}

export interface DaySlotsResponse {
  day: string;
  slots: Slot[];
}

export interface ClaimResponse {
  outcome: 'confirmed-yours' | 'refused-already-taken' | 'couldnt-confirm';
}
```

- [ ] **Step 4: Create reservations.ts API service**

Create `ui/react-prototype/src/api/reservations.ts`:

```typescript
import { ClaimResponse, DaySlotsResponse } from '../types';

const BASE = 'http://localhost:5000';

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

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd ui/react-prototype && npm test -- --testPathPattern=reservations.test --watchAll=false 2>&1 | tail -15`
Expected: PASS — 3 tests passed

- [ ] **Step 6: Commit**

```bash
cd ui/react-prototype
git add src/types/index.ts src/api/reservations.ts src/api/reservations.test.ts
git commit -m "feat(react): reservation types and API service"
```

---

## Task 6: React — ReservationScreen component

**Files:**
- Create: `ui/react-prototype/src/components/ReservationScreen.tsx`
- Create: `ui/react-prototype/src/components/ReservationScreen.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `ui/react-prototype/src/components/ReservationScreen.test.tsx`:

```tsx
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { createTheme, ThemeProvider } from '@mui/material';
import ReservationScreen from './ReservationScreen';
import * as api from '../api/reservations';

jest.mock('../api/reservations');
const mockGetSlots = api.getSlots as jest.Mock;
const mockClaimSlot = api.claimSlot as jest.Mock;

const theme = createTheme();
const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ThemeProvider theme={theme}>{children}</ThemeProvider>
);
const renderScreen = () => render(<ReservationScreen />, { wrapper: Wrapper });

beforeEach(() => jest.clearAllMocks());

test('renders free, taken-mine, and taken-other slot cards', async () => {
  mockGetSlots.mockResolvedValue({
    day: '2026-07-16',
    slots: [
      { slotKey: 'morning', state: 'free' },
      { slotKey: 'afternoon', state: 'taken-mine' },
      { slotKey: 'evening', state: 'taken-other' },
    ],
  });
  renderScreen();
  await waitFor(() => expect(screen.getByText('morning')).toBeInTheDocument());
  expect(screen.getByText('afternoon')).toBeInTheDocument();
  expect(screen.getByText('evening')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /claim/i })).toBeInTheDocument();
  expect(screen.queryAllByRole('button', { name: /claim/i }).length).toBe(1);
});

test('claim happy path shows success and slot becomes Yours', async () => {
  mockGetSlots.mockResolvedValue({
    day: '2026-07-16',
    slots: [{ slotKey: 'morning', state: 'free' }],
  });
  mockClaimSlot.mockResolvedValue({ outcome: 'confirmed-yours' });
  renderScreen();
  await waitFor(() => screen.getByRole('button', { name: /claim/i }));
  fireEvent.click(screen.getByRole('button', { name: /claim/i }));
  await waitFor(() => expect(screen.getByText(/confirmed/i)).toBeInTheDocument());
  expect(screen.queryByRole('button', { name: /claim/i })).not.toBeInTheDocument();
});

test('conflict (409) shows warning and slot becomes taken-other', async () => {
  mockGetSlots.mockResolvedValue({
    day: '2026-07-16',
    slots: [{ slotKey: 'morning', state: 'free' }],
  });
  mockClaimSlot.mockResolvedValue({ outcome: 'refused-already-taken' });
  renderScreen();
  await waitFor(() => screen.getByRole('button', { name: /claim/i }));
  fireEvent.click(screen.getByRole('button', { name: /claim/i }));
  await waitFor(() => expect(screen.getByText(/taken/i)).toBeInTheDocument());
  expect(screen.queryByRole('button', { name: /claim/i })).not.toBeInTheDocument();
});

test('API error shows retry button', async () => {
  mockGetSlots.mockRejectedValue(new Error('Network error'));
  renderScreen();
  await waitFor(() => screen.getByRole('button', { name: /retry/i }));
  expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd ui/react-prototype && npm test -- --testPathPattern=ReservationScreen.test --watchAll=false 2>&1 | tail -15`
Expected: FAIL — `Cannot find module './ReservationScreen'`

- [ ] **Step 3: Create ReservationScreen.tsx**

Create `ui/react-prototype/src/components/ReservationScreen.tsx`:

```tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  Alert, Box, Button, Card, CardContent, Chip,
  CircularProgress, Snackbar, Typography
} from '@mui/material';
import { Refresh } from '@mui/icons-material';
import { getSlots, claimSlot } from '../api/reservations';
import { Slot, SlotState } from '../types';

function todayString(): string {
  return new Date().toISOString().slice(0, 10);
}

interface Feedback {
  msg: string;
  severity: 'success' | 'warning' | 'error';
}

export default function ReservationScreen() {
  const [day, setDay] = useState(todayString());
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [claimInFlight, setClaimInFlight] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const loadSlots = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await getSlots(day);
      setSlots(r.slots);
    } catch {
      setError('Could not load slots. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, [day]);

  useEffect(() => { loadSlots(); }, [loadSlots]);

  const handleClaim = async (slotKey: string) => {
    setClaimInFlight(slotKey);
    try {
      const r = await claimSlot(day, slotKey);
      if (r.outcome === 'confirmed-yours') {
        setSlots(prev => prev.map(s => s.slotKey === slotKey ? { ...s, state: 'taken-mine' } : s));
        setFeedback({ msg: `Slot "${slotKey}" confirmed — it's yours!`, severity: 'success' });
      } else if (r.outcome === 'refused-already-taken') {
        setSlots(prev => prev.map(s => s.slotKey === slotKey ? { ...s, state: 'taken-other' } : s));
        setFeedback({ msg: 'Slot already taken by someone else.', severity: 'warning' });
      } else {
        setFeedback({ msg: 'Could not confirm booking. Please try again.', severity: 'error' });
      }
    } catch {
      setFeedback({ msg: 'Network error. Please try again.', severity: 'error' });
    } finally {
      setClaimInFlight(null);
    }
  };

  return (
    <Box>
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>Select date:</Typography>
        <input
          type="date"
          value={day}
          min={todayString()}
          onChange={e => setDay(e.target.value)}
          style={{ padding: '6px 8px', borderRadius: 4, border: '1px solid #ccc', fontSize: 14 }}
        />
      </Box>

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      )}

      {error && !loading && (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, py: 6 }}>
          <Alert severity="error">{error}</Alert>
          <Button variant="outlined" startIcon={<Refresh />} onClick={loadSlots}>
            Retry
          </Button>
        </Box>
      )}

      {!loading && !error && (
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px,1fr))', gap: 1.5 }}>
          {slots.map(slot => (
            <SlotCard
              key={slot.slotKey}
              slot={slot}
              onClaim={handleClaim}
              loading={claimInFlight === slot.slotKey}
            />
          ))}
          {slots.length === 0 && (
            <Typography color="text.secondary" sx={{ gridColumn: '1/-1', textAlign: 'center', py: 4 }}>
              No slots available for this day.
            </Typography>
          )}
        </Box>
      )}

      <Snackbar
        open={feedback !== null}
        autoHideDuration={4000}
        onClose={() => setFeedback(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={feedback?.severity} onClose={() => setFeedback(null)}>
          {feedback?.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
}

function stateColor(state: SlotState): 'success' | 'primary' | 'default' {
  return state === 'free' ? 'success' : state === 'taken-mine' ? 'primary' : 'default';
}

function stateLabel(state: SlotState): string {
  return state === 'free' ? 'Free' : state === 'taken-mine' ? 'Yours' : 'Taken';
}

function SlotCard({ slot, onClaim, loading }: {
  slot: Slot;
  onClaim: (key: string) => void;
  loading: boolean;
}) {
  return (
    <Card
      variant="outlined"
      sx={{
        borderLeft: 4,
        borderLeftColor: slot.state === 'free' ? 'success.main' : slot.state === 'taken-mine' ? 'primary.main' : 'grey.400',
      }}
    >
      <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 1, pb: '12px !important' }}>
        <Typography variant="subtitle2" sx={{ textTransform: 'capitalize', fontWeight: 600 }}>
          {slot.slotKey}
        </Typography>
        <Chip label={stateLabel(slot.state)} color={stateColor(slot.state)} size="small" />
        {slot.state === 'free' && (
          <Button
            variant="contained"
            size="small"
            disabled={loading}
            onClick={() => onClaim(slot.slotKey)}
            sx={{ mt: 0.5 }}
          >
            {loading ? 'Claiming…' : 'Claim'}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd ui/react-prototype && npm test -- --testPathPattern=ReservationScreen.test --watchAll=false 2>&1 | tail -20`
Expected: PASS — 4 tests passed

- [ ] **Step 5: Commit**

```bash
cd ui/react-prototype
git add src/components/ReservationScreen.tsx src/components/ReservationScreen.test.tsx
git commit -m "feat(react): ReservationScreen — slot grid, date input, claim flow"
```

---

## Task 7: React — Navigation to Reservations screen

**Files:**
- Modify: `ui/react-prototype/src/App.tsx`

- [ ] **Step 1: Add screen toggle for Reservations in App.tsx**

Replace the contents of `ui/react-prototype/src/App.tsx`. The new version:
- Adds `screen` state: `'directory' | 'reservations'`
- Uses MUI `Tabs` in the `AppBar` `Toolbar` for screen switching
- Role toggle is shown only when `screen === 'directory'`
- Renders either `<DirectoryList role={role} />` or `<ReservationScreen />` based on `screen`

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
import { Role } from './types';

const theme = createTheme({
  palette: {
    primary: { main: '#2e6b4f' },
    background: { default: '#f5f5f0' },
  },
  shape: { borderRadius: 8 },
  typography: { fontFamily: 'system-ui, -apple-system, sans-serif' },
});

type Screen = 'directory' | 'reservations';

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
            sx={{ flexGrow: 1, '& .MuiTab-root': { color: 'rgba(255,255,255,0.75)', textTransform: 'none', '&.Mui-selected': { color: 'white' } } }}
          >
            <Tab label="Directory" value="directory" />
            <Tab label="Reservations" value="reservations" />
          </Tabs>
          {screen === 'directory' && (
            <>
              <Typography variant="caption" sx={{ opacity: 0.7, mr: 1.5 }}>View as:</Typography>
              <ToggleButtonGroup
                value={role}
                exclusive
                onChange={(_, v) => v && setRole(v)}
                size="small"
                sx={{
                  bgcolor: 'rgba(255,255,255,0.12)',
                  borderRadius: 2,
                  '& .MuiToggleButton-root': {
                    color: 'rgba(255,255,255,0.75)', border: 'none', px: 2, py: 0.5,
                    textTransform: 'none', fontSize: '0.8125rem',
                    '&.Mui-selected': { bgcolor: 'rgba(255,255,255,0.22)', color: 'white', fontWeight: 600 },
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
          mx: 'auto', px: 2, py: 4, transition: 'max-width 0.2s',
        }}
      >
        {screen === 'directory' ? <DirectoryList role={role} /> : <ReservationScreen />}
      </Box>
    </ThemeProvider>
  );
}

export default App;
```

- [ ] **Step 2: Run all React tests to confirm no regressions**

Run: `cd ui/react-prototype && npm test -- --watchAll=false 2>&1 | tail -20`
Expected: All tests pass (the old App.test.tsx may still fail on "learn react" — that is a pre-existing broken placeholder, not a regression from this task)

- [ ] **Step 3: Commit**

```bash
cd ui/react-prototype
git add src/App.tsx
git commit -m "feat(react): add Reservations tab to AppBar navigation"
```

---

## Self-Review

**Spec coverage check:**
- AC1 (date picker → fetch slots): Task 3 (Angular DatePicker + ngModelChange), Task 6 (React date input + useEffect)
- AC2 (slot grid with three visual states): Task 3 slot grid + p-tag, Task 6 SlotCard + Chip
- AC3 (claim + outcomes): Task 3 `claim()` method, Task 6 `handleClaim()`
- AC4 (loading indicator): Task 3 p-progressspinner + loading signal, Task 6 CircularProgress
- AC5 (error state + Retry): Task 3 error signal + retry button, Task 6 Alert + Retry Button
- AC6 (both frameworks, AC-parity): Tasks 1-4 Angular, Tasks 5-7 React
- AC7 (component tests): Task 2 service spec, Task 3 component spec (Angular), Task 5 API test, Task 6 component test (React)
- AC8 (default today, no past dates): Task 3 `selectedDate = new Date()`, `[minDate]="today"`, Task 7 `todayString()` for `min=`
- AC9 (navigation): Task 4 Angular routing + nav links, Task 7 React Tabs

**R2 (no householdRef in request):** Both `claimSlot` implementations send only day + slotKey as path params with no request body. Confirmed.

**R3 (no PII logged):** No `console.log` of response bodies or `householdRef` values in any component. Confirmed.
