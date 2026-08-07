import { Component, Input, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ContactEditService } from './contact-edit.service';
import { RoleService } from '../role.service';
import { LanguageSwitcherComponent } from '../language-switcher/language-switcher.component';

@Component({
  selector: 'app-contact-edit',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, CardModule, ButtonModule, TranslatePipe, LanguageSwitcherComponent],
  template: `
    <div class="harmonia-shell">
      <header class="harmonia-header">
        <span class="harmonia-logo">🏡 {{ 'app.brand' | translate }}</span>
        <span class="harmonia-subtitle">{{ 'app.subtitle' | translate }}</span>
        <div class="flex-spacer"></div>
        <a routerLink="/notifications" class="nav-link">{{ 'nav.notifications' | translate }}</a>
        <a routerLink="/contact-edit" class="nav-link nav-active">{{ 'nav.contactEdit' | translate }}</a>
        <a routerLink="/financial" class="nav-link">{{ 'nav.finance' | translate }}</a>
        <a routerLink="/reservations" class="nav-link">{{ 'nav.reservations' | translate }}</a>
        @if (isAdmin) { <a routerLink="/admin-pending" class="nav-link">{{ 'nav.adminPending' | translate }}</a> }
        <a routerLink="/directory" class="nav-link">{{ 'nav.directory' | translate }}</a>
        <a routerLink="/privacy" class="nav-link">{{ 'nav.privacy' | translate }}</a>
        @if (isAdmin) {
        <span class="role-toggle">
          <button [class.role-active]="role === 'resident'" (click)="role = 'resident'" class="role-btn">{{ 'app.roleResident' | translate }}</button>
          <button [class.role-active]="role === 'admin'" (click)="role = 'admin'" class="role-btn">{{ 'app.roleAdmin' | translate }}</button>
        </span>
        }
        <app-language-switcher />
      </header>

      <main class="harmonia-content">

        @if (role === 'resident') {
          <p-card>
            <ng-template #title>{{ 'contactEdit.myTitle' | translate }}</ng-template>
            <ng-template #content>
              <form data-testid="my-contact-form" (ngSubmit)="onUpdateMyContact()">
                <div class="field-row">
                  <label>{{ 'common.displayName' | translate }}</label>
                  <input type="text" [(ngModel)]="myForm.displayName" name="displayName" class="form-input" />
                </div>
                <div class="field-row">
                  <label>{{ 'common.phone' | translate }}</label>
                  <input type="text" [(ngModel)]="myForm.phone" name="phone" class="form-input" />
                </div>
                <div class="field-row">
                  <label>{{ 'common.email' | translate }}</label>
                  <input type="email" [(ngModel)]="myForm.email" name="email" class="form-input" />
                </div>
                <div class="field-row check-row">
                  <label>
                    <input type="checkbox" [(ngModel)]="myForm.optedOut" name="optedOut" />
                    {{ 'contactEdit.optOut' | translate }}
                  </label>
                </div>
                <button type="submit" data-testid="my-contact-btn" class="action-btn" [disabled]="mySaving()">
                  {{ 'contactEdit.saveChanges' | translate }}
                </button>
              </form>
              @if (mySuccess()) {
                <p data-testid="my-contact-success" class="success-msg">{{ 'contactEdit.saved' | translate }}</p>
              }
              @if (myError()) {
                <p data-testid="my-contact-error" class="error-msg">{{ myError() }}</p>
              }
            </ng-template>
          </p-card>
        }

        @if (role === 'admin') {
          <p-card styleClass="mb-card">
            <ng-template #title>{{ 'contactEdit.updateContact' | translate }}</ng-template>
            <ng-template #content>
              <form data-testid="admin-contact-form" (ngSubmit)="onUpdateContact()">
                <div class="field-row">
                  <label>{{ 'common.householdRef' | translate }}</label>
                  <input type="text" [(ngModel)]="adminRef" name="adminRef" class="form-input" placeholder="e.g. H001" required />
                </div>
                <div class="field-row">
                  <label>{{ 'common.displayName' | translate }}</label>
                  <input type="text" [(ngModel)]="adminForm.displayName" name="displayName" class="form-input" />
                </div>
                <div class="field-row">
                  <label>{{ 'common.phone' | translate }}</label>
                  <input type="text" [(ngModel)]="adminForm.phone" name="phone" class="form-input" />
                </div>
                <div class="field-row">
                  <label>{{ 'common.email' | translate }}</label>
                  <input type="email" [(ngModel)]="adminForm.email" name="email" class="form-input" />
                </div>
                <div class="field-row check-row">
                  <label>
                    <input type="checkbox" [(ngModel)]="adminForm.optedOut" name="optedOut" />
                    Opted out
                  </label>
                </div>
                <button type="submit" data-testid="admin-contact-btn" class="action-btn" [disabled]="adminSaving()">
                  {{ 'contactEdit.updateContactBtn' | translate }}
                </button>
              </form>
              @if (adminSuccess()) {
                <p data-testid="admin-contact-success" class="success-msg">{{ 'contactEdit.contactUpdated' | translate }}</p>
              }
              @if (adminError()) {
                <p data-testid="admin-contact-error" class="error-msg">{{ adminError() }}</p>
              }
            </ng-template>
          </p-card>

          <p-card>
            <ng-template #title>{{ 'contactEdit.updateNotes' | translate }}</ng-template>
            <ng-template #content>
              <form data-testid="notes-form" (ngSubmit)="onUpdateNotes()">
                <div class="field-row">
                  <label>{{ 'common.householdRef' | translate }}</label>
                  <input type="text" [(ngModel)]="notesRef" name="notesRef" class="form-input" placeholder="e.g. H001" required />
                </div>
                <div class="field-row">
                  <label>{{ 'common.notes' | translate }}</label>
                  <textarea [(ngModel)]="notesText" name="notes" class="form-textarea" rows="3"></textarea>
                </div>
                <button type="submit" data-testid="notes-btn" class="action-btn" [disabled]="notesSaving()">
                  {{ 'contactEdit.updateNotes' | translate }}
                </button>
              </form>
              @if (notesSuccess()) {
                <p data-testid="notes-success" class="success-msg">{{ 'contactEdit.notesUpdated' | translate }}</p>
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
  private readonly t = inject(TranslateService);
  readonly isAdmin = inject(RoleService).isAdmin;

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
      error: () => { this.myError.set(this.t.instant('contactEdit.errSave')); this.mySaving.set(false); },
    });
  }

  onUpdateContact(): void {
    if (!this.adminRef) { this.adminError.set(this.t.instant('contactEdit.errUpdate')); return; }
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
      error: () => { this.adminError.set(this.t.instant('contactEdit.errUpdate')); this.adminSaving.set(false); },
    });
  }

  onUpdateNotes(): void {
    if (!this.notesRef) { this.notesError.set(this.t.instant('contactEdit.errNotes')); return; }
    this.notesSuccess.set(false);
    this.notesError.set(null);
    this.notesSaving.set(true);
    this.svc.updateNotes(this.notesRef, this.notesText || null).subscribe({
      next:  () => { this.notesSuccess.set(true); this.notesSaving.set(false); },
      error: () => { this.notesError.set(this.t.instant('contactEdit.errNotes')); this.notesSaving.set(false); },
    });
  }
}
