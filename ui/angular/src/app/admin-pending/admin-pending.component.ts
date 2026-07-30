import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { TableModule, SortIcon } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { ToastModule } from 'primeng/toast';
import { TagModule } from 'primeng/tag';
import { CardModule } from 'primeng/card';
import { MessageService } from 'primeng/api';
import { AdminPendingService } from './admin-pending.service';
import { PendingSignInDto } from './models';
import { RoleService } from '../role.service';

@Component({
  selector: 'app-admin-pending',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    TableModule,
    SortIcon,
    ButtonModule,
    DialogModule,
    InputTextModule,
    ToastModule,
    TagModule,
    CardModule,
  ],
  providers: [MessageService],
  template: `
    <p-toast />

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
        <a routerLink="/contact-edit" class="nav-link">Edit Contact</a>
        @if (isAdmin) { <a routerLink="/admin-pending" class="nav-link nav-active">Pending Users</a> }
      </header>

      <main class="harmonia-content">
        <p-card>
          <ng-template #title>
            <div class="card-title-row">
              <span>Pending Sign-Ins</span>
              <button class="purge-btn" (click)="purgeVisible = true">
                Purge Expired (&gt;90 days)
              </button>
            </div>
          </ng-template>
          <ng-template #subtitle>Users awaiting household assignment.</ng-template>

          @if (loading()) {
            <div class="loading-row">
              <i class="pi pi-spin pi-spinner" style="font-size:1.5rem"></i>
              <span>Loading…</span>
            </div>
          } @else if (forbidden()) {
            <div data-testid="forbidden-state" class="info-row">
              <i class="pi pi-lock"></i>
              <span>Admin access required to view pending sign-ins.</span>
            </div>
          } @else if (error()) {
            <div data-testid="error-state" class="error-row">
              <i class="pi pi-exclamation-circle"></i>
              <span>{{ error() }}</span>
              <button class="retry-btn" (click)="load()">Retry</button>
            </div>
          } @else {
            <p-table
              data-testid="pending-table"
              [value]="rows()"
              [paginator]="true"
              [rows]="25"
              [rowsPerPageOptions]="[25, 50, 100]"
              styleClass="p-datatable-striped p-datatable-sm"
            >
              <ng-template #header>
                <tr>
                  <th pSortableColumn="displayName">Display Name <p-sort-icon field="displayName" /></th>
                  <th pSortableColumn="email" style="width:16rem">Email <p-sort-icon field="email" /></th>
                  <th style="width:14rem">OID</th>
                  <th pSortableColumn="firstSeenAt" style="width:10rem">First Seen <p-sort-icon field="firstSeenAt" /></th>
                  <th style="width:7rem"></th>
                </tr>
              </ng-template>
              <ng-template #body let-entry>
                <tr [attr.data-testid]="'pending-row-' + entry.entraObjectId">
                  <td>{{ entry.displayName }}</td>
                  <td>{{ entry.email }}</td>
                  <td><p-tag [value]="entry.entraObjectId" severity="secondary" styleClass="oid-tag" /></td>
                  <td>{{ entry.firstSeenAt | date:'mediumDate' }}</td>
                  <td>
                    <button class="link-btn" (click)="openActivate(entry)">
                      <i class="pi pi-link"></i> Link
                    </button>
                  </td>
                </tr>
              </ng-template>
              <ng-template #emptymessage>
                <tr><td colspan="5" class="empty-message">No pending sign-ins found.</td></tr>
              </ng-template>
            </p-table>
          }
        </p-card>
      </main>
    </div>

    <!-- Activate dialog -->
    <p-dialog
      [(visible)]="activateVisible"
      header="Link to Household"
      [modal]="true"
      [style]="{ width: '32rem' }"
      [draggable]="false"
      [resizable]="false"
    >
      <div class="dialog-body">
        <p class="oid-display">{{ activateOid }}</p>
        @if (activateError) {
          <p class="activate-error">{{ activateError }}</p>
        }
        <div class="field">
          <label for="householdRef">Household Ref</label>
          <input
            id="householdRef"
            pInputText
            [(ngModel)]="householdRef"
            placeholder="e.g. AP-101"
            class="w-full"
          />
        </div>
      </div>
      <ng-template #footer>
        <p-button label="Cancel" severity="secondary" [outlined]="true"
          (onClick)="activateVisible = false" [disabled]="activating()" />
        <p-button label="Link" icon="pi pi-link"
          [loading]="activating()" (onClick)="confirmActivate()"
          [disabled]="!householdRef" />
      </ng-template>
    </p-dialog>

    <!-- Purge dialog -->
    <p-dialog
      [(visible)]="purgeVisible"
      header="Purge Expired Entries?"
      [modal]="true"
      [style]="{ width: '28rem' }"
      [draggable]="false"
      [resizable]="false"
    >
      <p class="purge-message">
        This will permanently delete all pending sign-ins older than 90 days. This cannot be undone.
      </p>
      <ng-template #footer>
        <p-button label="Cancel" severity="secondary" [outlined]="true"
          (onClick)="purgeVisible = false" [disabled]="purging()" />
        <p-button label="Purge" severity="warn"
          [loading]="purging()" (onClick)="confirmPurge()" />
      </ng-template>
    </p-dialog>
  `,
  styles: [`
    .harmonia-shell { min-height: 100vh; background: var(--p-surface-ground); }
    .harmonia-header {
      display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem 2rem;
      background: var(--p-primary-color); color: var(--p-primary-contrast-color);
      box-shadow: 0 2px 8px rgba(0,0,0,.15);
    }
    .harmonia-logo   { font-size: 1.25rem; font-weight: 700; letter-spacing: -.5px; }
    .harmonia-subtitle { font-size: 0.875rem; opacity: .8; }
    .flex-spacer { flex: 1; }
    .nav-link { color: rgba(255,255,255,.75); text-decoration: none; padding: 6px 12px; border-radius: 6px; font-size: .875rem; }
    .nav-link:hover { background: rgba(255,255,255,.1); }
    .nav-active { background: rgba(255,255,255,.22); color: white; font-weight: 600; }
    .harmonia-content { max-width: 1100px; margin: 2rem auto; padding: 0 1rem; }
    .card-title-row { display: flex; align-items: center; justify-content: space-between; }
    .loading-row, .error-row, .info-row {
      display: flex; align-items: center; gap: 0.75rem; padding: 2rem; color: var(--p-text-muted-color);
    }
    .error-row { color: var(--p-red-500, #ef4444); }
    .empty-message { text-align: center; padding: 2rem; color: var(--p-text-muted-color); }
    .purge-btn { background: transparent; border: 1px solid #f97316; color: #f97316; padding: 6px 14px; border-radius: 6px; cursor: pointer; font-size: .875rem; }
    .purge-btn:hover { background: rgba(249,115,22,.1); }
    .link-btn { background: transparent; border: 1px solid var(--p-primary-color); color: var(--p-primary-color); padding: 4px 10px; border-radius: 6px; cursor: pointer; font-size: .8125rem; }
    .link-btn:hover { background: rgba(var(--p-primary-color-rgb, 46,107,79),.1); }
    .retry-btn { background: transparent; border: 1px solid currentColor; padding: 4px 10px; border-radius: 4px; cursor: pointer; }
    ::ng-deep .oid-tag .p-tag { font-family: monospace; font-size: .75rem; }
    .dialog-body { display: flex; flex-direction: column; gap: 1rem; padding-top: 0.5rem; }
    .oid-display { font-family: monospace; font-size: .8125rem; color: var(--p-text-muted-color); margin: 0; word-break: break-all; }
    .activate-error { color: var(--p-red-500, #ef4444); margin: 0; font-size: .875rem; }
    .field { display: flex; flex-direction: column; gap: 0.375rem; }
    .field label { font-size: .875rem; font-weight: 500; }
    .w-full { width: 100%; }
    .purge-message { margin: 0; line-height: 1.6; color: var(--p-text-color); }
  `],
})
export class AdminPendingComponent implements OnInit {
  private readonly svc = inject(AdminPendingService);
  private readonly msg = inject(MessageService);
  readonly isAdmin = inject(RoleService).isAdmin;

  loading   = signal(false);
  forbidden = signal(false);
  error     = signal<string | null>(null);
  rows      = signal<PendingSignInDto[]>([]);
  activating = signal(false);
  purging    = signal(false);

  activateVisible = false;
  purgeVisible    = false;
  activateOid     = '';
  householdRef    = '';
  activateError: string | null = null;

  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    this.forbidden.set(false);
    this.error.set(null);
    this.svc.listPending().subscribe({
      next: (data) => {
        this.rows.set(data);
        this.loading.set(false);
      },
      error: (err: { status?: number }) => {
        this.loading.set(false);
        if (err?.status === 403) {
          this.forbidden.set(true);
          this.rows.set([]);
        } else {
          this.error.set('Could not reach the Harmonia API. Is it running on port 5000?');
        }
      },
    });
  }

  openActivate(entry: PendingSignInDto) {
    this.activateOid  = entry.entraObjectId;
    this.householdRef = '';
    this.activateError = null;
    this.activateVisible = true;
  }

  confirmActivate() {
    this.activating.set(true);
    this.activateError = null;
    this.svc.activatePending(this.activateOid, { householdRef: this.householdRef }).subscribe({
      next: () => {
        this.activating.set(false);
        this.activateVisible = false;
        this.msg.add({ severity: 'success', summary: 'Linked', detail: 'Linked successfully.' });
        this.load();
      },
      error: (err: { status?: number }) => {
        this.activating.set(false);
        if (err?.status === 409) this.activateError = 'Already linked to a household.';
        else if (err?.status === 404) this.activateError = 'Pending entry no longer exists.';
        else if (err?.status === 403) this.activateError = 'Admin access required.';
        else this.msg.add({ severity: 'error', summary: 'Error', detail: 'Failed — please try again.' });
      },
    });
  }

  confirmPurge() {
    this.purging.set(true);
    this.svc.purgeExpired().subscribe({
      next: (result) => {
        this.purging.set(false);
        this.purgeVisible = false;
        const detail = result.deleted > 0
          ? `Deleted ${result.deleted} expired entries.`
          : 'No expired entries found.';
        this.msg.add({ severity: 'success', summary: 'Done', detail });
      },
      error: () => {
        this.purging.set(false);
        this.purgeVisible = false;
        this.msg.add({ severity: 'error', summary: 'Error', detail: 'Failed — please try again.' });
      },
    });
  }
}
