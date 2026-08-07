import { Component, Input, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { LanguageSwitcherComponent } from '../language-switcher/language-switcher.component';
import { PrivacyService } from './privacy.service';
import { PurgeExpiredResult } from './models';
import { RoleService } from '../role.service';

@Component({
  selector: 'app-privacy',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, CardModule, ButtonModule, TranslatePipe, LanguageSwitcherComponent],
  template: `
    <div class="harmonia-shell">
      <header class="harmonia-header">
        <span class="harmonia-logo">🏡 {{ 'app.brand' | translate }}</span>
        <span class="harmonia-subtitle">{{ 'app.subtitle' | translate }}</span>
        <div class="flex-spacer"></div>
        <a routerLink="/directory" class="nav-link">{{ 'nav.directory' | translate }}</a>
        <a routerLink="/reservations" class="nav-link">{{ 'nav.reservations' | translate }}</a>
        <a routerLink="/financial" class="nav-link">{{ 'nav.finance' | translate }}</a>
        <a routerLink="/expenses" class="nav-link">{{ 'nav.expenses' | translate }}</a>
        <a routerLink="/maintenance-fees" class="nav-link">{{ 'nav.fees' | translate }}</a>
        <a routerLink="/payments" class="nav-link">{{ 'nav.payments' | translate }}</a>
        <a routerLink="/notifications" class="nav-link">{{ 'nav.notifications' | translate }}</a>
        <a routerLink="/contact-edit" class="nav-link">{{ 'nav.contactEdit' | translate }}</a>
        @if (isAdmin) { <a routerLink="/admin-pending" class="nav-link">{{ 'nav.adminPending' | translate }}</a> }
        <a routerLink="/privacy" class="nav-link nav-active">{{ 'nav.privacy' | translate }}</a>
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
            <ng-template #title>{{ 'privacy.deleteMine' | translate }}</ng-template>
            <ng-template #content>
              <p class="warn-text">{{ 'privacy.deleteMineDesc' | translate }}</p>
              <button
                data-testid="delete-my-data-btn"
                class="danger-btn"
                [disabled]="deleting()"
                (click)="onDeleteMyData()">
                {{ 'privacy.deleteMyDataBtn' | translate }}
              </button>
              @if (deleteSuccess()) {
                <p data-testid="delete-success" class="success-msg">{{ 'privacy.deletedMine' | translate }}</p>
              }
              @if (deleteError()) {
                <p data-testid="delete-error" class="error-msg">{{ deleteError() }}</p>
              }
            </ng-template>
          </p-card>
        }

        @if (role === 'admin') {
          <p-card styleClass="mb-card">
            <ng-template #title>{{ 'privacy.dsarTitle' | translate }}</ng-template>
            <ng-template #content>
              <div data-testid="erase-form" class="action-row">
                <input
                  type="text"
                  [(ngModel)]="eraseRef"
                  name="eraseRef"
                  class="form-input"
                  [placeholder]="'common.householdRef' | translate"
                />
                <button
                  data-testid="erase-btn"
                  class="danger-btn"
                  [disabled]="erasing()"
                  (click)="onEraseContact()">
                  {{ 'privacy.eraseContactBtn' | translate }}
                </button>
              </div>
              @if (eraseResult()) {
                <p data-testid="erase-result" class="success-msg">{{ eraseResult() }}</p>
              }
              @if (eraseError()) {
                <p data-testid="erase-error" class="error-msg">{{ eraseError() }}</p>
              }
            </ng-template>
          </p-card>

          <p-card styleClass="mb-card">
            <ng-template #title>{{ 'privacy.departTitle' | translate }}</ng-template>
            <ng-template #content>
              <div data-testid="depart-form" class="action-row">
                <input
                  type="text"
                  [(ngModel)]="departRef"
                  name="departRef"
                  class="form-input"
                  [placeholder]="'common.householdRef' | translate"
                />
                <button
                  data-testid="depart-btn"
                  class="action-btn"
                  [disabled]="departing()"
                  (click)="onMarkDeparted()">
                  {{ 'privacy.markDepartedBtn' | translate }}
                </button>
              </div>
              @if (departResult()) {
                <p data-testid="depart-result" class="success-msg">{{ departResult() }}</p>
              }
              @if (departError()) {
                <p data-testid="depart-error" class="error-msg">{{ departError() }}</p>
              }
            </ng-template>
          </p-card>

          <p-card>
            <ng-template #title>{{ 'privacy.sweepTitle' | translate }}</ng-template>
            <ng-template #content>
              <p class="warn-text">{{ 'privacy.sweepDesc' | translate }}</p>
              <button
                data-testid="purge-btn"
                class="danger-btn"
                [disabled]="purging()"
                (click)="onPurgeExpired()">
                {{ 'privacy.purgeBtn' | translate }}
              </button>
              @if (purgeMessage()) {
                <p data-testid="purge-result" class="success-msg">{{ purgeMessage() }}</p>
              }
              @if (purgeError()) {
                <p data-testid="purge-error" class="error-msg">{{ purgeError() }}</p>
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
    .warn-text { color: #888; font-size: .875rem; margin-bottom: 12px; }
    .action-row { display: flex; gap: 12px; align-items: center; margin-bottom: 12px; }
    .form-input { padding: 7px 10px; border: 1px solid #ccc; border-radius: 4px; font-size: .875rem; flex: 1; }
    .danger-btn { background: #c00; color: white; border: none; padding: 8px 20px; border-radius: 6px; cursor: pointer; font-size: .9rem; }
    .danger-btn:hover { background: #a00; }
    .danger-btn:disabled { opacity: .6; cursor: not-allowed; }
    .action-btn { background: #2e6b4f; color: white; border: none; padding: 8px 20px; border-radius: 6px; cursor: pointer; font-size: .9rem; }
    .action-btn:hover { background: #245a40; }
    .action-btn:disabled { opacity: .6; cursor: not-allowed; }
    .success-msg { color: #2e6b4f; font-weight: 500; margin-top: 8px; }
    .error-msg { color: #c00; margin-top: 8px; }
  `],
})
export class PrivacyComponent {
  @Input() role: 'resident' | 'admin' = 'resident';

  private readonly svc = inject(PrivacyService);
  private readonly t = inject(TranslateService);
  readonly isAdmin = inject(RoleService).isAdmin;

  readonly deleting      = signal(false);
  readonly deleteSuccess = signal(false);
  readonly deleteError   = signal<string | null>(null);

  eraseRef = '';
  readonly erasing     = signal(false);
  readonly eraseResult = signal<string | null>(null);
  readonly eraseError  = signal<string | null>(null);

  departRef = '';
  readonly departing     = signal(false);
  readonly departResult  = signal<string | null>(null);
  readonly departError   = signal<string | null>(null);

  readonly purging      = signal(false);
  readonly purgeMessage = signal<string | null>(null);
  readonly purgeError   = signal<string | null>(null);

  onDeleteMyData(): void {
    this.deleteSuccess.set(false);
    this.deleteError.set(null);
    this.deleting.set(true);
    this.svc.eraseMyContact().subscribe({
      next: () => { this.deleteSuccess.set(true); this.deleting.set(false); },
      error: () => { this.deleteError.set(this.t.instant('privacy.errDelete')); this.deleting.set(false); },
    });
  }

  onEraseContact(): void {
    if (!this.eraseRef) { this.eraseError.set(this.t.instant('privacy.errErase')); return; }
    this.eraseResult.set(null);
    this.eraseError.set(null);
    this.erasing.set(true);
    this.svc.eraseContact(this.eraseRef).subscribe({
      next: outcome => {
        this.eraseResult.set(outcome === 'erased' ? this.t.instant('privacy.toastErased') : this.t.instant('privacy.toastNotFound'));
        this.erasing.set(false);
      },
      error: () => { this.eraseError.set(this.t.instant('privacy.errErase')); this.erasing.set(false); },
    });
  }

  onMarkDeparted(): void {
    if (!this.departRef) { this.departError.set(this.t.instant('privacy.errDepart')); return; }
    this.departResult.set(null);
    this.departError.set(null);
    this.departing.set(true);
    this.svc.markDeparted(this.departRef).subscribe({
      next: outcome => {
        this.departResult.set(outcome === 'ok' ? this.t.instant('privacy.toastDeparted') : this.t.instant('privacy.toastDepartNotFound'));
        this.departing.set(false);
      },
      error: () => { this.departError.set(this.t.instant('privacy.errDepart')); this.departing.set(false); },
    });
  }

  onPurgeExpired(): void {
    this.purgeMessage.set(null);
    this.purgeError.set(null);
    this.purging.set(true);
    this.svc.purgeExpired().subscribe({
      next: result => { this.purgeMessage.set(this.t.instant('privacy.purgedCount', { count: result.deleted })); this.purging.set(false); },
      error: () => { this.purgeError.set(this.t.instant('privacy.errSweep')); this.purging.set(false); },
    });
  }
}
