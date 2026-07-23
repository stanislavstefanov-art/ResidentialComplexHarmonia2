import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { ContactEditService } from './contact-edit.service';

describe('ContactEditService', () => {
  let svc: ContactEditService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ContactEditService, provideHttpClient(), provideHttpClientTesting()],
    });
    svc = TestBed.inject(ContactEditService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('PUT /directory/contact updates resident own contact', () => {
    let done = false;
    svc.updateMyContact({ displayName: 'Ada Lovelace', phone: '+1234' }).subscribe({ complete: () => (done = true) });
    const req = http.expectOne('http://localhost:5000/directory/contact');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toMatchObject({ displayName: 'Ada Lovelace', phone: '+1234' });
    req.flush('', { status: 200, statusText: 'OK' });
    expect(done).toBe(true);
  });

  it('PUT /directory/{ref}/contact updates board-managed contact', () => {
    let done = false;
    svc.updateContact('H001', { displayName: 'Board Edit' }).subscribe({ complete: () => (done = true) });
    const req = http.expectOne('http://localhost:5000/directory/H001/contact');
    expect(req.request.method).toBe('PUT');
    req.flush('', { status: 200, statusText: 'OK' });
    expect(done).toBe(true);
  });

  it('PUT /directory/{ref}/notes updates notes for a household', () => {
    let done = false;
    svc.updateNotes('H001', 'Some board note').subscribe({ complete: () => (done = true) });
    const req = http.expectOne('http://localhost:5000/directory/H001/notes');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toMatchObject({ notes: 'Some board note' });
    req.flush('', { status: 200, statusText: 'OK' });
    expect(done).toBe(true);
  });
});
