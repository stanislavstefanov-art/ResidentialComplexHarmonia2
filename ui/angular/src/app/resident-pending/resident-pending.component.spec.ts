import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { vi } from 'vitest';
import { ResidentPendingComponent } from './resident-pending.component';
import { MeService } from '../me.service';
import { MsalService } from '@azure/msal-angular';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { of, throwError } from 'rxjs';
import { provideTranslateTesting } from '../../testing/translate-testing';
import { LanguageService } from '../language.service';

const mockLogout = vi.fn();

const mockLanguageService = {
  current: signal('bg' as const),
  setLang: () => {},
};

const setup = async (meStatusValue: string) => {
  TestBed.resetTestingModule();
  await TestBed.configureTestingModule({
    imports: [ResidentPendingComponent],
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideTranslateTesting(),
      { provide: MeService, useValue: { getStatus: () => of({ status: meStatusValue }) } },
      { provide: MsalService, useValue: { logoutRedirect: mockLogout, instance: {} } },
      { provide: LanguageService, useValue: mockLanguageService },
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

  it('renders pending-heading element', async () => {
    const fixture = await setup('pending');
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="pending-heading"]')).toBeTruthy();
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

  it('"Check again" with network error emits activated (fail-open)', async () => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [ResidentPendingComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideTranslateTesting(),
        { provide: MeService, useValue: { getStatus: () => throwError(() => new Error('network error')) } },
        { provide: MsalService, useValue: { logoutRedirect: mockLogout, instance: {} } },
        { provide: LanguageService, useValue: mockLanguageService },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(ResidentPendingComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    let activated = false;
    fixture.componentInstance.activated.subscribe(() => (activated = true));
    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLElement>('[data-testid="check-again-btn"]')!
      .click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(activated).toBe(true);
  });
});
