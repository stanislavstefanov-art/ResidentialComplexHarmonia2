import { Component, Input, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { ContactEditService } from './contact-edit.service';

@Component({
  selector: 'app-contact-edit',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, CardModule, ButtonModule],
  template: `
    <div class="harmonia-shell">
      <header class="harmonia-header">
        <span class="harmonia-logo">🏡 Harmonia</span>
        <span class="harmonia-subtitle">Resident Portal</span>
        <div class="flex-spacer"></div>
        <a routerLink="/directory" class="nav-link">Directory</a>
        <a routerLink="/reservations" class="nav-link">Reservations</a>
        <a routerLink="/financial" class="nav-link">Finance</a>
        <a routerLink="/expenses" class="nav-link">Expenses</a>
        <a routerLink="/maintenance-fees" class="nav-link">Fees</a>
        <a routerLink="/payments" class="nav-link">Payments</a>
        <a routerLink="/notifications" class="nav-link">Notifications</a>
        <a routerLink="/privacy" class="nav-link">Privacy</a>
        <a routerLink="/contact-edit" class="nav-link nav-active">Edit Contact</a>
        <span class="role-toggle">
          <button [class.role-active]="role === 'resident'" (click)="role = 'resident'" class="role-btn">Resident</button>
          <button [class.role-active]="role === 'admin'" (click)="role = 'admin'" class="role-btn">Admin</button>
        </span>
      </header>

      <main class="harmonia-content">

        @if (role === 'resident') {
          <p-card>
            <ng-template #title>My Contact Details</ng-template>
            <ng-template #content>
              <form data-testid="my-contact-form" (ngSubmit)="onUpdateMyContact()">
                <div class="field-row">
                  <label>Display Name</label>
                  <input type="text" [(ngModel)]="myForm.displayName" name="displayName" class="form-input" />
                </div>
                <div class="field-row">
                  <label>Phone</label>
                  <input type="text" [(ngModel)]="myForm.phone" name="phone" class="form-input" />
                </div>
                <div class="field-row">
                  <label>Email</label>
                  <input type="email" [(ngModel)]="myForm.email" name="email" class="form-input" />
                </div>
                <div class="field-row check-row">
                  <label>
                    <input type="checkbox" [(ngModel)]="myForm.optedOut" name="optedOut" />
                    Opt out of directory listing
                  </label>
                </div>
                <button type="submit" data-testid="my-contact-btn" class="action-btn" [disabled]="mySaving()">
                  Save Changes
                </button>
              </form>
              @if (mySuccess()) {
                <p data-testid="my-contact-success" class="success-msg">Contact details saved.</p>
              }
              @if (myError()) {
                <p data-testid="my-contact-error" class="error-msg">{{ myError() }}</p>
              }
            </ng-template>
          </p-card>
        }

        @if (role === 'admin') {
          <p-card styleClass="mb-card">
            <ng-template #title>Update Household Contact</ng-template>
            <ng-template #content>
              <form data-testid="admin-contact-form" (ngSubmit)="onUpdateContact()">
                <div class="field-row">
                  <label>Household Ref</label>
                  <input type="text" [(ngModel)]="adminRef" name="adminRef" class="form-input" placeholder="e.g. H001" required />
                </div>
                <div class="field-row">
                  <label>Display Name</label>
                  <input type="text" [(ngModel)]="adminForm.displayName" name="displayName" class="form-input" />
                </div>
                <div class="field-row">
                  <label>Phone</label>
                  <input type="text" [(ngModel)]="adminForm.phone" name="phone" class="form-input" />
                </div>
                <div class="field-row">
                  <label>Email</label>
                  <input type="email" [(ngModel)]="adminForm.email" name="email" class="form-input" />
                </div>
                <div class="field-row check-row">
                  <label>
                    <input type="checkbox" [(ngModel)]="adminForm.optedOut" name="optedOut" />
                    Opted out
                  </label>
                </div>
                <button type="submit" data-testid="admin-contact-btn" class="action-btn" [disabled]="adminSaving()">
                  Update Contact
                </button>
              </form>
              @if (adminSuccess()) {
                <p data-testid="admin-contact-success" class="success-msg">Contact updated.</p>
              }
              @if (adminError()) {
                <p data-testid="admin-contact-error" class="error-msg">{{ adminError() }}</p>
              }
            </ng-template>
          </p-card>

          <p-card>
            <ng-template #title>Update Notes</ng-template>
            <ng-template #content>
              <form data-testid="notes-form" (ngSubmit)="onUpdateNotes()">
                <div class="field-row">
                  <label>Household Ref</label>
                  <input type="text" [(ngModel)]="notesRef" name="notesRef" class="form-input" placeholder="e.g. H001" required />
                </div>
                <div class="field-row">
                  <label>Notes</label>
                  <textarea [(ngModel)]="notesText" name="notes" class="form-textarea" rows="3"></textarea>
                </div>
                <button type="submit" data-testid="notes-btn" class="action-btn" [disabled]="notesSaving()">
                  Update Notes
                </button>
              </form>
              @if (notesSuccess()) {
                <p data-testid="notes-success" class="success-msg">Notes updated.</p>
              }
              @if (notesError()) {
                <p data-testid="notes-error" class="error-msg">{{ notesError() }}</p>
              }
            </ng-template>
          </p-card>
        }

      </main>
    </div>
  `,
  styles: [`
    .harmonia-shell { min-height: 100vh; background: #f5f5f0; }
    .harmonia-header {
      display: flex; align-items: center; gap: 12px; padding: 12px 24px;
      background: #2e6b4f; color: white;
    }
    .harmonia-logo { font-size: 1.25rem; font-weight: 700; }
    .harmonia-subtitle { opacity: .7; font-size: .875rem; }
    .flex-spacer { flex: 1; }
    .nav-link { color: rgba(255,255,255,.75); text-decoration: none; padding: 6px 12px; border-radius: 6px; font-size: .875rem; }
    .nav-link:hover { background: rgba(255,255,255,.1); }
    .nav-active { background: rgba(255,255,255,.18); color: white; font-weight: 600; }
    .role-toggle { display: flex; border-radius: 6px; overflow: hidden; border: 1px solid rgba(255,255,255,.3); margin-left: 8px; }
    .role-btn { background: transparent; color: rgba(255,255,255,.75); border: none; padding: 4px 12px; cursor: pointer; font-size: .8125rem; }
    .role-btn.role-active { background: rgba(255,255,255,.22); color: white; font-weight: 600; }
    .harmonia-content { max-width: 700px; margin: 0 auto; padding: 24px 16px; display: flex; flex-direction: column; gap: 20px; }
    ::ng-deep .mb-card { margin-bottom: 0 !important; }
    .field-row { display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px; }
    .check-row { flex-direction: row; align-items: center; gap: 8px; }
    label { font-size: .875rem; color: #555; }
    .form-input { padding: 7px 10px; border: 1px solid #ccc; border-radius: 4px; font-size: .875rem; }
    .form-textarea { padding: 7px 10px; border: 1px solid #ccc; border-radius: 4px; font-size: .875rem; resize: vertical; }
    .action-btn { background: #2e6b4f; color: white; border: none; padding: 8px 20px; border-radius: 6px; cursor: pointer; font-size: .9rem; margin-top: 4px; }
    .action-btn:hover { background: #245a40; }
    .action-btn:disabled { opacity: .6; cursor: not-allowed; }
    .success-msg { color: #2e6b4f; font-weight: 500; margin-top: 8px; }
    .error-msg { color: #c00; margin-top: 8px; }
  `],
})
export class ContactEditComponent {
  @Input() role: 'resident' | 'admin' = 'resident';

  private readonly svc = inject(ContactEditService);

  myForm = { displayName: '', phone: '', email: '', optedOut: false };
  readonly mySaving   = signal(false);
  readonly mySuccess  = signal(false);
  readonly myError    = signal<string | null>(null);

  adminRef  = '';
  adminForm = { displayName: '', phone: '', email: '', optedOut: false };
  readonly adminSaving  = signal(false);
  readonly adminSuccess = signal(false);
  readonly adminError   = signal<string | null>(null);

  notesRef  = '';
  notesText = '';
  readonly notesSaving  = signal(false);
  readonly notesSuccess = signal(false);
  readonly notesError   = signal<string | null>(null);

  onUpdateMyContact(): void {
    this.mySuccess.set(false);
    this.myError.set(null);
    this.mySaving.set(true);
    this.svc.updateMyContact({
      displayName: this.myForm.displayName || null,
      phone:       this.myForm.phone       || null,
      email:       this.myForm.email       || null,
      optedOut:    this.myForm.optedOut,
    }).subscribe({
      next:  () => { this.mySuccess.set(true); this.mySaving.set(false); },
      error: () => { this.myError.set('Could not save contact details. Please try again.'); this.mySaving.set(false); },
    });
  }

  onUpdateContact(): void {
    if (!this.adminRef) { this.adminError.set('Enter a household ref.'); return; }
    this.adminSuccess.set(false);
    this.adminError.set(null);
    this.adminSaving.set(true);
    this.svc.updateContact(this.adminRef, {
      displayName: this.adminForm.displayName || null,
      phone:       this.adminForm.phone       || null,
      email:       this.adminForm.email       || null,
      optedOut:    this.adminForm.optedOut,
    }).subscribe({
      next:  () => { this.adminSuccess.set(true); this.adminSaving.set(false); },
      error: () => { this.adminError.set('Could not update contact. Please try again.'); this.adminSaving.set(false); },
    });
  }

  onUpdateNotes(): void {
    if (!this.notesRef) { this.notesError.set('Enter a household ref.'); return; }
    this.notesSuccess.set(false);
    this.notesError.set(null);
    this.notesSaving.set(true);
    this.svc.updateNotes(this.notesRef, this.notesText || null).subscribe({
      next:  () => { this.notesSuccess.set(true); this.notesSaving.set(false); },
      error: () => { this.notesError.set('Could not update notes. Please try again.'); this.notesSaving.set(false); },
    });
  }
}
