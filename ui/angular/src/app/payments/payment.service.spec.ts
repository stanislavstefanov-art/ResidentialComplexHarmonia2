import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { PaymentService } from './payment.service';
import { PaymentDto, BalanceDto } from './models';

const PAYMENT: PaymentDto = {
  id: 'p1', householdRef: 'H001', amountEur: 150, period: '2026-07',
  dateReceived: '2026-07-15', recordedAt: '2026-07-15T10:00:00Z', idempotencyKey: 'ik1',
};

const BALANCE: BalanceDto = {
  label: 'YTD-2026',
  lines: [{ householdRef: 'H001', totalCharged: 300, totalPaid: 150, balance: 150 }],
};

describe('PaymentService', () => {
  let svc: PaymentService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [PaymentService, provideHttpClient(), provideHttpClientTesting()],
    });
    svc = TestBed.inject(PaymentService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('GET /payments returns resident own payments', () => {
    let result: PaymentDto[] | undefined;
    svc.getMyPayments().subscribe(v => (result = v));
    http.expectOne('http://localhost:5000/payments').flush([PAYMENT]);
    expect(result).toEqual([PAYMENT]);
  });

  it('GET /payments/all returns all payments for admin', () => {
    let result: PaymentDto[] | undefined;
    svc.getAllPayments().subscribe(v => (result = v));
    http.expectOne('http://localhost:5000/payments/all').flush([PAYMENT]);
    expect(result).toEqual([PAYMENT]);
  });

  it('POST /payments records a payment', () => {
    let result: PaymentDto | undefined;
    const body = { householdRef: 'H001', amountEur: 150, period: '2026-07', dateReceived: '2026-07-15', idempotencyKey: 'ik1' };
    svc.recordPayment(body).subscribe(v => (result = v));
    const req = http.expectOne('http://localhost:5000/payments');
    expect(req.request.method).toBe('POST');
    req.flush(PAYMENT, { status: 201, statusText: 'Created' });
    expect(result).toEqual(PAYMENT);
  });

  it('GET /balance returns balance dto', () => {
    let result: BalanceDto | undefined;
    svc.getBalance().subscribe(v => (result = v));
    http.expectOne('http://localhost:5000/balance').flush(BALANCE);
    expect(result).toEqual(BALANCE);
  });
});
