import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { BillsTabComponent } from './bills-tab.component';
import { ExpenseService } from '../../expenses/expense.service';
import { provideTranslateTesting } from '../../../testing/translate-testing';

describe('BillsTabComponent', () => {
  let fixture: ComponentFixture<BillsTabComponent>;
  let recordExpense: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    recordExpense = vi.fn().mockReturnValue(of({}));
    const expSvc = {
      getExpenses: vi.fn().mockReturnValue(of([])),
      recordExpense,
      scanInvoice: vi.fn().mockReturnValue(of({ amount: 99.9, date: '2026-08-01', vendor: 'ACME', confidence: 0.9 })),
    };
    await TestBed.configureTestingModule({
      imports: [BillsTabComponent],
      providers: [
        { provide: ExpenseService, useValue: expSvc },
        provideTranslateTesting(),
      ],
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

  it('manual submit records an expense and shows success', () => {
    const c = fixture.componentInstance;
    c.billForm.amountEurStr = '42.50';
    c.billForm.description = 'Cleaning';
    c.onSubmit();
    fixture.detectChanges();
    expect(recordExpense).toHaveBeenCalledTimes(1);
    expect(recordExpense.mock.calls[0][0]).toEqual(expect.objectContaining({ amountEur: 42.5, description: 'Cleaning' }));
    expect(c.ok()).toBe(true);
    expect(c.billForm.amountEurStr).toBe('');
  });
});
