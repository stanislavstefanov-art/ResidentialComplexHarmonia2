import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { PendingCountService } from './pending-count.service';

const URL = 'http://localhost:5000/admin/pending';

/** jsdom exposes visibilityState as a getter, so it has to be redefined rather than assigned. */
function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });
}

function fireVisibilityChange() {
  document.dispatchEvent(new Event('visibilitychange'));
}

describe('PendingCountService', () => {
  let svc: PendingCountService;
  let http: HttpTestingController;

  beforeEach(() => {
    vi.useFakeTimers();
    setVisibility('visible');
    TestBed.configureTestingModule({
      providers: [PendingCountService, provideHttpClient(), provideHttpClientTesting()],
    });
    svc = TestBed.inject(PendingCountService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    vi.useRealTimers();
  });

  it('fetches the count once on start', () => {
    svc.start();
    http.expectOne(URL).flush([{}, {}]);
    expect(svc.count()).toBe(2);
  });

  it('never polls on a timer', () => {
    svc.start();
    http.expectOne(URL).flush([{}]);

    // The old implementation ran setInterval(poll, 60_000). A timer-driven poll
    // reset the database's 60-minute auto-pause countdown forever, so it never slept.
    vi.advanceTimersByTime(10 * 60_000);

    http.expectNone(URL);
    expect(svc.count()).toBe(1);
  });

  it('refreshes when the admin returns to the tab', () => {
    svc.start();
    http.expectOne(URL).flush([{}]);

    vi.advanceTimersByTime(61_000);
    fireVisibilityChange();

    http.expectOne(URL).flush([{}, {}, {}]);
    expect(svc.count()).toBe(3);
  });

  it('ignores a tab switch that lands inside the throttle window', () => {
    svc.start();
    http.expectOne(URL).flush([{}]);

    vi.advanceTimersByTime(5_000);
    fireVisibilityChange();
    fireVisibilityChange();

    http.expectNone(URL);
  });

  it('does not refresh when the tab is merely hidden', () => {
    svc.start();
    http.expectOne(URL).flush([{}]);

    vi.advanceTimersByTime(61_000);
    setVisibility('hidden');
    fireVisibilityChange();

    http.expectNone(URL);
  });

  it('start is idempotent, so a second badge does not double the requests', () => {
    svc.start();
    svc.start();
    http.expectOne(URL).flush([{}]);
  });

  it('refresh() bypasses the throttle, since it follows an explicit admin action', () => {
    svc.start();
    http.expectOne(URL).flush([{}, {}]);

    // No timer advance: an approve/reject must update the badge immediately.
    svc.refresh();

    http.expectOne(URL).flush([{}]);
    expect(svc.count()).toBe(1);
  });
});
