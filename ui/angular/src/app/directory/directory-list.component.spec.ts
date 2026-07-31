import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { DirectoryListComponent } from './directory-list.component';
import { DirectoryService } from './directory.service';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { provideTranslateTesting } from '../../testing/translate-testing';
import { LanguageService } from '../language.service';

const ENTRY = { householdRef: 'AP-101', displayName: 'Alice' };
const ADMIN_ENTRY = {
  householdRef: 'AP-101', displayName: 'Alice', phone: '123', email: 'a@a.com',
  notes: '', isOptedOut: false, deactivatedAt: null,
};

describe('DirectoryListComponent', () => {
  const setup = async (serviceMock: Partial<DirectoryService>) => {
    await TestBed.configureTestingModule({
      imports: [DirectoryListComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: DirectoryService, useValue: serviceMock },
        provideTranslateTesting(),
        { provide: LanguageService, useValue: { current: signal('bg'), setLang: () => {} } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(DirectoryListComponent);
    fixture.detectChanges();
    return fixture;
  };

  it('renders the component without error', async () => {
    const fixture = await setup({
      getDirectory: () => of([ENTRY]),
      getAdminDirectory: () => of([ADMIN_ENTRY]),
      updateMyContact: () => of(undefined as any),
      adminUpdateContact: () => of(undefined as any),
      markDeparted: () => of(undefined as any),
      eraseMyContact: () => of(undefined as any),
      eraseContact: () => of(undefined as any),
    });
    fixture.detectChanges();
    expect(fixture.nativeElement).not.toBeNull();
  });

  it('shows loading state initially then renders entries', async () => {
    const fixture = await setup({
      getDirectory: () => of([ENTRY]),
      getAdminDirectory: () => of([ADMIN_ENTRY]),
      updateMyContact: () => of(undefined as any),
      adminUpdateContact: () => of(undefined as any),
      markDeparted: () => of(undefined as any),
      eraseMyContact: () => of(undefined as any),
      eraseContact: () => of(undefined as any),
    });
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    // After loading, there should be no loading spinner
    expect(el.querySelector('.loading-row')).toBeNull();
  });

  it('shows error row on API failure', async () => {
    const fixture = await setup({
      getDirectory: () => throwError(() => new Error('fail')),
      getAdminDirectory: () => of([]),
      updateMyContact: () => of(undefined as any),
      adminUpdateContact: () => of(undefined as any),
      markDeparted: () => of(undefined as any),
      eraseMyContact: () => of(undefined as any),
      eraseContact: () => of(undefined as any),
    });
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.error-row')).not.toBeNull();
  });
});
