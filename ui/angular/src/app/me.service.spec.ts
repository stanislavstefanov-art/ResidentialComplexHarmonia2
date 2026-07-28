import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { MeService } from './me.service';

describe('MeService', () => {
  let svc: MeService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [MeService, provideHttpClient(), provideHttpClientTesting()],
    });
    svc = TestBed.inject(MeService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('GET /me returns status ok', () => {
    let result: { status: string } | undefined;
    svc.getStatus().subscribe((v) => (result = v));
    http.expectOne('http://localhost:5000/me').flush({ status: 'ok' });
    expect(result).toEqual({ status: 'ok' });
  });

  it('GET /me returns status pending', () => {
    let result: { status: string } | undefined;
    svc.getStatus().subscribe((v) => (result = v));
    http.expectOne('http://localhost:5000/me').flush({ status: 'pending' });
    expect(result).toEqual({ status: 'pending' });
  });
});
