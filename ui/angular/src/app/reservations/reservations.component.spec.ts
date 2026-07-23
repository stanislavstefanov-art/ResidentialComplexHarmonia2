import { TestBed } from '@angular/core/testing';
import { ReservationsComponent } from './reservations.component';
import { ReservationsService } from './reservations.service';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { of, throwError } from 'rxjs';
import { provideRouter } from '@angular/router';

describe('ReservationsComponent', () => {
  const setupComponent = async (serviceMock: Partial<ReservationsService>) => {
    await TestBed.configureTestingModule({
      imports: [ReservationsComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ReservationsService, useValue: serviceMock },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(ReservationsComponent);
    fixture.detectChanges();
    return fixture;
  };

  it('renders slot cards from API response', async () => {
    const fixture = await setupComponent({
      getSlots: () => of({
        day: '2026-07-16',
        slots: [
          { slotKey: 'morning', state: 'free' as const },
          { slotKey: 'afternoon', state: 'taken-mine' as const },
          { slotKey: 'evening', state: 'taken-other' as const },
        ],
      }),
      claimSlot: () => of({ outcome: 'confirmed-yours' as const }),
    });
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelectorAll('[data-testid="slot-card"]').length).toBe(3);
    expect(el.querySelector('[data-testid="slot-card"][data-state="free"]')).not.toBeNull();
    expect(el.querySelector('[data-testid="slot-card"][data-state="taken-mine"]')).not.toBeNull();
  });

  it('claim happy path flips slot to taken-mine', async () => {
    const fixture = await setupComponent({
      getSlots: () => of({ day: '2026-07-16', slots: [{ slotKey: 'morning', state: 'free' as const }] }),
      claimSlot: () => of({ outcome: 'confirmed-yours' as const }),
    });
    fixture.detectChanges();
    const btn = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('[data-testid="claim-btn"]');
    btn?.click();
    fixture.detectChanges();
    const card = (fixture.nativeElement as HTMLElement).querySelector('[data-testid="slot-card"]');
    expect(card?.getAttribute('data-state')).toBe('taken-mine');
  });

  it('conflict outcome flips slot to taken-other', async () => {
    const fixture = await setupComponent({
      getSlots: () => of({ day: '2026-07-16', slots: [{ slotKey: 'morning', state: 'free' as const }] }),
      claimSlot: () => of({ outcome: 'refused-already-taken' as const }),
    });
    fixture.detectChanges();
    const btn = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('[data-testid="claim-btn"]');
    btn?.click();
    fixture.detectChanges();
    const card = (fixture.nativeElement as HTMLElement).querySelector('[data-testid="slot-card"]');
    expect(card?.getAttribute('data-state')).toBe('taken-other');
  });

  it('API error shows error state with retry button', async () => {
    const fixture = await setupComponent({
      getSlots: () => throwError(() => new Error('Network error')),
      claimSlot: () => of({ outcome: 'confirmed-yours' as const }),
    });
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="error-state"]')).not.toBeNull();
    expect(el.querySelector('[data-testid="retry-btn"]')).not.toBeNull();
  });
});
