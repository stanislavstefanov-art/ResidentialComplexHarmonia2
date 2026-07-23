import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { MaintenanceFeeComponent } from './maintenance-fee.component';
import { MaintenanceFeeService } from './maintenance-fee.service';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ChargeDto } from './models';

const CHARGE: ChargeDto = {
  id: 'c1', householdRef: 'H001', amountEur: 150, description: 'Monthly fee',
  period: '2026-07', chargedAt: '2026-07-01T00:00:00Z', idempotencyKey: 'ik1',
};

describe('MaintenanceFeeComponent', () => {
  const setup = async (
    serviceMock: Partial<MaintenanceFeeService>,
    role: 'resident' | 'admin' = 'resident',
  ) => {
    await TestBed.configureTestingModule({
      imports: [MaintenanceFeeComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: MaintenanceFeeService, useValue: serviceMock },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(MaintenanceFeeComponent);
    fixture.componentInstance.role = role;
    fixture.detectChanges();
    return fixture;
  };

  it('renders charge rows for resident from getMyCharges', async () => {
    const fixture = await setup({
      getMyCharges: () => of([CHARGE]),
      getAllCharges: () => of([]),
      recordCharge: () => of(CHARGE),
    }, 'resident');
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="charge-row-c1"]')).not.toBeNull();
    expect(el.querySelector('[data-testid="charge-row-c1"]')?.textContent).toContain('Monthly fee');
  });

  it('shows record form for admin role', async () => {
    const fixture = await setup({
      getMyCharges: () => of([]),
      getAllCharges: () => of([]),
      recordCharge: () => of(CHARGE),
    }, 'admin');
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="record-form"]')).not.toBeNull();
  });

  it('hides record form for resident role', async () => {
    const fixture = await setup({
      getMyCharges: () => of([]),
      getAllCharges: () => of([]),
      recordCharge: () => of(CHARGE),
    }, 'resident');
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="record-form"]')).toBeNull();
  });

  it('submit calls recordCharge and reloads list', async () => {
    const recordFn = vi.fn().mockReturnValue(of(CHARGE));
    const getAllCharges = vi.fn().mockReturnValue(of([CHARGE]));
    const fixture = await setup({
      getMyCharges: () => of([]),
      getAllCharges,
      recordCharge: recordFn,
    }, 'admin');
    fixture.componentInstance.form.householdRef = 'H001';
    fixture.componentInstance.form.amountEurStr = '150';
    fixture.componentInstance.form.description = 'Monthly fee';
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const submitBtn = el.querySelector<HTMLButtonElement>('[data-testid="submit-btn"]');
    submitBtn?.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(recordFn).toHaveBeenCalledOnce();
    expect(getAllCharges).toHaveBeenCalledTimes(2);
    expect(el.querySelector('[data-testid="submit-success"]')).not.toBeNull();
  });
});
