import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { ExpenseComponent } from './expense.component';
import { ExpenseService } from './expense.service';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ExpenseDto } from './models';

const EXPENSE: ExpenseDto = {
  id: 'e1', amountEur: 200, description: 'Window cleaning', category: 'Cleaning',
  expenseDate: '2026-07-10', recordedAt: '2026-07-10T09:00:00Z', idempotencyKey: 'ik1',
};

describe('ExpenseComponent', () => {
  const setup = async (serviceMock: Partial<ExpenseService>, role: 'resident' | 'admin' = 'resident') => {
    await TestBed.configureTestingModule({
      imports: [ExpenseComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ExpenseService, useValue: serviceMock },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(ExpenseComponent);
    fixture.componentInstance.role = role;
    fixture.detectChanges();
    return fixture;
  };

  it('renders expense rows from service', async () => {
    const fixture = await setup({
      getExpenses: () => of([EXPENSE]),
      recordExpense: () => of(EXPENSE),
    });
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="expense-row-e1"]')).not.toBeNull();
    expect(el.querySelector('[data-testid="expense-row-e1"]')?.textContent).toContain('Window cleaning');
  });

  it('shows record form for admin role', async () => {
    const fixture = await setup({
      getExpenses: () => of([]),
      recordExpense: () => of(EXPENSE),
    }, 'admin');
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="record-form"]')).not.toBeNull();
  });

  it('hides record form for resident role', async () => {
    const fixture = await setup({
      getExpenses: () => of([]),
      recordExpense: () => of(EXPENSE),
    }, 'resident');
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="record-form"]')).toBeNull();
  });

  it('submit calls recordExpense and reloads list', async () => {
    const recordFn = vi.fn().mockReturnValue(of(EXPENSE));
    const getExpenses = vi.fn().mockReturnValue(of([EXPENSE]));
    const fixture = await setup({ getExpenses, recordExpense: recordFn }, 'admin');
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const submitBtn = el.querySelector<HTMLButtonElement>('[data-testid="submit-btn"]');
    submitBtn?.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(recordFn).toHaveBeenCalledOnce();
    expect(getExpenses).toHaveBeenCalledTimes(2);
    expect(el.querySelector('[data-testid="submit-success"]')).not.toBeNull();
  });
});
