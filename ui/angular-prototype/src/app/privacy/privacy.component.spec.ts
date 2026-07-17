import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { PrivacyComponent } from './privacy.component';
import { PrivacyService } from './privacy.service';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

describe('PrivacyComponent', () => {
  const setup = async (
    serviceMock: Partial<PrivacyService>,
    role: 'resident' | 'admin' = 'resident',
  ) => {
    await TestBed.configureTestingModule({
      imports: [PrivacyComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: PrivacyService, useValue: serviceMock },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(PrivacyComponent);
    fixture.componentInstance.role = role;
    fixture.detectChanges();
    return fixture;
  };

  it('shows delete-my-data button for resident', async () => {
    const fixture = await setup({
      eraseMyContact: () => of(undefined),
      eraseContact: () => of('erased'),
      markDeparted: () => of('ok'),
      purgeExpired: () => of({ deleted: 0 }),
    }, 'resident');
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="delete-my-data-btn"]')).not.toBeNull();
  });

  it('hides admin cards for resident', async () => {
    const fixture = await setup({
      eraseMyContact: () => of(undefined),
      eraseContact: () => of('erased'),
      markDeparted: () => of('ok'),
      purgeExpired: () => of({ deleted: 0 }),
    }, 'resident');
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="erase-form"]')).toBeNull();
    expect(el.querySelector('[data-testid="purge-btn"]')).toBeNull();
  });

  it('shows admin cards for admin', async () => {
    const fixture = await setup({
      eraseMyContact: () => of(undefined),
      eraseContact: () => of('erased'),
      markDeparted: () => of('ok'),
      purgeExpired: () => of({ deleted: 0 }),
    }, 'admin');
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="erase-form"]')).not.toBeNull();
    expect(el.querySelector('[data-testid="purge-btn"]')).not.toBeNull();
  });

  it('onDeleteMyData calls eraseMyContact and shows success', async () => {
    const eraseFn = vi.fn().mockReturnValue(of(undefined));
    const fixture = await setup({
      eraseMyContact: eraseFn,
      eraseContact: () => of('erased'),
      markDeparted: () => of('ok'),
      purgeExpired: () => of({ deleted: 0 }),
    }, 'resident');
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const btn = el.querySelector<HTMLButtonElement>('[data-testid="delete-my-data-btn"]');
    btn?.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(eraseFn).toHaveBeenCalledOnce();
    expect(el.querySelector('[data-testid="delete-success"]')).not.toBeNull();
  });

  it('onEraseContact calls eraseContact and shows erase result', async () => {
    const eraseFn = vi.fn().mockReturnValue(of('erased'));
    const fixture = await setup({
      eraseMyContact: () => of(undefined),
      eraseContact: eraseFn,
      markDeparted: () => of('ok'),
      purgeExpired: () => of({ deleted: 0 }),
    }, 'admin');
    fixture.componentInstance.eraseRef = 'H001';
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const btn = el.querySelector<HTMLButtonElement>('[data-testid="erase-btn"]');
    btn?.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(eraseFn).toHaveBeenCalledOnce();
    expect(el.querySelector('[data-testid="erase-result"]')).not.toBeNull();
  });

  it('onMarkDeparted calls markDeparted and shows ok result', async () => {
    const departFn = vi.fn().mockReturnValue(of('ok'));
    const fixture = await setup({
      eraseMyContact: () => of(undefined),
      eraseContact: () => of('erased'),
      markDeparted: departFn,
      purgeExpired: () => of({ deleted: 0 }),
    }, 'admin');
    fixture.componentInstance.departRef = 'H001';
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const btn = el.querySelector<HTMLButtonElement>('[data-testid="depart-btn"]');
    btn?.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(departFn).toHaveBeenCalledOnce();
    expect(el.querySelector('[data-testid="depart-result"]')).not.toBeNull();
  });

  it('onMarkDeparted shows not-found result when household does not exist', async () => {
    const departFn = vi.fn().mockReturnValue(of('not-found'));
    const fixture = await setup({
      eraseMyContact: () => of(undefined),
      eraseContact: () => of('erased'),
      markDeparted: departFn,
      purgeExpired: () => of({ deleted: 0 }),
    }, 'admin');
    fixture.componentInstance.departRef = 'H999';
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const btn = el.querySelector<HTMLButtonElement>('[data-testid="depart-btn"]');
    btn?.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(el.querySelector('[data-testid="depart-result"]')?.textContent).toContain('not found');
  });

  it('onPurgeExpired calls purgeExpired and shows deleted count', async () => {
    const purgeFn = vi.fn().mockReturnValue(of({ deleted: 3 }));
    const fixture = await setup({
      eraseMyContact: () => of(undefined),
      eraseContact: () => of('erased'),
      markDeparted: () => of('ok'),
      purgeExpired: purgeFn,
    }, 'admin');
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const btn = el.querySelector<HTMLButtonElement>('[data-testid="purge-btn"]');
    btn?.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(purgeFn).toHaveBeenCalledOnce();
    expect(el.querySelector('[data-testid="purge-result"]')?.textContent).toContain('3');
  });
});
