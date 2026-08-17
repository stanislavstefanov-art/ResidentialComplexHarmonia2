// PrimeNG TabList uses ResizeObserver which is absent in jsdom — provide a no-op stub.
if (typeof (globalThis as Record<string, unknown>)['ResizeObserver'] === 'undefined') {
  (globalThis as Record<string, unknown>)['ResizeObserver'] = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { FinancialComponent } from './financial.component';
import { FinancialService } from './financial.service';
import { MaintenanceFeeService } from '../maintenance-fees/maintenance-fee.service';
import { ExpenseService } from '../expenses/expense.service';
import { PaymentService } from '../payments/payment.service';
import { RoleService } from '../role.service';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { provideTranslateTesting } from '../../testing/translate-testing';
import { LanguageService } from '../language.service';

const makeMocks = () => ({
  financialSvc: {
    getPeriodSummary: vi.fn().mockReturnValue(of({ period: '2026-08', totalChargesEur: 0, totalExpensesEur: 0 })),
  },
  maintenanceFeeSvc: {
    getAllCharges: vi.fn().mockReturnValue(of([])),
    getMyCharges: vi.fn().mockReturnValue(of([])),
    recordCharge: vi.fn().mockReturnValue(of({})),
  },
  expenseSvc: {
    getExpenses: vi.fn().mockReturnValue(of([])),
    recordExpense: vi.fn().mockReturnValue(of({})),
    scanInvoice: vi.fn().mockReturnValue(of({ amount: 0, date: '2026-08-01', vendor: '', confidence: 0 })),
    getAnnualReport: vi.fn().mockReturnValue(of(null)),
    downloadAnnualReportXlsx: vi.fn().mockReturnValue(of(new Blob())),
    recordIncome: vi.fn().mockReturnValue(of({})),
  },
  paymentSvc: {
    getAllPayments: vi.fn().mockReturnValue(of([])),
    getMyPayments: vi.fn().mockReturnValue(of([])),
    getBalance: vi.fn().mockReturnValue(of({ lines: [] })),
    recordPayment: vi.fn().mockReturnValue(of({})),
  },
});

describe('FinancialComponent shell', () => {
  const setupComponent = async (isAdmin: boolean) => {
    const mocks = makeMocks();
    const roleServiceStub = { isAdmin };

    await TestBed.configureTestingModule({
      imports: [FinancialComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideTranslateTesting(),
        { provide: LanguageService, useValue: { current: signal('bg'), setLang: () => {} } },
        { provide: RoleService, useValue: roleServiceStub },
        { provide: FinancialService, useValue: mocks.financialSvc },
        { provide: MaintenanceFeeService, useValue: mocks.maintenanceFeeSvc },
        { provide: ExpenseService, useValue: mocks.expenseSvc },
        { provide: PaymentService, useValue: mocks.paymentSvc },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(FinancialComponent);
    fixture.detectChanges();
    return fixture;
  };

  it('admin shows the tabbed Income view as default', async () => {
    const fixture = await setupComponent(true);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    // p-tabs must be present for admin
    expect(el.querySelector('p-tabs')).not.toBeNull();
    // app-income-tab should be in the DOM (default active top-level tab), with its
    // default Charged sub-tab's fee-form rendered inside it
    expect(el.querySelector('app-income-tab')).not.toBeNull();
    expect(el.querySelector('[data-testid="fee-form"]')).not.toBeNull();
    // resident view must NOT render
    expect(el.querySelector('app-resident-financial')).toBeNull();
  });

  it('resident shows the resident view with Fees/Payments tabs', async () => {
    const fixture = await setupComponent(false);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    // resident component must be rendered
    expect(el.querySelector('app-resident-financial')).not.toBeNull();
    // admin income/outcome/report tab chrome must NOT be present
    expect(el.querySelector('app-income-tab')).toBeNull();
    expect(el.querySelector('app-outcome-tab')).toBeNull();
    expect(el.querySelector('app-report-tab')).toBeNull();
    // resident's own Fees/Payments tabs ARE present
    expect(el.querySelector('p-tabs')).not.toBeNull();
  });
});
