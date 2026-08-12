# Finance Screen Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganize the admin finance screen into tabs (Bills default, then Fees / Payments / Report), with bill entry (scan + manual, merged into one form) at the top of the Bills tab, in both the React and Angular apps, leaving the resident view unchanged.

**Architecture:** Split each app's single large finance component into a thin shell (persistent period-summary bar + role branch + tab container) plus one focused component per tab and one resident component. The scan and manual expense forms — today two near-identical forms — merge into a single expense form that the scanner prefills. No backend, DTO, or API changes.

**Tech Stack:** React 18 + MUI 9 (`Tabs`/`Tab`), Angular 20 + PrimeNG 22 (`p-tabs`), `@ngx-translate` / `react-i18next` for i18n (bg default, ru, en). Jest + Testing Library (React), Karma/Jasmine (Angular).

---

## Reference: current source

- React: `ui/react/src/components/FinancialScreen.tsx` (~680 lines, one component, `role` prop). Test: `ui/react/src/components/FinancialScreen.test.tsx`.
- Angular: `ui/angular/src/app/financial/financial.component.ts` (~870 lines, inline template + styles, `role` field). Test: `ui/angular/src/app/financial/financial.component.spec.ts`.
- React API modules (reused unchanged): `api/financial`, `api/maintenanceFees`, `api/expenses`, `api/payments`.
- Angular services (reused unchanged): `FinancialService`, `MaintenanceFeeService`, `ExpenseService`, `PaymentService`.
- i18n files: `ui/react/src/i18n/locales/{bg,en,ru}.json`, `ui/angular/public/assets/i18n/{bg,en,ru}.json`.

## Build / test commands

- React: `cd ui/react && npm test -- --watchAll=false` (single run). Type check: `cd ui/react && npx tsc --noEmit`.
- Angular: `cd ui/angular && npm test -- --watch=false --browsers=ChromeHeadless`. Build: `cd ui/angular && npm run build`.

## Target file structure

**React** (`ui/react/src/components/`):
- `FinancialScreen.tsx` — shell: period-summary bar + role branch; admin → MUI `Tabs` with the four tab components; resident → `ResidentFinancial`.
- `financial/util.ts` — `formatEur`, `currentMonth`, `today` (shared helpers, moved out of the component).
- `financial/BillsTab.tsx` — merged "Add a bill" form (scan + manual) + expenses list. **New logic.**
- `financial/FeesTab.tsx` — record charge form + charges table (relocated).
- `financial/PaymentsTab.tsx` — balances card + record payment form + payments table (relocated).
- `financial/ReportTab.tsx` — record income form + year picker + annual matrix + Excel (relocated).
- `financial/ResidentFinancial.tsx` — resident summary + charges + payments + request-payment dialog (relocated).

**Angular** (`ui/angular/src/app/financial/`):
- `financial.component.ts` — shell: period-summary bar + role branch + `p-tabs`.
- `tabs/bills-tab.component.ts` — merged bill entry + expenses list. **New logic.**
- `tabs/fees-tab.component.ts`, `tabs/payments-tab.component.ts`, `tabs/report-tab.component.ts` — relocated.
- `tabs/resident-financial.component.ts` — relocated resident view.
- Shared styles stay a copied `styles` block per component (matches the app's existing per-component style convention).

---

## Task 1: Shared React helpers module

**Files:**
- Create: `ui/react/src/components/financial/util.ts`
- Test: `ui/react/src/components/financial/util.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// ui/react/src/components/financial/util.test.ts
import { formatEur, currentMonth, today } from './util';

test('formatEur renders euro currency', () => {
  expect(formatEur(1234.5)).toContain('1.234,5'); // de-DE grouping
  expect(formatEur(0)).toContain('€');
});

test('currentMonth is YYYY-MM', () => {
  expect(currentMonth()).toMatch(/^\d{4}-\d{2}$/);
});

test('today is YYYY-MM-DD', () => {
  expect(today()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd ui/react && npm test -- --watchAll=false util.test`
Expected: FAIL — `Cannot find module './util'`.

- [ ] **Step 3: Implement**

```ts
// ui/react/src/components/financial/util.ts
export function formatEur(n: number): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n);
}
export function currentMonth(): string { return new Date().toISOString().slice(0, 7); }
export function today(): string { return new Date().toISOString().slice(0, 10); }
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd ui/react && npm test -- --watchAll=false util.test`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add ui/react/src/components/financial/util.ts ui/react/src/components/financial/util.test.ts
git commit -m "feat(react-finance): add shared finance helpers module"
```

---

## Task 2: React BillsTab — merged scan + manual bill entry + expenses list

This is the one behavioral change: one expense form, prefilled by the scanner. State collapses the old `scanStep` ('idle'|'scanning'|'done') + duplicate `handleExpSubmit`/`handleScanSubmit` into: a single set of fields, a `scanning` boolean, and a `scanConfidence` (null = manually entered, number = from scan).

**Files:**
- Create: `ui/react/src/components/financial/BillsTab.tsx`
- Test: `ui/react/src/components/financial/BillsTab.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// ui/react/src/components/financial/BillsTab.test.tsx
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { createTheme, ThemeProvider } from '@mui/material';
import BillsTab from './BillsTab';
import * as expApi from '../../api/expenses';

jest.mock('../../api/expenses');
const mockGetExpenses  = expApi.getExpenses as jest.Mock;
const mockRecordExpense = expApi.recordExpense as jest.Mock;
const mockScanInvoice   = expApi.scanInvoice as jest.Mock;

const theme = createTheme();
const renderTab = () =>
  render(<ThemeProvider theme={theme}><BillsTab /></ThemeProvider>);

beforeEach(() => {
  jest.clearAllMocks();
  mockGetExpenses.mockResolvedValue([]);
  mockRecordExpense.mockResolvedValue({});
});

test('renders the Add-a-bill form and expenses table', async () => {
  renderTab();
  await waitFor(() => screen.getByTestId('bill-form'));
  expect(screen.getByTestId('bill-scan-input')).toBeInTheDocument();
});

test('manual entry records an expense', async () => {
  renderTab();
  await waitFor(() => screen.getByTestId('bill-form'));
  fireEvent.change(screen.getByTestId('bill-amount'), { target: { value: '42.50' } });
  fireEvent.change(screen.getByTestId('bill-desc'),   { target: { value: 'Cleaning' } });
  fireEvent.submit(screen.getByTestId('bill-form'));
  await waitFor(() => expect(mockRecordExpense).toHaveBeenCalledTimes(1));
  expect(mockRecordExpense.mock.calls[0][0]).toMatchObject({ amountEur: 42.5, description: 'Cleaning' });
});

test('scanning an invoice prefills the same form and shows confidence', async () => {
  mockScanInvoice.mockResolvedValue({ amount: 99.9, date: '2026-08-01', vendor: 'ACME', confidence: 0.9 });
  renderTab();
  await waitFor(() => screen.getByTestId('bill-scan-input'));
  const file = new File(['x'], 'invoice.pdf', { type: 'application/pdf' });
  fireEvent.change(screen.getByTestId('bill-scan-input'), { target: { files: [file] } });
  await waitFor(() => expect((screen.getByTestId('bill-amount') as HTMLInputElement).value).toBe('99.9'));
  expect((screen.getByTestId('bill-desc') as HTMLInputElement).value).toBe('ACME');
  expect(screen.getByTestId('bill-confidence').textContent).toContain('90%');
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd ui/react && npm test -- --watchAll=false BillsTab.test`
Expected: FAIL — `Cannot find module './BillsTab'`.

- [ ] **Step 3: Implement**

```tsx
// ui/react/src/components/financial/BillsTab.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Divider,
  MenuItem, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography,
} from '@mui/material';
import { Refresh } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { getExpenses, recordExpense, scanInvoice } from '../../api/expenses';
import { ExpenseDto, EXPENSE_CATEGORIES, PARENT_CATEGORIES } from '../../types';
import { formatEur, today } from './util';

export default function BillsTab() {
  const { t } = useTranslation();

  // Single shared bill form (manual + scan target)
  const [amount, setAmount]     = useState('');
  const [desc, setDesc]         = useState('');
  const [cat, setCat]           = useState<string>(EXPENSE_CATEGORIES[0]);
  const [parent, setParent]     = useState<string>(PARENT_CATEGORIES[3]); // 'Other'
  const [date, setDate]         = useState(today());
  const [confidence, setConf]   = useState<number | null>(null); // null = manual
  const [scanning, setScanning] = useState(false);
  const [scanErr, setScanErr]   = useState('');
  const [saving, setSaving]     = useState(false);
  const [ok, setOk]             = useState(false);
  const [formErr, setFormErr]   = useState('');

  const [expenses, setExpenses] = useState<ExpenseDto[]>([]);
  const [expLoad, setExpLoad]   = useState(true);
  const [expErr, setExpErr]     = useState('');

  const loadExpenses = useCallback(async () => {
    setExpLoad(true); setExpErr('');
    try { setExpenses(await getExpenses()); }
    catch { setExpErr(t('expenses.errLoad')); }
    finally { setExpLoad(false); }
  }, [t]);
  useEffect(() => { loadExpenses(); }, [loadExpenses]);

  const resetForm = () => {
    setAmount(''); setDesc(''); setCat(EXPENSE_CATEGORIES[0]);
    setParent(PARENT_CATEGORIES[3]); setDate(today()); setConf(null);
  };

  const handleScanFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) { setScanErr(t('invoiceScan.errEmpty')); return; }
    setScanErr(''); setScanning(true);
    try {
      const dto = await scanInvoice(file);
      setAmount(dto.amount != null ? String(dto.amount) : '');
      setDate(dto.date ?? today());
      setDesc(dto.vendor ?? '');
      setCat(EXPENSE_CATEGORIES[0]);
      setParent(PARENT_CATEGORIES[3]);
      setConf(dto.confidence);
    } catch { setScanErr(t('invoiceScan.errScan')); }
    finally { setScanning(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setOk(false); setFormErr('');
    const parsed = parseFloat(amount);
    if (!amount || isNaN(parsed) || parsed <= 0) { setFormErr(t('expenses.errAmount')); return; }
    setSaving(true);
    try {
      await recordExpense({ amountEur: parsed, description: desc, category: cat, parentCategory: parent, expenseDate: date, idempotencyKey: crypto.randomUUID() });
      setOk(true); resetForm(); await loadExpenses();
    } catch { setFormErr(t('expenses.errRecord')); }
    finally { setSaving(false); }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Card variant="outlined">
        <CardContent>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>{t('finance.addBill')}</Typography>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', mb: 1.5 }}>
            <Button variant="contained" component="label" size="small" disabled={scanning}>
              {t('finance.scanInvoice')}
              <input data-testid="bill-scan-input" type="file" hidden accept="application/pdf,image/*" onChange={handleScanFile} />
            </Button>
            {scanning && <CircularProgress size={18} />}
            {confidence != null && <Chip data-testid="bill-confidence" size="small" label={`${t('invoiceScan.confidence')}: ${(confidence * 100).toFixed(0)}%`} />}
            <Typography variant="caption" color="text.secondary">{t('finance.orEnterManually')}</Typography>
          </Box>
          {scanErr && <Alert severity="error" sx={{ mb: 1, py: 0 }}>{scanErr}</Alert>}

          <Box component="form" data-testid="bill-form" onSubmit={handleSubmit} sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
            <TextField label={t('expenses.amountEuro')} type="number" slotProps={{ htmlInput: { step: '0.01', min: '0.01', 'data-testid': 'bill-amount' } }} value={amount} onChange={e => setAmount(e.target.value)} required size="small" />
            <TextField label={t('expenses.expenseDate')} type="date" value={date} onChange={e => setDate(e.target.value)} required size="small" slotProps={{ inputLabel: { shrink: true } }} />
            <TextField label={t('common.description')} value={desc} onChange={e => setDesc(e.target.value)} required size="small" slotProps={{ htmlInput: { 'data-testid': 'bill-desc' } }} />
            <TextField label={t('expenses.category')} select value={cat} onChange={e => setCat(e.target.value)} size="small">
              {EXPENSE_CATEGORIES.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
            </TextField>
            <TextField label={t('expenses.parentCategory')} select value={parent} onChange={e => setParent(e.target.value)} size="small">
              {PARENT_CATEGORIES.map(p => <MenuItem key={p} value={p}>{p}</MenuItem>)}
            </TextField>
            <Box sx={{ gridColumn: '1 / -1', display: 'flex', gap: 1.5, alignItems: 'center' }}>
              <Button data-testid="bill-submit" type="submit" variant="contained" size="small" disabled={saving}>{t('expenses.record')}</Button>
              <Button variant="outlined" size="small" onClick={resetForm} disabled={saving}>{t('finance.clearForm')}</Button>
              {ok && <Alert severity="success" sx={{ py: 0 }}>{t('expenses.recorded')}</Alert>}
              {formErr && <Alert severity="error" sx={{ py: 0 }}>{formErr}</Alert>}
            </Box>
          </Box>
        </CardContent>
      </Card>

      <Divider><Typography variant="overline" color="text.secondary">{t('nav.expenses')}</Typography></Divider>

      {expLoad ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>
      ) : expErr ? (
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <Alert severity="error">{expErr}</Alert>
          <Button variant="outlined" startIcon={<Refresh />} onClick={loadExpenses} size="small">{t('common.retry')}</Button>
        </Box>
      ) : (
        <Box sx={{ overflowX: 'auto' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{t('common.date')}</TableCell>
                <TableCell>{t('expenses.category')}</TableCell>
                <TableCell>{t('common.description')}</TableCell>
                <TableCell align="right">{t('common.amount')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {expenses.length === 0 ? (
                <TableRow><TableCell colSpan={4} align="center" sx={{ color: 'text.secondary', py: 3 }}>{t('expenses.none')}</TableCell></TableRow>
              ) : expenses.map(e => (
                <TableRow key={e.id} data-testid={`expense-row-${e.id}`}>
                  <TableCell>{e.expenseDate}</TableCell>
                  <TableCell>{e.category}</TableCell>
                  <TableCell>{e.description}</TableCell>
                  <TableCell align="right">{formatEur(e.amountEur)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      )}
    </Box>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd ui/react && npm test -- --watchAll=false BillsTab.test`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add ui/react/src/components/financial/BillsTab.tsx ui/react/src/components/financial/BillsTab.test.tsx
git commit -m "feat(react-finance): merged scan+manual BillsTab with expenses list"
```

---

## Task 3: React FeesTab, PaymentsTab, ReportTab, ResidentFinancial (relocation)

These are mechanical extractions of existing, already-tested JSX. Each new component takes no props except where noted, calls the same API modules, and owns its own load/state (copied verbatim from `FinancialScreen.tsx`). Keep every existing `data-testid`.

**Files:**
- Create: `ui/react/src/components/financial/FeesTab.tsx` — lift the maintenance-fees state + `loadFees` + `handleFeeSubmit` (current `FinancialScreen.tsx:44-75`) and the fee form + table JSX (`FinancialScreen.tsx:289-342`). Admin-only screen, so render the form unconditionally (the tab is admin-only). Table shows the household column (always, since admin). Import `getAllCharges, recordCharge` from `../../api/maintenanceFees`, `ChargeDto` from `../../types`, `formatEur, currentMonth` from `./util`.
- Create: `ui/react/src/components/financial/PaymentsTab.tsx` — lift payments + balance state + `loadPayments`/`loadBalance`/`handlePaySubmit` (`FinancialScreen.tsx:154-191`) and the balances card + payment form + payments table JSX (`FinancialScreen.tsx:408-493`). Use `getAllPayments, recordPayment, getBalance`. Render household columns (admin context).
- Create: `ui/react/src/components/financial/ReportTab.tsx` — lift annual-report + income state and handlers (`FinancialScreen.tsx:90-151`) and the income form + year picker + matrix JSX (`FinancialScreen.tsx:516-627`). Use `recordIncome, getAnnualReport, downloadAnnualReportXlsx` from `../../api/expenses`.
- Create: `ui/react/src/components/financial/ResidentFinancial.tsx` — the resident view: period-summary bar (month picker + totals), charges table, balance card, payments table, and the request-payment dialog. Lift resident-relevant JSX and use `getMyCharges`/`getMyPayments`. Keep `data-testid`s `summary-charges`, `summary-expenses`, `charge-row-*`, `payment-row-*`, `pay-btn`, `pay-dialog`.

For each component:

- [ ] **Step 1: Create the component** by moving the corresponding code from `FinancialScreen.tsx`, replacing any `isAdmin`/`role` conditionals with the fixed context (admin tabs = always admin; `ResidentFinancial` = always resident). Import helpers from `./util`.

- [ ] **Step 2: Type-check**

Run: `cd ui/react && npx tsc --noEmit`
Expected: no errors (there will be temporary "unused" errors in `FinancialScreen.tsx` until Task 4; if so, complete Task 4 before final type-check).

- [ ] **Step 3: Commit**

```bash
git add ui/react/src/components/financial/FeesTab.tsx ui/react/src/components/financial/PaymentsTab.tsx ui/react/src/components/financial/ReportTab.tsx ui/react/src/components/financial/ResidentFinancial.tsx
git commit -m "refactor(react-finance): extract Fees/Payments/Report/Resident components"
```

---

## Task 4: React FinancialScreen shell with tabs

**Files:**
- Modify: `ui/react/src/components/FinancialScreen.tsx` (full rewrite to a shell)
- Modify: `ui/react/src/components/FinancialScreen.test.tsx` (add tab tests; keep resident tests)

- [ ] **Step 1: Write the failing tests** (append to `FinancialScreen.test.tsx`)

```tsx
test('admin sees Bills as the default active tab', async () => {
  const { getAllCharges } = require('../api/maintenanceFees');
  const { getAllPayments, getBalance } = require('../api/payments');
  const { getExpenses } = require('../api/expenses');
  (getAllCharges as jest.Mock).mockResolvedValue([]);
  (getAllPayments as jest.Mock).mockResolvedValue([]);
  (getBalance as jest.Mock).mockResolvedValue({ label: 'x', lines: [] });
  (getExpenses as jest.Mock).mockResolvedValue([]);
  renderScreen('admin');
  await waitFor(() => screen.getByTestId('bill-form'));       // Bills tab content visible
  expect(screen.getByRole('tab', { selected: true }).textContent).toMatch(/bill/i);
});

test('resident view has no tabs', async () => {
  renderScreen('resident');
  await waitFor(() => screen.getByTestId('summary-charges'));
  expect(screen.queryByRole('tab')).toBeNull();
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd ui/react && npm test -- --watchAll=false FinancialScreen.test`
Expected: FAIL — no `tab` role / `bill-form` not found.

- [ ] **Step 3: Rewrite `FinancialScreen.tsx`**

```tsx
import React, { useState } from 'react';
import { Box, Tab, Tabs } from '@mui/material';
import { useTranslation } from 'react-i18next';
import BillsTab from './financial/BillsTab';
import FeesTab from './financial/FeesTab';
import PaymentsTab from './financial/PaymentsTab';
import ReportTab from './financial/ReportTab';
import ResidentFinancial from './financial/ResidentFinancial';

interface Props { role: 'resident' | 'admin'; }
type FinTab = 'bills' | 'fees' | 'payments' | 'report';

export default function FinancialScreen({ role }: Props) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<FinTab>('bills');

  if (role !== 'admin') return <ResidentFinancial />;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto">
        <Tab label={t('finance.tabBills')} value="bills" />
        <Tab label={t('finance.tabFees')} value="fees" />
        <Tab label={t('finance.tabPayments')} value="payments" />
        <Tab label={t('finance.tabReport')} value="report" />
      </Tabs>
      {tab === 'bills' && <BillsTab />}
      {tab === 'fees' && <FeesTab />}
      {tab === 'payments' && <PaymentsTab />}
      {tab === 'report' && <ReportTab />}
    </Box>
  );
}
```

Note: the period-summary bar (month picker + totals) moves into `ResidentFinancial` for residents. For admins it is not part of the tab shell (the per-month totals were resident-oriented context); if you want it retained for admins, place a compact copy above `<Tabs>` — out of scope for the default plan.

- [ ] **Step 4: Run the full finance suite**

Run: `cd ui/react && npm test -- --watchAll=false Financial BillsTab util`
Expected: PASS — resident tests (existing) + new tab tests + BillsTab + util.

- [ ] **Step 5: Type-check + commit**

```bash
cd ui/react && npx tsc --noEmit
git add ui/react/src/components/FinancialScreen.tsx ui/react/src/components/FinancialScreen.test.tsx
git commit -m "feat(react-finance): tabbed admin shell, resident view unchanged"
```

---

## Task 5: React i18n keys (bg, en, ru)

**Files:** Modify `ui/react/src/i18n/locales/{en,bg,ru}.json` — add to the existing `finance` object.

- [ ] **Step 1: Add keys**

`en.json` `finance`:
```json
"tabBills": "Bills",
"tabFees": "Fees",
"tabPayments": "Payments",
"tabReport": "Report",
"addBill": "Add a bill",
"scanInvoice": "Scan invoice",
"orEnterManually": "or enter manually",
"clearForm": "Clear"
```

`bg.json` `finance`:
```json
"tabBills": "Сметки",
"tabFees": "Такси",
"tabPayments": "Плащания",
"tabReport": "Отчет",
"addBill": "Добави сметка",
"scanInvoice": "Сканирай фактура",
"orEnterManually": "или въведи ръчно",
"clearForm": "Изчисти"
```

`ru.json` `finance`:
```json
"tabBills": "Счета",
"tabFees": "Взносы",
"tabPayments": "Платежи",
"tabReport": "Отчёт",
"addBill": "Добавить счёт",
"scanInvoice": "Сканировать счёт",
"orEnterManually": "или ввести вручную",
"clearForm": "Очистить"
```

- [ ] **Step 2: Verify JSON parses**

Run: `cd ui/react && node -e "['en','bg','ru'].forEach(l=>require('./src/i18n/locales/'+l+'.json'))"`
Expected: no output, exit 0.

- [ ] **Step 3: Commit**

```bash
git add ui/react/src/i18n/locales/en.json ui/react/src/i18n/locales/bg.json ui/react/src/i18n/locales/ru.json
git commit -m "i18n(react-finance): add finance tab + add-bill keys"
```

---

## Task 6: Angular BillsTab child component (merged scan + manual + expenses list)

**Files:**
- Create: `ui/angular/src/app/financial/tabs/bills-tab.component.ts`
- Test: `ui/angular/src/app/financial/tabs/bills-tab.component.spec.ts`

- [ ] **Step 1: Write the failing test**

```ts
// ui/angular/src/app/financial/tabs/bills-tab.component.spec.ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';
import { BillsTabComponent } from './bills-tab.component';
import { ExpenseService } from '../../expenses/expense.service';

describe('BillsTabComponent', () => {
  let fixture: ComponentFixture<BillsTabComponent>;
  const expSvc = {
    getExpenses: jasmine.createSpy().and.returnValue(of([])),
    recordExpense: jasmine.createSpy().and.returnValue(of({})),
    scanInvoice: jasmine.createSpy().and.returnValue(of({ amount: 99.9, date: '2026-08-01', vendor: 'ACME', confidence: 0.9 })),
  };
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BillsTabComponent, TranslateModule.forRoot()],
      providers: [{ provide: ExpenseService, useValue: expSvc }],
    }).compileComponents();
    fixture = TestBed.createComponent(BillsTabComponent);
    fixture.detectChanges();
  });

  it('scanning prefills the shared form fields', () => {
    const input = fixture.nativeElement.querySelector('[data-testid="bill-scan-input"]') as HTMLInputElement;
    const file = new File(['x'], 'invoice.pdf', { type: 'application/pdf' });
    Object.defineProperty(input, 'files', { value: [file] });
    input.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(fixture.componentInstance.billForm.amountEurStr).toBe('99.9');
    expect(fixture.componentInstance.billForm.description).toBe('ACME');
    expect(fixture.componentInstance.confidence()).toBe(0.9);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd ui/angular && npm test -- --watch=false --browsers=ChromeHeadless --include='**/bills-tab.component.spec.ts'`
Expected: FAIL — cannot find `./bills-tab.component`.

- [ ] **Step 3: Implement** (mirror the React BillsTab; reuse `ExpenseService`, `EXPENSE_CATEGORIES`, `PARENT_CATEGORIES`, `ScannedInvoiceDto` from `../../expenses/models`). Move the invoice-scan logic from `financial.component.ts:823-869` and the manual-expense logic from `financial.component.ts:736-756`, collapsed into one `billForm` + `confidence = signal<number|null>(null)` + `scanning` signal. Template: an "Add a bill" card with a file input `data-testid="bill-scan-input"` (primary "Scan invoice" button), a confidence chip when `confidence() != null`, the shared form (amount/date/description/category/parentCategory), a submit + clear button, then the expenses table (moved from `financial.component.ts:199-222`, keeping `data-testid="expense-row-…"`). Copy the relevant `styles` entries from the parent. Add keys `finance.addBill`, `finance.scanInvoice`, `finance.orEnterManually`, `finance.clearForm` (Task 10).

- [ ] **Step 4: Run to verify it passes**

Run: `cd ui/angular && npm test -- --watch=false --browsers=ChromeHeadless --include='**/bills-tab.component.spec.ts'`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add ui/angular/src/app/financial/tabs/bills-tab.component.ts ui/angular/src/app/financial/tabs/bills-tab.component.spec.ts
git commit -m "feat(ng-finance): merged scan+manual BillsTab with expenses list"
```

---

## Task 7: Angular Fees / Payments / Report / Resident child components (relocation)

**Files:**
- Create: `ui/angular/src/app/financial/tabs/fees-tab.component.ts` — move the fees form + table (`financial.component.ts:97-154`) and `loadFees`/`onFeeSubmit`/`feeForm` state. Always-admin, so render the form unconditionally and always show the household column.
- Create: `ui/angular/src/app/financial/tabs/payments-tab.component.ts` — move balances card + payment form + payments table (`financial.component.ts:227-305`) and `loadPayments`/`loadBalance`/`onPaymentSubmit`/`payForm`.
- Create: `ui/angular/src/app/financial/tabs/report-tab.component.ts` — move income form + year picker + matrix (`financial.component.ts:308-416`) and report/income state + handlers.
- Create: `ui/angular/src/app/financial/tabs/resident-financial.component.ts` — resident view: period-summary bar, charges table, balance card, payments table, request-payment dialog (moved resident-relevant blocks), using `getMyCharges`/`getMyPayments`. Keep `data-testid`s `summary-charges`, `summary-expenses`, `charge-row-*`, `payment-row-*`, `pay-btn`, `pay-dialog`.

Each component copies the shared `styles` block subset it needs and imports the same PrimeNG/ngx-translate modules the parent used.

- [ ] **Step 1:** Create each component by relocating the referenced blocks and handlers.
- [ ] **Step 2: Build**

Run: `cd ui/angular && npm run build`
Expected: build succeeds (parent `financial.component.ts` is rewritten in Task 8; if the build fails only due to now-unused members there, finish Task 8 first).

- [ ] **Step 3: Commit**

```bash
git add ui/angular/src/app/financial/tabs/
git commit -m "refactor(ng-finance): extract Fees/Payments/Report/Resident components"
```

---

## Task 8: Angular financial.component.ts shell with p-tabs

**Files:**
- Modify: `ui/angular/src/app/financial/financial.component.ts` (rewrite to shell)
- Modify: `ui/angular/src/app/financial/financial.component.spec.ts` (add tab + resident assertions)

- [ ] **Step 1: Write the failing test** (add to spec)

```ts
it('admin renders the four finance tabs with Bills active', () => {
  // role defaults to admin when RoleService.isAdmin is true; ensure the spec's
  // RoleService stub returns isAdmin=true, then:
  const tabs = fixture.nativeElement.querySelectorAll('p-tab, [role="tab"]');
  expect(tabs.length).toBe(4);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd ui/angular && npm test -- --watch=false --browsers=ChromeHeadless --include='**/financial.component.spec.ts'`
Expected: FAIL — no tabs rendered yet.

- [ ] **Step 3: Rewrite the component.** Keep the `harmonia-shell`/`harmonia-header` chrome and the role toggle. Replace the stacked sections with, for `role === 'admin'`, a `p-tabs` block; for resident, `<app-resident-financial />`.

```ts
// imports add:
import { TabsModule } from 'primeng/tabs';
import { BillsTabComponent } from './tabs/bills-tab.component';
import { FeesTabComponent } from './tabs/fees-tab.component';
import { PaymentsTabComponent } from './tabs/payments-tab.component';
import { ReportTabComponent } from './tabs/report-tab.component';
import { ResidentFinancialComponent } from './tabs/resident-financial.component';
// component `imports:` array add: TabsModule, BillsTabComponent, FeesTabComponent,
//   PaymentsTabComponent, ReportTabComponent, ResidentFinancialComponent
```

Template body inside the card (replacing the sections after the header, keeping the role toggle in the header):
```html
@if (role === 'admin') {
  <p-tabs value="bills">
    <p-tablist>
      <p-tab value="bills">{{ 'finance.tabBills' | translate }}</p-tab>
      <p-tab value="fees">{{ 'finance.tabFees' | translate }}</p-tab>
      <p-tab value="payments">{{ 'finance.tabPayments' | translate }}</p-tab>
      <p-tab value="report">{{ 'finance.tabReport' | translate }}</p-tab>
    </p-tablist>
    <p-tabpanels>
      <p-tabpanel value="bills"><app-bills-tab /></p-tabpanel>
      <p-tabpanel value="fees"><app-fees-tab /></p-tabpanel>
      <p-tabpanel value="payments"><app-payments-tab /></p-tabpanel>
      <p-tabpanel value="report"><app-report-tab /></p-tabpanel>
    </p-tabpanels>
  </p-tabs>
} @else {
  <app-resident-financial />
}
```
Remove the now-relocated state/handlers/loaders from the class (they live in the child components). The shell keeps only `role`, `isAdmin`, and the role-toggle `reloadSections()` (which can now be a no-op that re-creates the tab set, or simply toggle the `role` field — child components reload on init).

- [ ] **Step 4: Run finance specs + build**

Run: `cd ui/angular && npm test -- --watch=false --browsers=ChromeHeadless --include='**/financial*.spec.ts' --include='**/tabs/*.spec.ts'`
Then: `cd ui/angular && npm run build`
Expected: specs PASS, build succeeds.

- [ ] **Step 5: Commit**

```bash
git add ui/angular/src/app/financial/financial.component.ts ui/angular/src/app/financial/financial.component.spec.ts
git commit -m "feat(ng-finance): tabbed admin shell, resident view unchanged"
```

---

## Task 9: Angular i18n keys (bg, en, ru)

**Files:** Modify `ui/angular/public/assets/i18n/{en,bg,ru}.json` — add the same keys as Task 5 to each `finance` object (identical values). 

- [ ] **Step 1:** Add the `tabBills/tabFees/tabPayments/tabReport/addBill/scanInvoice/orEnterManually/clearForm` keys (values per Task 5) to all three Angular locale files.
- [ ] **Step 2: Verify JSON parses**

Run: `cd ui/angular && node -e "['en','bg','ru'].forEach(l=>require('./public/assets/i18n/'+l+'.json'))"`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add ui/angular/public/assets/i18n/en.json ui/angular/public/assets/i18n/bg.json ui/angular/public/assets/i18n/ru.json
git commit -m "i18n(ng-finance): add finance tab + add-bill keys"
```

---

## Task 10: Full-suite verification

- [ ] **Step 1: React**

Run: `cd ui/react && npm test -- --watchAll=false && npx tsc --noEmit`
Expected: all suites PASS, no type errors.

- [ ] **Step 2: Angular**

Run: `cd ui/angular && npm test -- --watch=false --browsers=ChromeHeadless && npm run build`
Expected: all specs PASS, build succeeds.

- [ ] **Step 3: Manual parity check (both apps, admin login)** — Bills is the default tab; "Scan invoice" prefills the same form the manual entry uses; Fees/Payments/Report tabs show their prior content; resident login shows the old single-scroll screen with no tabs.

- [ ] **Step 4: Final commit** (if any lint/format fixups)

```bash
git add -A && git commit -m "test(finance): verify tabbed redesign across both frontends"
```

---

## Self-Review

**Spec coverage:**
- Tabbed admin IA (Bills default, Fees, Payments, Report) → Tasks 4, 8. ✅
- Bill entry (scan + manual merged) at top of Bills → Tasks 2, 6. ✅
- Expenses list below entry in Bills tab → Tasks 2, 6. ✅
- Resident view unchanged / no tabs → Tasks 3 (`ResidentFinancial`), 4, 7, 8. ✅
- Both frontends at parity → React Tasks 1–5, Angular Tasks 6–9. ✅
- No backend/DTO/API changes → all tasks reuse existing API modules/services. ✅
- i18n bg/ru/en for new strings → Tasks 5, 9. ✅
- Preserve `data-testid`s / existing tests → Tasks 3, 7 keep ids; Task 4 keeps resident tests. ✅
- Tests: default tab = Bills, scan prefills shared form, resident has no tabs → Tasks 2, 4, 6, 8. ✅

**Placeholder scan:** No TBD/TODO. Relocation tasks cite exact source line ranges rather than reproducing hundreds of lines of already-committed JSX verbatim — the moved code exists in git and must be transplanted unchanged except for dropping the `role`/`isAdmin` conditionals.

**Type consistency:** `formatEur/currentMonth/today` signatures match Task 1; `billForm` fields (`amountEurStr`, `expenseDate`, `description`, `category`, `parentCategory`) and `confidence` signal match between the Angular component and its test; React `recordExpense` payload shape matches the existing API. Tab values (`bills/fees/payments/report`) are consistent across shell, tests, and i18n keys.

**Test-first per implementation task:** Task 1 yes — helper unit tests. Task 2 yes — BillsTab behavior tests. Task 3 no — pure relocation of tested code, verified by type-check + Task 10 suite. Task 4 yes — tab default + resident-no-tabs tests. Task 5 no — i18n data, verified by JSON parse. Task 6 yes — Angular BillsTab scan-prefill test. Task 7 no — relocation, verified by build + Task 10. Task 8 yes — tab-count test. Task 9 no — i18n data. Task 10 no — verification only.
