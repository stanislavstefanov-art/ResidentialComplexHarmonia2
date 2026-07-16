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
    expect(el.querySelector('[data-testid="charge-row-c1"]')).not.toBeNull();
    expect(el.querySelector('[data-testid="charge-row-c1"]')?.textContent).toContain('July fee');
  });

  it('renders payment rows from service', async () => {
    const fixture = await setupComponent({
      getPeriodSummary: () => of(SUMMARY),
      getMyCharges: () => of([]),
      getMyPayments: () => of([PAYMENT]),
    });
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="payment-row-p1"]')).not.toBeNull();
    expect(el.querySelector('[data-testid="payment-row-p1"]')?.textContent).toContain('300');
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
