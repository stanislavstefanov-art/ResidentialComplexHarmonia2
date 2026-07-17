import { Component, Input, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { PrivacyService } from './privacy.service';
import { PurgeExpiredResult } from './models';

@Component({
  selector: 'app-privacy',
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
        <a routerLink="/privacy" class="nav-link nav-active">Privacy</a>
        <span class="role-toggle">
          <button [class.role-active]="role === 'resident'" (click)="role = 'resident'" class="role-btn">Resident</button>
          <button [class.role-active]="role === 'admin'" (click)="role = 'admin'" class="role-btn">Admin</button>
        </span>
      </header>

      <main class="harmonia-content">

        @if (role === 'resident') {
          <p-card>
            <ng-template #title>Delete My Contact Data</ng-template>
            <ng-template #content>
              <p class="warn-text">
                GDPR Art. 17 — Right to Erasure. This permanently removes your contact data and cannot be undone.
              </p>
              <button
                data-testid="delete-my-data-btn"
                class="danger-btn"
                [disabled]="deleting()"
                (click)="onDeleteMyData()">
                Delete My Data
              </button>
              @if (deleteSuccess()) {
                <p data-testid="delete-success" class="success-msg">Your contact data has been deleted.</p>
              }
              @if (deleteError()) {
                <p data-testid="delete-error" class="error-msg">{{ deleteError() }}</p>
              }
            </ng-template>
          </p-card>
        }

        @if (role === 'admin') {
          <p-card styleClass="mb-card">
            <ng-template #title>DSAR Contact Erasure</ng-template>
            <ng-template #content>
              <div data-testid="erase-form" class="action-row">
                <input
                  type="text"
                  [(ngModel)]="eraseRef"
                  name="eraseRef"
                  class="form-input"
                  placeholder="Household Ref (e.g. H001)"
                />
                <button
                  data-testid="erase-btn"
                  class="danger-btn"
                  [disabled]="erasing()"
                  (click)="onEraseContact()">
                  Erase Contact
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
            <ng-template #title>Mark Household as Departed</ng-template>
            <ng-template #content>
              <div data-testid="depart-form" class="action-row">
                <input
                  type="text"
                  [(ngModel)]="departRef"
                  name="departRef"
                  class="form-input"
                  placeholder="Household Ref (e.g. H001)"
                />
                <button
                  data-testid="depart-btn"
                  class="action-btn"
                  [disabled]="departing()"
                  (click)="onMarkDeparted()">
                  Mark Departed
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
            <ng-template #title>Annual Retention Sweep</ng-template>
            <ng-template #content>
              <p class="warn-text">Permanently deletes contacts whose retention period has expired.</p>
              <button
                data-testid="purge-btn"
                class="danger-btn"
                [disabled]="purging()"
                (click)="onPurgeExpired()">
                Purge Expired Contacts
              </button>
              @if (purgeResult()) {
                <p data-testid="purge-result" class="success-msg">{{ purgeResult()!.deleted }} contact(s) purged.</p>
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

  readonly purging     = signal(false);
  readonly purgeResult = signal<PurgeExpiredResult | null>(null);
  readonly purgeError  = signal<string | null>(null);

  onDeleteMyData(): void {
    this.deleteSuccess.set(false);
    this.deleteError.set(null);
    this.deleting.set(true);
    this.svc.eraseMyContact().subscribe({
      next: () => { this.deleteSuccess.set(true); this.deleting.set(false); },
      error: () => { this.deleteError.set('Could not delete contact data. Please try again.'); this.deleting.set(false); },
    });
  }

  onEraseContact(): void {
    if (!this.eraseRef) { this.eraseError.set('Enter a household ref.'); return; }
    this.eraseResult.set(null);
    this.eraseError.set(null);
    this.erasing.set(true);
    this.svc.eraseContact(this.eraseRef).subscribe({
      next: outcome => {
        this.eraseResult.set(outcome === 'erased' ? 'Contact erased.' : 'Contact not found.');
        this.erasing.set(false);
      },
      error: () => { this.eraseError.set('Could not complete erasure. Please try again.'); this.erasing.set(false); },
    });
  }

  onMarkDeparted(): void {
    if (!this.departRef) { this.departError.set('Enter a household ref.'); return; }
    this.departResult.set(null);
    this.departError.set(null);
    this.departing.set(true);
    this.svc.markDeparted(this.departRef).subscribe({
      next: outcome => {
        this.departResult.set(outcome === 'ok' ? 'Household marked as departed.' : 'Household not found.');
        this.departing.set(false);
      },
      error: () => { this.departError.set('Could not mark as departed. Please try again.'); this.departing.set(false); },
    });
  }

  onPurgeExpired(): void {
    this.purgeResult.set(null);
    this.purgeError.set(null);
    this.purging.set(true);
    this.svc.purgeExpired().subscribe({
      next: result => { this.purgeResult.set(result); this.purging.set(false); },
      error: () => { this.purgeError.set('Could not run retention sweep. Please try again.'); this.purging.set(false); },
    });
  }
}
