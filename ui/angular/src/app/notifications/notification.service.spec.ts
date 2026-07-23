import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { NotificationService } from './notification.service';
import { NotificationRecordDto } from './models';

const NOTIFICATION: NotificationRecordDto = {
  id: 'n1', title: 'Test notice', sentAt: '2026-07-17T10:00:00Z', channel: 'web-push',
};

describe('NotificationService', () => {
  let svc: NotificationService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [NotificationService, provideHttpClient(), provideHttpClientTesting()],
    });
    svc = TestBed.inject(NotificationService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('GET /notifications returns notification history', () => {
    let result: NotificationRecordDto[] | undefined;
    svc.getHistory().subscribe(v => (result = v));
    http.expectOne('http://localhost:5000/notifications').flush([NOTIFICATION]);
    expect(result).toEqual([NOTIFICATION]);
  });

  it('POST /notifications/announce sends announcement', () => {
    let completed = false;
    svc.sendAnnouncement({ title: 'Test', body: 'Body' }).subscribe({ complete: () => (completed = true) });
    const req = http.expectOne('http://localhost:5000/notifications/announce');
    expect(req.request.method).toBe('POST');
    req.flush(null, { status: 202, statusText: 'Accepted' });
    expect(completed).toBe(true);
  });
});
