import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { ResidentPendingComponent } from './resident-pending.component';
import { MeService } from '../me.service';
import { MsalService } from '@azure/msal-angular';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { of } from 'rxjs';

const mockLogout = vi.fn();

const setup = async (meStatusValue: string) => {
  TestBed.resetTestingModule();
  await TestBed.configureTestingModule({
    imports: [ResidentPendingComponent],
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: MeService, useValue: { getStatus: () => of({ status: meStatusValue }) } },
      { provide: MsalService, useValue: { logoutRedirect: mockLogout, instance: {} } },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(ResidentPendingComponent);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return fixture;
};

describe('ResidentPendingComponent', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders heading "Account pending approval"', async () => {
    const fixture = await setup('pending');
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="pending-heading"]')?.textContent).toContain(
      'Account pending approval',
    );
  });

  it('"Check again" with pending response does not emit activated', async () => {
    const fixture = await setup('pending');
    let activated = false;
    fixture.componentInstance.activated.subscribe(() => (activated = true));
    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLElement>('[data-testid="check-again-btn"]')!
      .click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(activated).toBe(false);
  });

  it('"Check again" with ok response emits activated', async () => {
    const fixture = await setup('ok');
    let activated = false;
    fixture.componentInstance.activated.subscribe(() => (activated = true));
    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLElement>('[data-testid="check-again-btn"]')!
      .click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(activated).toBe(true);
  });

  it('"Sign out" button calls MsalService.logoutRedirect', async () => {
    const fixture = await setup('pending');
    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLElement>('[data-testid="sign-out-btn"]')!
      .click();
    expect(mockLogout).toHaveBeenCalledTimes(1);
  });
});
