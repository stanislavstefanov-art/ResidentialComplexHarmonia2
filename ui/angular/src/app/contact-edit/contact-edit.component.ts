import { Component, Input, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ContactEditService } from './contact-edit.service';
import { RoleService } from '../role.service';
import { NavComponent } from '../nav/nav.component';
import type { MyContactDto } from './models';

@Component({
  selector: 'app-contact-edit',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, CardModule, ButtonModule, TranslatePipe, NavComponent],
  template: `
    <div class="harmonia-shell">
      <app-nav [role]="role" (roleChange)="switchRole($event)" />

      <main class="harmonia-content">

        @if (role === 'resident') {
          <p-card>
            <ng-template #title>
              <div class="card-title-row">
                <span>{{ 'contactEdit.myTitle' | translate }}</span>
                @if (!editing() && contact() !== undefined && contact() !== null) {
                  <button class="edit-btn" (click)="enterEdit()">{{ 'common.edit' | translate }}</button>
                }
              </div>
            </ng-template>
            <ng-template #content>

              @if (contact() === undefined) {
                <p class="loading-msg">…</p>
              }

              @if (contact() !== undefined && !editing()) {
                <div class="read-view">
                  <div class="read-field">
                    <label>{{ 'common.displayName' | translate }}</label>
                    <span>{{ contact()?.displayName || '—' }}</span>
                  </div>
                  <div class="read-field">
                    <label>{{ 'common.phone' | translate }}</label>
                    <span>{{ contact()?.phone || '—' }}</span>
                  </div>
                  <div class="read-field">
                    <label>{{ 'common.email' | translate }}</label>
                    <span>{{ contact()?.email || '—' }}</span>
                  </div>
                  <div class="read-field check-row">
                    <input type="checkbox" [checked]="contact()?.isOptedOut" disabled />
                    <label>{{ 'contactEdit.optOut' | translate }}</label>
                  </div>
                </div>
              }

              @if (contact() !== undefined && editing()) {
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
                  <div class="btn-row">
                    <button type="submit" data-testid="my-contact-btn" class="action-btn" [disabled]="mySaving()">
                      {{ 'contactEdit.saveChanges' | translate }}
                    </button>
                    @if (contact() !== null) {
                      <button type="button" class="cancel-btn" (click)="editing.set(false)">
                        {{ 'common.cancel' | translate }}
                      </button>
                    }
                  </div>
                </form>
              }

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
    .card-title-row { display: flex; justify-content: space-between; align-items: center; }
    .edit-btn { background: transparent; border: 1px solid #2e6b4f; color: #2e6b4f; padding: 4px 14px; border-radius: 6px; cursor: pointer; font-size: .8125rem; }
    .edit-btn:hover { background: #f0f8f4; }
    .read-view { display: flex; flex-direction: column; gap: 12px; }
    .read-field { display: flex; flex-direction: column; gap: 2px; }
    .read-field label { font-size: .75rem; color: #888; }
    .read-field span { font-size: .9rem; color: #333; }
    .loading-msg { color: #888; font-size: .875rem; }
    .field-row { display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px; }
    .check-row { flex-direction: row; align-items: center; gap: 8px; }
    label { font-size: .875rem; color: #555; }
    .form-input { padding: 7px 10px; border: 1px solid #ccc; border-radius: 4px; font-size: .875rem; }
    .form-textarea { padding: 7px 10px; border: 1px solid #ccc; border-radius: 4px; font-size: .875rem; resize: vertical; }
    .btn-row { display: flex; gap: 8px; margin-top: 4px; }
    .action-btn { background: #2e6b4f; color: white; border: none; padding: 8px 20px; border-radius: 6px; cursor: pointer; font-size: .9rem; }
    .action-btn:hover { background: #245a40; }
    .action-btn:disabled { opacity: .6; cursor: not-allowed; }
    .cancel-btn { background: transparent; border: 1px solid #ccc; color: #555; padding: 8px 20px; border-radius: 6px; cursor: pointer; font-size: .9rem; }
    .cancel-btn:hover { background: #f5f5f5; }
    .success-msg { color: #2e6b4f; font-weight: 500; margin-top: 8px; }
    .error-msg { color: #c00; margin-top: 8px; }
  `],
})
export class ContactEditComponent implements OnInit {
  @Input() role: 'resident' | 'admin' = 'resident';

  private readonly svc = inject(ContactEditService);
  private readonly t = inject(TranslateService);
  readonly isAdmin = inject(RoleService).isAdmin;

  // undefined = loading, null = no row/error, MyContactDto = loaded
  readonly contact = signal<MyContactDto | null | undefined>(undefined);
  readonly editing = signal(false);

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

  ngOnInit(): void {
    if (this.role === 'resident') {
      this.loadMyContact();
    }
  }

  switchRole(r: 'resident' | 'admin'): void {
    this.role = r;
    if (r === 'resident') {
      this.contact.set(undefined);
      this.editing.set(false);
      this.loadMyContact();
    }
  }

  private loadMyContact(): void {
    this.svc.getMyContact().subscribe({
      next: (c) => {
        this.contact.set(c);
        if (c === null) {
          this.editing.set(true);
        } else {
          this.myForm.displayName = c.displayName ?? '';
          this.myForm.phone       = c.phone ?? '';
          this.myForm.email       = c.email ?? '';
          this.myForm.optedOut    = c.isOptedOut;
        }
      },
      error: () => {
        this.contact.set(null);
        this.editing.set(true);
      },
    });
  }

  enterEdit(): void {
    const c = this.contact();
    if (c) {
      this.myForm.displayName = c.displayName ?? '';
      this.myForm.phone       = c.phone ?? '';
      this.myForm.email       = c.email ?? '';
      this.myForm.optedOut    = c.isOptedOut;
    }
    this.mySuccess.set(false);
    this.myError.set(null);
    this.editing.set(true);
  }

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
      next: () => {
        const updated: MyContactDto = {
          displayName: this.myForm.displayName || null,
          phone:       this.myForm.phone       || null,
          email:       this.myForm.email       || null,
          isOptedOut:  this.myForm.optedOut,
        };
        this.contact.set(updated);
        this.mySuccess.set(true);
        this.mySaving.set(false);
        this.editing.set(false);
      },
      error: () => {
        this.myError.set(this.t.instant('contactEdit.errSave'));
        this.mySaving.set(false);
      },
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
