import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { MaintenanceFeeService } from './maintenance-fee.service';
import { ChargeDto } from './models';

const CHARGE: ChargeDto = {
  id: 'c1', householdRef: 'H001', amountEur: 150, description: 'Monthly fee',
  period: '2026-07', chargedAt: '2026-07-01T00:00:00Z', idempotencyKey: 'ik1',
};

describe('MaintenanceFeeService', () => {
  let svc: MaintenanceFeeService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [MaintenanceFeeService, provideHttpClient(), provideHttpClientTesting()],
    });
    svc = TestBed.inject(MaintenanceFeeService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('GET /maintenance-fees/charges returns resident charges', () => {
    let result: ChargeDto[] | undefined;
    svc.getMyCharges().subscribe(v => (result = v));
    http.expectOne('http://localhost:5000/maintenance-fees/charges').flush([CHARGE]);
    expect(result).toEqual([CHARGE]);
  });

  it('GET /maintenance-fees/charges/all returns all charges for admin', () => {
    let result: ChargeDto[] | undefined;
    svc.getAllCharges().subscribe(v => (result = v));
    http.expectOne('http://localhost:5000/maintenance-fees/charges/all').flush([CHARGE]);
    expect(result).toEqual([CHARGE]);
  });

  it('POST /maintenance-fees/charges/{householdRef} records a charge', () => {
    let result: ChargeDto | undefined;
    const body = { amountEur: 150, description: 'Monthly fee', period: '2026-07', idempotencyKey: 'ik1' };
    svc.recordCharge('H001', body).subscribe(v => (result = v));
    const req = http.expectOne('http://localhost:5000/maintenance-fees/charges/H001');
    expect(req.request.method).toBe('POST');
    req.flush(CHARGE, { status: 201, statusText: 'Created' });
    expect(result).toEqual(CHARGE);
  });
});
