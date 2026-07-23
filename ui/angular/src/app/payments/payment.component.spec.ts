import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { PaymentComponent } from './payment.component';
import { PaymentService } from './payment.service';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { PaymentDto, BalanceDto } from './models';

const PAYMENT: PaymentDto = {
  id: 'p1', householdRef: 'H001', amountEur: 150, period: '2026-07',
  dateReceived: '2026-07-15', recordedAt: '2026-07-15T10:00:00Z', idempotencyKey: 'ik1',
};

const BALANCE: BalanceDto = {
  label: 'YTD-2026',
  lines: [{ householdRef: 'H001', totalCharged: 300, totalPaid: 150, balance: 150 }],
};

describe('PaymentComponent', () => {
  const setup = async (
    serviceMock: Partial<PaymentService>,
    role: 'resident' | 'admin' = 'resident',
  ) => {
    await TestBed.configureTestingModule({
      imports: [PaymentComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: PaymentService, useValue: serviceMock },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(PaymentComponent);
    fixture.componentInstance.role = role;
    fixture.detectChanges();
    return fixture;
  };

  it('renders payment rows for resident from getMyPayments', async () => {
    const fixture = await setup({
      getMyPayments: () => of([PAYMENT]),
      getAllPayments: () => of([]),
      recordPayment: () => of(PAYMENT),
      getBalance: () => of(BALANCE),
    }, 'resident');
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="payment-row-p1"]')).not.toBeNull();
    expect(el.querySelector('[data-testid="payment-row-p1"]')?.textContent).toContain('2026-07');
  });

  it('shows record form for admin role', async () => {
    const fixture = await setup({
      getMyPayments: () => of([]),
      getAllPayments: () => of([]),
      recordPayment: () => of(PAYMENT),
      getBalance: () => of(BALANCE),
    }, 'admin');
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="record-form"]')).not.toBeNull();
  });

  it('hides record form for resident role', async () => {
    const fixture = await setup({
      getMyPayments: () => of([]),
      getAllPayments: () => of([]),
      recordPayment: () => of(PAYMENT),
      getBalance: () => of(BALANCE),
    }, 'resident');
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="record-form"]')).toBeNull();
  });

  it('submit calls recordPayment and reloads list', async () => {
    const recordFn = vi.fn().mockReturnValue(of(PAYMENT));
    const getAllPayments = vi.fn().mockReturnValue(of([PAYMENT]));
    const fixture = await setup({
      getMyPayments: () => of([]),
      getAllPayments,
      recordPayment: recordFn,
      getBalance: () => of(BALANCE),
    }, 'admin');
    fixture.componentInstance.form.householdRef = 'H001';
    fixture.componentInstance.form.amountEurStr = '150';
    fixture.componentInstance.form.period = '2026-07';
    fixture.componentInstance.form.dateReceived = '2026-07-15';
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const submitBtn = el.querySelector<HTMLButtonElement>('[data-testid="submit-btn"]');
    submitBtn?.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(recordFn).toHaveBeenCalledOnce();
    expect(getAllPayments).toHaveBeenCalledTimes(2);
    expect(el.querySelector('[data-testid="submit-success"]')).not.toBeNull();
  });
});
