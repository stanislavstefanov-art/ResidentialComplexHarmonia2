import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ExpenseService } from './expense.service';
import { ExpenseDto } from './models';

const API = 'http://localhost:5000';

describe('ExpenseService', () => {
  let svc: ExpenseService;
  let ctrl: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ExpenseService, provideHttpClient(), provideHttpClientTesting()],
    });
    svc = TestBed.inject(ExpenseService);
    ctrl = TestBed.inject(HttpTestingController);
  });

  afterEach(() => ctrl.verify());

  it('getExpenses calls GET /expenses', () => {
    let result: ExpenseDto[] | undefined;
    svc.getExpenses().subscribe((r: ExpenseDto[]) => (result = r));
    const req = ctrl.expectOne(`${API}/expenses`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
    expect(result).toEqual([]);
  });

  it('recordExpense calls POST /expenses with body', () => {
    const body = {
      amountEur: 200, description: 'Window cleaning', category: 'Cleaning',
      expenseDate: '2026-07-10', idempotencyKey: 'ik-test',
    };
    let result: ExpenseDto | undefined;
    svc.recordExpense(body).subscribe((r: ExpenseDto) => (result = r));
    const req = ctrl.expectOne(`${API}/expenses`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(body);
    const dto: ExpenseDto = {
      id: 'e1', amountEur: 200, description: 'Window cleaning', category: 'Cleaning',
      expenseDate: '2026-07-10', recordedAt: '2026-07-10T09:00:00Z', idempotencyKey: 'ik-test',
    };
    req.flush(dto, { status: 201, statusText: 'Created' });
    expect(result).toEqual(dto);
  });

  it('recordExpense handles 200 (duplicate idempotent)', () => {
    const body = {
      amountEur: 200, description: 'Window cleaning', category: 'Cleaning',
      expenseDate: '2026-07-10', idempotencyKey: 'ik-test',
    };
    let result: ExpenseDto | undefined;
    svc.recordExpense(body).subscribe((r: ExpenseDto) => (result = r));
    const req = ctrl.expectOne(`${API}/expenses`);
    const dto: ExpenseDto = {
      id: 'e1', amountEur: 200, description: 'Window cleaning', category: 'Cleaning',
      expenseDate: '2026-07-10', recordedAt: '2026-07-10T09:00:00Z', idempotencyKey: 'ik-test',
    };
    req.flush(dto, { status: 200, statusText: 'OK' });
    expect(result).toEqual(dto);
  });
});
