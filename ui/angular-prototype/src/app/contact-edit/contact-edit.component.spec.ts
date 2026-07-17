import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { ContactEditComponent } from './contact-edit.component';
import { ContactEditService } from './contact-edit.service';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

describe('ContactEditComponent', () => {
  const setup = async (
    serviceMock: Partial<ContactEditService>,
    role: 'resident' | 'admin' = 'resident',
  ) => {
    await TestBed.configureTestingModule({
      imports: [ContactEditComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ContactEditService, useValue: serviceMock },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(ContactEditComponent);
    fixture.componentInstance.role = role;
    fixture.detectChanges();
    return fixture;
  };

  it('shows my-contact-form for resident', async () => {
    const fixture = await setup({
      updateMyContact: () => of(undefined),
      updateContact: () => of(undefined),
      updateNotes: () => of(undefined),
    }, 'resident');
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="my-contact-form"]')).not.toBeNull();
  });

  it('hides admin forms for resident', async () => {
    const fixture = await setup({
      updateMyContact: () => of(undefined),
      updateContact: () => of(undefined),
      updateNotes: () => of(undefined),
    }, 'resident');
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="admin-contact-form"]')).toBeNull();
    expect(el.querySelector('[data-testid="notes-form"]')).toBeNull();
  });

  it('shows admin forms for admin', async () => {
    const fixture = await setup({
      updateMyContact: () => of(undefined),
      updateContact: () => of(undefined),
      updateNotes: () => of(undefined),
    }, 'admin');
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="admin-contact-form"]')).not.toBeNull();
    expect(el.querySelector('[data-testid="notes-form"]')).not.toBeNull();
  });

  it('onUpdateMyContact calls service and shows success', async () => {
    const saveFn = vi.fn().mockReturnValue(of(undefined));
    const fixture = await setup({
      updateMyContact: saveFn,
      updateContact: () => of(undefined),
      updateNotes: () => of(undefined),
    }, 'resident');
    fixture.componentInstance.myForm.displayName = 'Ada Lovelace';
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    el.querySelector<HTMLButtonElement>('[data-testid="my-contact-btn"]')?.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(saveFn).toHaveBeenCalledOnce();
    expect(el.querySelector('[data-testid="my-contact-success"]')).not.toBeNull();
  });

  it('onUpdateContact calls service and shows success', async () => {
    const saveFn = vi.fn().mockReturnValue(of(undefined));
    const fixture = await setup({
      updateMyContact: () => of(undefined),
      updateContact: saveFn,
      updateNotes: () => of(undefined),
    }, 'admin');
    fixture.componentInstance.adminRef = 'H001';
    fixture.componentInstance.adminForm.displayName = 'Board Edit';
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    el.querySelector<HTMLButtonElement>('[data-testid="admin-contact-btn"]')?.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(saveFn).toHaveBeenCalledOnce();
    expect(el.querySelector('[data-testid="admin-contact-success"]')).not.toBeNull();
  });

  it('onUpdateNotes calls service and shows success', async () => {
    const saveFn = vi.fn().mockReturnValue(of(undefined));
    const fixture = await setup({
      updateMyContact: () => of(undefined),
      updateContact: () => of(undefined),
      updateNotes: saveFn,
    }, 'admin');
    fixture.componentInstance.notesRef = 'H001';
    fixture.componentInstance.notesText = 'Board note';
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    el.querySelector<HTMLButtonElement>('[data-testid="notes-btn"]')?.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(saveFn).toHaveBeenCalledOnce();
    expect(el.querySelector('[data-testid="notes-success"]')).not.toBeNull();
  });
});
