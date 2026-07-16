import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { FinancialService } from './financial.service';
import { PeriodSummaryDto, ChargeDto, PaymentDto } from './models';

describe('FinancialService', () => {
  let service: FinancialService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(FinancialService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('getPeriodSummary calls GET /financial-summary?period=2026-07', () => {
    const expected: PeriodSummaryDto = { period: '2026-07', totalChargesEur: 450, totalExpensesEur: 120 };
    let result: PeriodSummaryDto | undefined;
    service.getPeriodSummary('2026-07').subscribe(r => (result = r));
    const req = http.expectOne('http://localhost:5000/financial-summary?period=2026-07');
    expect(req.request.method).toBe('GET');
    req.flush(expected);
    expect(result).toEqual(expected);
  });

  it('getMyCharges calls GET /maintenance-fees/charges', () => {
    let result: ChargeDto[] | undefined;
    service.getMyCharges().subscribe(r => (result = r));
    const req = http.expectOne('http://localhost:5000/maintenance-fees/charges');
    expect(req.request.method).toBe('GET');
    req.flush([]);
    expect(result).toEqual([]);
  });

  it('getMyPayments calls GET /payments', () => {
    let result: PaymentDto[] | undefined;
    service.getMyPayments().subscribe((r: PaymentDto[]) => (result = r));
    const req = http.expectOne('http://localhost:5000/payments');
    expect(req.request.method).toBe('GET');
    req.flush([]);
    expect(result).toEqual([]);
  });
});
