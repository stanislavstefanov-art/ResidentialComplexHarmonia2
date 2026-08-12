import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { AdminPendingService } from './admin-pending.service';
import { PendingSignInDto } from './models';

const ENTRY: PendingSignInDto = {
  entraObjectId: 'oid-1',
  email: 'user@test.com',
  displayName: 'Test User',
  firstSeenAt: '2026-01-01T00:00:00Z',
};

describe('AdminPendingService', () => {
  let svc: AdminPendingService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [AdminPendingService, provideHttpClient(), provideHttpClientTesting()],
    });
    svc = TestBed.inject(AdminPendingService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('GET /admin/pending returns pending list', () => {
    let result: PendingSignInDto[] | undefined;
    svc.listPending().subscribe((v: PendingSignInDto[]) => (result = v));
    http.expectOne('http://localhost:5000/admin/pending').flush([ENTRY]);
    expect(result).toEqual([ENTRY]);
  });

  it('POST /admin/pending/{oid}/activate sends householdRef', () => {
    let completed = false;
    svc.activatePending('oid-1', { householdRef: 'AP-101', role: 'resident' })
      .subscribe({ complete: () => (completed = true) });
    const req = http.expectOne('http://localhost:5000/admin/pending/oid-1/activate');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ householdRef: 'AP-101', role: 'resident' });
    req.flush(null, { status: 200, statusText: 'OK' });
    expect(completed).toBe(true);
  });

  it('DELETE /admin/pending/purge-expired returns deleted count', () => {
    let result: { deleted: number } | undefined;
    svc.purgeExpired().subscribe((v: { deleted: number }) => (result = v));
    const req = http.expectOne('http://localhost:5000/admin/pending/purge-expired');
    expect(req.request.method).toBe('DELETE');
    req.flush({ deleted: 5 });
    expect(result).toEqual({ deleted: 5 });
  });
});
