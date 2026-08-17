import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { OutcomeTabComponent } from './outcome-tab.component';
import { ExpenseService } from '../../expenses/expense.service';
import { CounterpartyService } from '../../counterparties/counterparty.service';
import { Counterparty } from '../../counterparties/counterparty.models';
import { provideTranslateTesting } from '../../../testing/translate-testing';

const COUNTERPARTY: Counterparty = {
  id: 'cp-1',
  name: 'ACME',
  category: 'Maintenance',
  parentCategory: 'Building',
  vatNumber: null,
  phone: null,
  email: null,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

describe('OutcomeTabComponent', () => {
  let fixture: ComponentFixture<OutcomeTabComponent>;
  let recordExpense: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    recordExpense = vi.fn().mockReturnValue(of({}));
    const expSvc = {
      getExpenses: vi.fn().mockReturnValue(of([])),
      recordExpense,
      scanInvoice: vi.fn().mockReturnValue(of({ amount: 99.9, date: '2026-08-01', vendor: 'ACME', confidence: 0.9 })),
    };
    const counterpartySvc = {
      list: vi.fn().mockReturnValue(of([COUNTERPARTY])),
    };
    await TestBed.configureTestingModule({
      imports: [OutcomeTabComponent],
      providers: [
        { provide: ExpenseService, useValue: expSvc },
        { provide: CounterpartyService, useValue: counterpartySvc },
        provideTranslateTesting(),
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(OutcomeTabComponent);
    fixture.detectChanges();
  });

  it('scanning prefills the shared form fields but does not auto-select a counterparty', () => {
    const input = fixture.nativeElement.querySelector('[data-testid="bill-scan-input"]') as HTMLInputElement;
    const file = new File(['x'], 'invoice.pdf', { type: 'application/pdf' });
    Object.defineProperty(input, 'files', { value: [file] });
    input.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(fixture.componentInstance.billForm.amountEurStr).toBe('99.9');
    expect(fixture.componentInstance.billForm.description).toBe('ACME');
    expect(fixture.componentInstance.confidence()).toBe(0.9);
    expect(fixture.componentInstance.selectedCounterparty).toBeNull();
  });

  it('blocks submit and shows an error when no counterparty is selected', () => {
    const c = fixture.componentInstance;
    c.billForm.amountEurStr = '42.50';
    c.billForm.description = 'Cleaning';
    c.onSubmit();
    fixture.detectChanges();
    expect(recordExpense).not.toHaveBeenCalled();
    expect(c.formErr()).toBeTruthy();
    expect(c.ok()).toBe(false);
  });

  it('manual submit records an expense with the selected counterparty and shows success', () => {
    const c = fixture.componentInstance;
    c.billForm.amountEurStr = '42.50';
    c.billForm.description = 'Cleaning';
    c.onCounterpartyChange(COUNTERPARTY);
    c.onSubmit();
    fixture.detectChanges();
    expect(recordExpense).toHaveBeenCalledTimes(1);
    expect(recordExpense.mock.calls[0][0]).toEqual(
      expect.objectContaining({ amountEur: 42.5, description: 'Cleaning', counterpartyId: 'cp-1' }),
    );
    expect(c.ok()).toBe(true);
    expect(c.billForm.amountEurStr).toBe('');
    expect(c.selectedCounterparty).toBeNull();
  });
});
