import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { NotificationComponent } from './notification.component';
import { NotificationService } from './notification.service';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { NotificationRecordDto } from './models';

const NOTIFICATION: NotificationRecordDto = {
  id: 'n1', title: 'Test notice', sentAt: '2026-07-17T10:00:00Z', channel: 'web-push',
};

describe('NotificationComponent', () => {
  const setup = async (
    serviceMock: Partial<NotificationService>,
    role: 'resident' | 'admin' = 'resident',
  ) => {
    await TestBed.configureTestingModule({
      imports: [NotificationComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: NotificationService, useValue: serviceMock },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(NotificationComponent);
    fixture.componentInstance.role = role;
    fixture.detectChanges();
    return fixture;
  };

  it('renders notification rows from getHistory', async () => {
    const fixture = await setup({
      getHistory: () => of([NOTIFICATION]),
      sendAnnouncement: () => of(undefined as any),
    }, 'resident');
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="notification-row-n1"]')).not.toBeNull();
    expect(el.querySelector('[data-testid="notification-row-n1"]')?.textContent).toContain('Test notice');
  });

  it('shows announce form for admin role', async () => {
    const fixture = await setup({
      getHistory: () => of([]),
      sendAnnouncement: () => of(undefined as any),
    }, 'admin');
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="announce-form"]')).not.toBeNull();
  });

  it('hides announce form for resident role', async () => {
    const fixture = await setup({
      getHistory: () => of([]),
      sendAnnouncement: () => of(undefined as any),
    }, 'resident');
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="announce-form"]')).toBeNull();
  });

  it('shows error state when getHistory fails', async () => {
    const fixture = await setup({
      getHistory: () => throwError(() => new Error('network error')),
      sendAnnouncement: () => of(undefined as any),
    }, 'resident');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="error-state"]')).not.toBeNull();
  });

  it('renders empty state when no notifications', async () => {
    const fixture = await setup({
      getHistory: () => of([]),
      sendAnnouncement: () => of(undefined as any),
    }, 'resident');
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('No notifications on record.');
  });

  it('shows submit-error when sendAnnouncement fails', async () => {
    const sendFn = vi.fn().mockReturnValue(throwError(() => new Error('server error')));
    const fixture = await setup({
      getHistory: () => of([]),
      sendAnnouncement: sendFn,
    }, 'admin');
    fixture.componentInstance.form.title = 'Test Title';
    fixture.componentInstance.form.body = 'Test body text';
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const submitBtn = el.querySelector<HTMLButtonElement>('[data-testid="submit-btn"]');
    submitBtn?.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(el.querySelector('[data-testid="submit-error"]')).not.toBeNull();
  });

  it('submit calls sendAnnouncement and reloads list', async () => {
    const sendFn = vi.fn().mockReturnValue(of(undefined));
    const getHistoryFn = vi.fn().mockReturnValue(of([NOTIFICATION]));
    const fixture = await setup({
      getHistory: getHistoryFn,
      sendAnnouncement: sendFn,
    }, 'admin');
    fixture.componentInstance.form.title = 'Test Title';
    fixture.componentInstance.form.body = 'Test body text';
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const submitBtn = el.querySelector<HTMLButtonElement>('[data-testid="submit-btn"]');
    submitBtn?.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(sendFn).toHaveBeenCalledOnce();
    expect(getHistoryFn).toHaveBeenCalledTimes(2);
    expect(el.querySelector('[data-testid="submit-success"]')).not.toBeNull();
  });
});
