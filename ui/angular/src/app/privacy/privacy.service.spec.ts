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

  it('DELETE /directory/{ref}/contact returns erased on 204', () => {
    let result: string | undefined;
    svc.eraseContact('H001').subscribe(v => (result = v));
    const req = http.expectOne('http://localhost:5000/directory/H001/contact');
    expect(req.request.method).toBe('DELETE');
    req.flush('', { status: 204, statusText: 'No Content' });
    expect(result).toBe('erased');
  });

  it('DELETE /directory/{ref}/contact returns not-found on 404', () => {
    let result: string | undefined;
    svc.eraseContact('H999').subscribe(v => (result = v));
    const req = http.expectOne('http://localhost:5000/directory/H999/contact');
    req.flush('', { status: 404, statusText: 'Not Found' });
    expect(result).toBe('not-found');
  });

  it('DELETE /directory/{ref}/departed marks household as departed', () => {
    let result: string | undefined;
    svc.markDeparted('H001').subscribe(v => (result = v));
    const req = http.expectOne('http://localhost:5000/directory/H001/departed');
    expect(req.request.method).toBe('DELETE');
    req.flush('', { status: 200, statusText: 'OK' });
    expect(result).toBe('ok');
  });

  it('DELETE /directory/{ref}/departed returns not-found on 404', () => {
    let result: string | undefined;
    svc.markDeparted('H999').subscribe(v => (result = v));
    const req = http.expectOne('http://localhost:5000/directory/H999/departed');
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
