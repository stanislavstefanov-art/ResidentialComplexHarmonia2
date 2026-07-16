import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { ReservationsService } from './reservations.service';
import { DaySlotsResponse } from './models';

describe('ReservationsService', () => {
  let service: ReservationsService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ReservationsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('getSlots calls GET /days/{day}/slots', () => {
    const expected: DaySlotsResponse = {
      day: '2026-07-16',
      slots: [{ slotKey: 'morning', state: 'free' }],
    };
    let result: DaySlotsResponse | undefined;
    service.getSlots('2026-07-16').subscribe(r => (result = r));
    const req = http.expectOne('http://localhost:5000/days/2026-07-16/slots');
    expect(req.request.method).toBe('GET');
    req.flush(expected);
    expect(result).toEqual(expected);
  });

  it('claimSlot calls POST /days/{day}/slots/{slotKey}/claim', () => {
    let result: { outcome: string } | undefined;
    service.claimSlot('2026-07-16', 'morning').subscribe((r: { outcome: string }) => (result = r));
    const req = http.expectOne('http://localhost:5000/days/2026-07-16/slots/morning/claim');
    expect(req.request.method).toBe('POST');
    req.flush({ outcome: 'confirmed-yours' });
    expect(result?.outcome).toBe('confirmed-yours');
  });
});
