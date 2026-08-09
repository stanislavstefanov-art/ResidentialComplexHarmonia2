import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { PrivacyService } from './privacy.service';

describe('PrivacyService', () => {
  let svc: PrivacyService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [PrivacyService, provideHttpClient(), provideHttpClientTesting()],
    });
    svc = TestBed.inject(PrivacyService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('DELETE /directory/contact erases resident own contact', () => {
    let done = false;
    svc.eraseMyContact().subscribe({ complete: () => (done = true) });
    const req = http.expectOne('http://localhost:5000/directory/contact');
    expect(req.request.method).toBe('DELETE');
    req.flush('', { status: 204, statusText: 'No Content' });
    expect(done).toBe(true);
  });

  it('DELETE /directory/board/contact returns erased on 204', () => {
    let result: string | undefined;
    svc.eraseContact('H001').subscribe(v => (result = v));
    const req = http.expectOne('http://localhost:5000/directory/board/contact?householdRef=H001');
    expect(req.request.method).toBe('DELETE');
    req.flush('', { status: 204, statusText: 'No Content' });
    expect(result).toBe('erased');
  });

  it('DELETE /directory/board/contact encodes a multi-apartment ref in the query', () => {
    // Regression: a ref containing '/' must be encoded as %2F in the query string,
    // never placed in a path segment (ASP.NET leaves %2F undecoded in path segments).
    let result: string | undefined;
    svc.eraseContact('X3 АП1/2').subscribe(v => (result = v));
    const req = http.expectOne(
      'http://localhost:5000/directory/board/contact?householdRef=' + encodeURIComponent('X3 АП1/2'),
    );
    expect(req.request.method).toBe('DELETE');
    req.flush('', { status: 204, statusText: 'No Content' });
    expect(result).toBe('erased');
  });

  it('DELETE /directory/board/contact returns not-found on 404', () => {
    let result: string | undefined;
    svc.eraseContact('H999').subscribe(v => (result = v));
    const req = http.expectOne('http://localhost:5000/directory/board/contact?householdRef=H999');
    req.flush('', { status: 404, statusText: 'Not Found' });
    expect(result).toBe('not-found');
  });

  it('DELETE /directory/board/departed marks household as departed', () => {
    let result: string | undefined;
    svc.markDeparted('H001').subscribe(v => (result = v));
    const req = http.expectOne('http://localhost:5000/directory/board/departed?householdRef=H001');
    expect(req.request.method).toBe('DELETE');
    req.flush('', { status: 200, statusText: 'OK' });
    expect(result).toBe('ok');
  });

  it('DELETE /directory/board/departed returns not-found on 404', () => {
    let result: string | undefined;
    svc.markDeparted('H999').subscribe(v => (result = v));
    const req = http.expectOne('http://localhost:5000/directory/board/departed?householdRef=H999');
    req.flush('', { status: 404, statusText: 'Not Found' });
    expect(result).toBe('not-found');
  });

  it('DELETE /directory/purge-expired returns deleted count', () => {
    let result: { deleted: number } | undefined;
    svc.purgeExpired().subscribe(v => (result = v));
    const req = http.expectOne('http://localhost:5000/directory/purge-expired');
    expect(req.request.method).toBe('DELETE');
    req.flush({ deleted: 3 });
    expect(result).toEqual({ deleted: 3 });
  });
});
