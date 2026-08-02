import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ReservationsComponent } from './reservations.component';
import { ReservationsService } from './reservations.service';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { of, throwError } from 'rxjs';
import { provideRouter } from '@angular/router';
import { provideTranslateTesting } from '../../testing/translate-testing';
import { LanguageService } from '../language.service';

describe('ReservationsComponent', () => {
  const setupComponent = async (serviceMock: Partial<ReservationsService>) => {
    await TestBed.configureTestingModule({
      imports: [ReservationsComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ReservationsService, useValue: serviceMock },
        provideTranslateTesting(),
        { provide: LanguageService, useValue: { current: signal('bg'), setLang: () => {} } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(ReservationsComponent);
    fixture.detectChanges();
    return fixture;
  };

  it('renders 14 day buttons in the strip', async () => {
    const fixture = await setupComponent({
      getSlots: () => of({ day: '2026-08-01', slots: [] }),
      claimSlot: () => of({ outcome: 'confirmed-yours' as const }),
    });
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelectorAll('.day-btn').length).toBe(14);
  });

  it('selecting a day loads slots and shows 16 hour buttons', async () => {
    const fixture = await setupComponent({
      getSlots: () => of({ day: '2026-08-02', slots: [] }),
      claimSlot: () => of({ outcome: 'confirmed-yours' as const }),
    });
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;

    // Click first non-disabled (non-past) day button
    const nonPast = Array.from(el.querySelectorAll<HTMLButtonElement>('.day-btn')).find(b => !b.disabled);
    nonPast?.click();
    fixture.detectChanges();

    expect(el.querySelectorAll('.hour-btn').length).toBe(16); // hours 8..23
  });

  it('tapping start then end reveals summary pill and book button', async () => {
    const fixture = await setupComponent({
      getSlots: () => of({
        day: '2026-08-03',
        slots: [
          { slotKey: '20', state: 'free' as const },
          { slotKey: '21', state: 'free' as const },
          { slotKey: '22', state: 'free' as const },
        ],
      }),
      claimSlot: () => of({ outcome: 'confirmed-yours' as const }),
    });
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;

    // Select a future day (second non-disabled = tomorrow)
    const nonPastBtns = Array.from(el.querySelectorAll<HTMLButtonElement>('.day-btn')).filter(b => !b.disabled);
    (nonPastBtns[1] ?? nonPastBtns[0])?.click();
    fixture.detectChanges();

    // Tap hour 20 (start)
    const h20 = el.querySelector<HTMLButtonElement>('[data-hour="20"]');
    h20?.click();
    fixture.detectChanges();

    // First tap immediately produces a 1-hour selection (20:00–21:00)
    expect(el.querySelector('.summary-pill')).not.toBeNull();
    expect(el.querySelector('.book-btn')).not.toBeNull();

    // Tap hour 22 (end = 22:00, range 20:00–23:00)
    const h22 = el.querySelector<HTMLButtonElement>('[data-hour="22"]');
    h22?.click();
    fixture.detectChanges();

    expect(el.querySelector('.summary-pill')).not.toBeNull();
    expect(el.querySelector('.book-btn')).not.toBeNull();
  });

  it('whole-evening chip sets start=17 end=23 without prior tap', async () => {
    const fixture = await setupComponent({
      getSlots: () => of({ day: '2026-08-04', slots: [] }),
      claimSlot: () => of({ outcome: 'confirmed-yours' as const }),
    });
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;

    const nonPastBtns = Array.from(el.querySelectorAll<HTMLButtonElement>('.day-btn')).filter(b => !b.disabled);
    (nonPastBtns[1] ?? nonPastBtns[0])?.click();
    fixture.detectChanges();

    // Click "Whole evening" chip (last dur-chip)
    const chips = el.querySelectorAll<HTMLButtonElement>('.dur-chip');
    chips[chips.length - 1]?.click();
    fixture.detectChanges();

    const pill = el.querySelector('.summary-pill');
    expect(pill).not.toBeNull();
    expect(pill?.textContent).toContain('17:00');
    expect(pill?.textContent).toContain('23:00');
  });

  it('booking happy path calls claimSlot for each hour and flips cells to occupied', async () => {
    let callCount = 0;
    const fixture = await setupComponent({
      getSlots: () => of({
        day: '2026-08-05',
        slots: [
          { slotKey: '20', state: 'free' as const },
          { slotKey: '21', state: 'free' as const },
        ],
      }),
      claimSlot: (_day: string, _key: string) => {
        callCount++;
        return of({ outcome: 'confirmed-yours' as const });
      },
    });
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;

    const nonPastBtns = Array.from(el.querySelectorAll<HTMLButtonElement>('.day-btn')).filter(b => !b.disabled);
    (nonPastBtns[1] ?? nonPastBtns[0])?.click();
    fixture.detectChanges();

    el.querySelector<HTMLButtonElement>('[data-hour="20"]')?.click();
    fixture.detectChanges();
    el.querySelector<HTMLButtonElement>('[data-hour="21"]')?.click(); // inclusive end → endHour=22, range [20,22)
    fixture.detectChanges();

    el.querySelector<HTMLButtonElement>('.book-btn')?.click();
    fixture.detectChanges();

    expect(callCount).toBe(2); // hours 20 and 21

    // After booking, hours 20 and 21 become mine (taken-mine → h-mine, distinct from h-occ)
    expect(el.querySelector('[data-hour="20"]')?.classList.contains('h-mine')).toBe(true);
    expect(el.querySelector('[data-hour="21"]')?.classList.contains('h-mine')).toBe(true);
  });

  it('slot load error shows error state with retry button', async () => {
    const fixture = await setupComponent({
      getSlots: () => throwError(() => new Error('Network error')),
      claimSlot: () => of({ outcome: 'confirmed-yours' as const }),
    });
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;

    // Select a day to trigger load
    const nonPast = Array.from(el.querySelectorAll<HTMLButtonElement>('.day-btn')).find(b => !b.disabled);
    nonPast?.click();
    fixture.detectChanges();

    expect(el.querySelector('[data-testid="error-state"]')).not.toBeNull();
    expect(el.querySelector('[data-testid="retry-btn"]')).not.toBeNull();
  });
});
