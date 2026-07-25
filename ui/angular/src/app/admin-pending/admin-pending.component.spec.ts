import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { AdminPendingComponent } from './admin-pending.component';
import { AdminPendingService } from './admin-pending.service';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { PendingSignInDto } from './models';

const ENTRY: PendingSignInDto = {
  entraObjectId: 'oid-1',
  email: 'user@test.com',
  displayName: 'Test User',
  firstSeenAt: '2026-01-01T00:00:00Z',
};

describe('AdminPendingComponent', () => {
  const setup = async (serviceMock: Partial<AdminPendingService>) => {
    await TestBed.configureTestingModule({
      imports: [AdminPendingComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AdminPendingService, useValue: serviceMock },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(AdminPendingComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  };

  it('shows table row for each entry returned by listPending', async () => {
    const fixture = await setup({ listPending: () => of([ENTRY]) });
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="pending-row-oid-1"]')).not.toBeNull();
    expect(el.querySelector('[data-testid="pending-row-oid-1"]')?.textContent).toContain('Test User');
  });

  it('shows forbidden state when listPending returns 403', async () => {
    const fixture = await setup({
      listPending: () => throwError(() => Object.assign(new Error('forbidden'), { status: 403 })),
    });
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="forbidden-state"]')).not.toBeNull();
  });

  it('shows error state when listPending fails with non-403 error', async () => {
    const fixture = await setup({
      listPending: () => throwError(() => new Error('network error')),
    });
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="error-state"]')).not.toBeNull();
  });

  it('shows empty table when listPending returns empty array', async () => {
    const fixture = await setup({ listPending: () => of([]) });
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="pending-table"]')).not.toBeNull();
    expect(el.textContent).toContain('No pending sign-ins found.');
  });
});
