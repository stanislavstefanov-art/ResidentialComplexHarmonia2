import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

import { TableModule, SortIcon } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { ToastModule } from 'primeng/toast';
import { TagModule } from 'primeng/tag';
import { CardModule } from 'primeng/card';
import { SelectButton } from 'primeng/selectbutton';
import { MessageService } from 'primeng/api';

import { DirectoryService } from './directory.service';
import { AdminContact, DirectoryEntry, DirectoryEntryAdmin, MyContact } from './models';

@Component({
  selector: 'app-directory-list',
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
    ToggleSwitchModule,
    ToastModule,
    TagModule,
    CardModule,
    SelectButton,
  ],
  providers: [MessageService],
  template: `
    <p-toast />

    <div class="harmonia-shell">
      <header class="harmonia-header">
        <span class="harmonia-logo">🏡 Harmonia</span>
        <span class="harmonia-subtitle">Resident Portal</span>
        <div class="flex-spacer"></div>
        <a routerLink="/directory" class="nav-link nav-active">Directory</a>
        <a routerLink="/reservations" class="nav-link">Reservations</a>
        <a routerLink="/financial" class="nav-link">Finance</a>
        <a routerLink="/expenses" class="nav-link">Expenses</a>
        <a routerLink="/maintenance-fees" class="nav-link">Fees</a>
        <a routerLink="/payments" class="nav-link">Payments</a>
        <a routerLink="/notifications" class="nav-link">Notifications</a>
        <span class="role-label">View as:</span>
        <p-selectbutton
          [options]="roleOptions"
          [ngModel]="selectedRole"
          (ngModelChange)="onRoleChange($event)"
          optionLabel="label"
          optionValue="value"
          styleClass="role-toggle"
        />
      </header>

      <main class="harmonia-content" [class.wide]="selectedRole === 'admin'">
        <p-card>
          <ng-template #title>
            <div class="card-title-row">
              <span>Member Directory</span>
              @if (selectedRole === 'resident') {
                <p-button
                  label="My Profile"
                  icon="pi pi-user-edit"
                  (onClick)="openEditDialog()"
                  [rounded]="true"
                  severity="secondary"
                />
              }
            </div>
          </ng-template>

          <ng-template #subtitle>
            @if (selectedRole === 'resident') {
              Showing residents who have shared their details.
            } @else {
              Admin view — all active residents including opted-out.
            }
          </ng-template>

          @if (loading()) {
            <div class="loading-row">
              <i class="pi pi-spin pi-spinner" style="font-size:1.5rem"></i>
              <span>Loading directory…</span>
            </div>
          } @else if (error()) {
            <div class="error-row">
              <i class="pi pi-exclamation-circle"></i>
              <span>{{ error() }}</span>
              <p-button label="Retry" icon="pi pi-refresh" severity="secondary" (onClick)="load()" />
            </div>
          } @else if (selectedRole === 'resident') {

            <!-- ── Resident table ── -->
            <p-table
              [value]="entries()"
              [paginator]="true"
              [rows]="10"
              [rowsPerPageOptions]="[10, 25, 50]"
              [globalFilterFields]="['displayName', 'householdRef']"
              styleClass="p-datatable-striped p-datatable-sm"
              #dt
            >
              <ng-template #caption>
                <div class="table-caption">
                  <span>{{ entries().length }} resident(s)</span>
                  <span class="p-input-icon-left">
                    <i class="pi pi-search"></i>
                    <input
                      pInputText type="text" placeholder="Search…"
                      (input)="dt.filterGlobal($any($event.target).value, 'contains')"
                    />
                  </span>
                </div>
              </ng-template>

              <ng-template #header>
                <tr>
                  <th pSortableColumn="householdRef" style="width:12rem">
                    Apartment <p-sort-icon field="householdRef" />
                  </th>
                  <th pSortableColumn="displayName">
                    Name <p-sort-icon field="displayName" />
                  </th>
                </tr>
              </ng-template>

              <ng-template #body let-entry>
                <tr>
                  <td><p-tag [value]="entry.householdRef" severity="secondary" /></td>
                  <td>{{ entry.displayName ?? '—' }}</td>
                </tr>
              </ng-template>

              <ng-template #emptymessage>
                <tr><td colspan="2" class="empty-message">No residents found.</td></tr>
              </ng-template>
            </p-table>

          } @else {

            <!-- ── Admin table ── -->
            <p-table
              [value]="adminEntries()"
              [paginator]="true"
              [rows]="25"
              [rowsPerPageOptions]="[25, 50, 100]"
              [globalFilterFields]="['displayName', 'householdRef', 'phone', 'email']"
              styleClass="p-datatable-striped p-datatable-sm"
              #adminDt
            >
              <ng-template #caption>
                <div class="table-caption">
                  <span>{{ adminEntries().length }} resident(s)</span>
                  <span class="p-input-icon-left">
                    <i class="pi pi-search"></i>
                    <input
                      pInputText type="text"
                      placeholder="Search name, apartment, phone, email…"
                      (input)="adminDt.filterGlobal($any($event.target).value, 'contains')"
                    />
                  </span>
                </div>
              </ng-template>

              <ng-template #header>
                <tr>
                  <th pSortableColumn="householdRef" style="width:10rem">
                    Apartment <p-sort-icon field="householdRef" />
                  </th>
                  <th pSortableColumn="displayName" style="width:14rem">
                    Name <p-sort-icon field="displayName" />
                  </th>
                  <th pSortableColumn="phone" style="width:12rem">
                    Phone <p-sort-icon field="phone" />
                  </th>
                  <th pSortableColumn="email" style="width:16rem">
                    Email <p-sort-icon field="email" />
                  </th>
                  <th style="width:9rem">Opt-out</th>
                  <th pSortableColumn="deactivatedAt" style="width:12rem">
                    Departed <p-sort-icon field="deactivatedAt" />
                  </th>
                  <th style="width:7rem"></th>
                </tr>
              </ng-template>

              <ng-template #body let-entry>
                <tr>
                  <td><p-tag [value]="entry.householdRef" severity="secondary" /></td>
                  <td>{{ entry.displayName ?? '—' }}</td>
                  <td>{{ entry.phone ?? '—' }}</td>
                  <td>{{ entry.email ?? '—' }}</td>
                  <td>
                    @if (entry.isOptedOut) {
                      <p-tag value="Opted out" severity="warn" />
                    } @else {
                      <p-tag value="Active" severity="success" />
                    }
                  </td>
                  <td>{{ entry.deactivatedAt ? (entry.deactivatedAt | date:'MMM d, y') : '—' }}</td>
                  <td>
                    <div class="action-cell">
                      <p-button
                        icon="pi pi-pencil"
                        [rounded]="true" [text]="true"
                        severity="secondary" size="small"
                        (onClick)="openAdminEdit(entry)"
                      />
                      <p-button
                        icon="pi pi-user-minus"
                        [rounded]="true" [text]="true"
                        severity="danger" size="small"
                        (onClick)="openDepartConfirm(entry.householdRef)"
                      />
                    </div>
                  </td>
                </tr>
              </ng-template>

              <ng-template #emptymessage>
                <tr><td colspan="7" class="empty-message">No residents found.</td></tr>
              </ng-template>
            </p-table>

          }
        </p-card>
      </main>
    </div>

    <!-- ── Resident edit dialog ── -->
    <p-dialog
      [(visible)]="editVisible"
      header="My Profile"
      [modal]="true" [style]="{ width: '32rem' }"
      [draggable]="false" [resizable]="false"
    >
      <div class="edit-form">
        <div class="field">
          <label for="displayName">Display Name</label>
          <input id="displayName" pInputText [(ngModel)]="form.displayName"
            placeholder="Your name as shown to neighbours" class="w-full" />
        </div>
        <div class="field">
          <label for="phone">Phone</label>
          <input id="phone" pInputText [(ngModel)]="form.phone"
            placeholder="+359 88 …" class="w-full" />
        </div>
        <div class="field">
          <label for="email">Email</label>
          <input id="email" pInputText type="email" [(ngModel)]="form.email"
            placeholder="you@example.com" class="w-full" />
        </div>
        <div class="field opt-out-field">
          <div class="opt-out-row">
            <div>
              <span class="opt-out-label">Hide me from the directory</span>
              <p class="opt-out-hint">
                When enabled, your name will not appear to other residents.
              </p>
            </div>
            <p-toggleswitch [(ngModel)]="form.isOptedOut" />
          </div>
        </div>
      </div>
      <ng-template #footer>
        <p-button label="Cancel" icon="pi pi-times" severity="secondary"
          [outlined]="true" (onClick)="editVisible = false" />
        <p-button label="Save" icon="pi pi-check"
          [loading]="saving()" (onClick)="save()" />
      </ng-template>
    </p-dialog>

    <!-- ── Admin edit dialog ── -->
    <p-dialog
      [(visible)]="adminEditVisible"
      [header]="'Edit Resident — ' + selectedAdminRef"
      [modal]="true" [style]="{ width: '36rem' }"
      [draggable]="false" [resizable]="false"
    >
      <div class="edit-form">
        <div class="field">
          <label>Display Name</label>
          <input pInputText [(ngModel)]="adminForm.displayName" class="w-full" />
        </div>
        <div class="field">
          <label>Phone</label>
          <input pInputText [(ngModel)]="adminForm.phone" class="w-full" />
        </div>
        <div class="field">
          <label>Email</label>
          <input pInputText type="email" [(ngModel)]="adminForm.email" class="w-full" />
        </div>
        <div class="field">
          <label>Notes</label>
          <textarea
            [(ngModel)]="adminForm.notes"
            rows="4"
            placeholder="Internal notes — not visible to resident"
            class="admin-notes"
          ></textarea>
        </div>
        <div class="field opt-out-field">
          <div class="opt-out-row">
            <span class="opt-out-label">Opted out of directory</span>
            <p-toggleswitch [(ngModel)]="adminForm.isOptedOut" />
          </div>
        </div>
      </div>
      <ng-template #footer>
        <p-button label="Cancel" icon="pi pi-times" severity="secondary"
          [outlined]="true" (onClick)="adminEditVisible = false" />
        <p-button label="Save" icon="pi pi-check"
          [loading]="adminSaving()" (onClick)="saveAdminEdit()" />
      </ng-template>
    </p-dialog>

    <!-- ── Mark Departed confirm dialog ── -->
    <p-dialog
      [(visible)]="departVisible"
      header="Mark as Departed?"
      [modal]="true" [style]="{ width: '28rem' }"
      [draggable]="false" [resizable]="false"
      [closable]="!departing()"
    >
      <p class="depart-message">
        Apartment <strong>{{ departRef }}</strong> will be removed from the
        active directory. This cannot be undone from this screen.
      </p>
      <ng-template #footer>
        <p-button
          label="Cancel" icon="pi pi-times"
          severity="secondary" [outlined]="true"
          [disabled]="departing()"
          (onClick)="departVisible = false"
        />
        <p-button
          label="Mark Departed" icon="pi pi-user-minus"
          severity="danger"
          [loading]="departing()"
          (onClick)="confirmDepart()"
        />
      </ng-template>
    </p-dialog>
  `,
  styles: [`
    .harmonia-shell { min-height: 100vh; background: var(--p-surface-ground); }

    .harmonia-header {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.75rem 2rem;
      background: var(--p-primary-color);
      color: var(--p-primary-contrast-color);
      box-shadow: 0 2px 8px rgba(0,0,0,.15);
    }

    .harmonia-logo   { font-size: 1.25rem; font-weight: 700; letter-spacing: -.5px; }
    .harmonia-subtitle { font-size: 0.875rem; opacity: .8; }
    .flex-spacer     { flex: 1; }
    .nav-link { color: rgba(255,255,255,.75); text-decoration: none; padding: 6px 12px; border-radius: 6px; font-size: .875rem; }
    .nav-link:hover { background: rgba(255,255,255,.1); }
    .nav-active { background: rgba(255,255,255,.22); color: white; font-weight: 600; }
    .role-label      { font-size: 0.8125rem; opacity: 0.75; white-space: nowrap; }

    ::ng-deep .role-toggle .p-selectbutton { border: 1px solid rgba(255,255,255,0.35); border-radius: 6px; overflow: hidden; }
    ::ng-deep .role-toggle .p-togglebutton { background: transparent !important; color: rgba(255,255,255,0.8) !important; border: none !important; padding: 0.375rem 1rem; font-size: 0.8125rem; }
    ::ng-deep .role-toggle .p-togglebutton.p-highlight { background: rgba(255,255,255,0.22) !important; color: white !important; font-weight: 600; }

    .harmonia-content { max-width: 900px; margin: 2rem auto; padding: 0 1rem; transition: max-width 0.2s; }
    .harmonia-content.wide { max-width: 1200px; }

    .card-title-row { display: flex; align-items: center; justify-content: space-between; }
    .table-caption  { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }

    .loading-row, .error-row {
      display: flex; align-items: center; gap: 0.75rem;
      padding: 2rem; color: var(--p-text-muted-color);
    }
    .error-row { color: var(--p-red-500, #ef4444); }
    .empty-message { text-align: center; padding: 2rem; color: var(--p-text-muted-color); }

    .action-cell    { display: flex; gap: 0.125rem; }

    .edit-form      { display: flex; flex-direction: column; gap: 1.25rem; padding-top: 0.5rem; }
    .field          { display: flex; flex-direction: column; gap: 0.375rem; }
    .field label    { font-size: 0.875rem; font-weight: 500; color: var(--p-text-color); }
    .field input, .field textarea { width: 100%; }

    .admin-notes {
      font-family: inherit;
      font-size: 0.875rem;
      padding: 0.5rem 0.75rem;
      border: 1px solid var(--p-inputtext-border-color, #cbd5e1);
      border-radius: 6px;
      color: var(--p-text-color);
      background: var(--p-inputtext-background, #fff);
      resize: vertical;
      line-height: 1.5;
    }
    .admin-notes:focus { outline: 2px solid var(--p-primary-color); outline-offset: -1px; }

    .opt-out-field  { border-top: 1px solid var(--p-surface-border); padding-top: 1.25rem; }
    .opt-out-row    { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
    .opt-out-label  { font-size: 0.875rem; font-weight: 500; }
    .opt-out-hint   { font-size: 0.8rem; color: var(--p-text-muted-color); margin: 0.25rem 0 0; }

    .depart-message { margin: 0; line-height: 1.6; color: var(--p-text-color); }

    .w-full { width: 100%; }
  `],
})
export class DirectoryListComponent implements OnInit {
  private readonly svc = inject(DirectoryService);
  private readonly msg = inject(MessageService);

  // ── shared ──
  loading = signal(false);
  error   = signal<string | null>(null);

  // ── role ──
  selectedRole: 'resident' | 'admin' = 'resident';
  roleOptions = [
    { label: 'Resident', value: 'resident' },
    { label: 'Admin',    value: 'admin'    },
  ];

  onRoleChange(role: 'resident' | 'admin') {
    this.selectedRole = role;
    this.load();
  }

  // ── resident ──
  entries     = signal<DirectoryEntry[]>([]);
  editVisible = false;
  saving      = signal(false);
  form: MyContact = { displayName: '', phone: '', email: '', isOptedOut: false };

  // ── admin ──
  adminEntries     = signal<DirectoryEntryAdmin[]>([]);
  adminEditVisible = false;
  adminSaving      = signal(false);
  selectedAdminRef = '';
  adminForm: AdminContact = { displayName: '', phone: '', email: '', notes: '', isOptedOut: false };

  // ── depart ──
  departVisible = false;
  departRef     = '';
  departing     = signal(false);

  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    this.error.set(null);
    if (this.selectedRole === 'resident') {
      this.svc.getDirectory().subscribe({
        next: e  => { this.entries.set(e);      this.loading.set(false); },
        error: () => { this.error.set(API_ERROR); this.loading.set(false); },
      });
    } else {
      this.svc.getAdminDirectory().subscribe({
        next: e  => { this.adminEntries.set(e); this.loading.set(false); },
        error: () => { this.error.set(API_ERROR); this.loading.set(false); },
      });
    }
  }

  // ── resident handlers ──
  openEditDialog() {
    this.form = { displayName: '', phone: '', email: '', isOptedOut: false };
    this.editVisible = true;
  }

  save() {
    this.saving.set(true);
    this.svc.updateMyContact({
      displayName: this.form.displayName || null,
      phone:       this.form.phone       || null,
      email:       this.form.email       || null,
      isOptedOut:  this.form.isOptedOut,
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.editVisible = false;
        this.msg.add({ severity: 'success', summary: 'Saved', detail: 'Your profile has been updated.' });
        this.load();
      },
      error: () => {
        this.saving.set(false);
        this.msg.add({ severity: 'error', summary: 'Error', detail: 'Could not save. Please try again.' });
      },
    });
  }

  // ── admin handlers ──
  openAdminEdit(entry: DirectoryEntryAdmin) {
    this.selectedAdminRef = entry.householdRef;
    this.adminForm = {
      displayName: entry.displayName ?? '',
      phone:       entry.phone       ?? '',
      email:       entry.email       ?? '',
      notes:       entry.notes       ?? '',
      isOptedOut:  entry.isOptedOut,
    };
    this.adminEditVisible = true;
  }

  saveAdminEdit() {
    this.adminSaving.set(true);
    this.svc.adminUpdateContact(this.selectedAdminRef, {
      displayName: this.adminForm.displayName || null,
      phone:       this.adminForm.phone       || null,
      email:       this.adminForm.email       || null,
      notes:       this.adminForm.notes       || null,
      isOptedOut:  this.adminForm.isOptedOut,
    }).subscribe({
      next: () => {
        this.adminSaving.set(false);
        this.adminEditVisible = false;
        this.msg.add({ severity: 'success', summary: 'Saved', detail: 'Resident updated.' });
        this.load();
      },
      error: () => {
        this.adminSaving.set(false);
        this.msg.add({ severity: 'error', summary: 'Error', detail: 'Could not save. Please try again.' });
      },
    });
  }

  // ── depart handlers ──
  openDepartConfirm(householdRef: string) {
    this.departRef     = householdRef;
    this.departVisible = true;
  }

  confirmDepart() {
    this.departing.set(true);
    this.svc.markDeparted(this.departRef).subscribe({
      next: () => {
        this.departing.set(false);
        this.departVisible = false;
        this.adminEntries.update(list => list.filter(e => e.householdRef !== this.departRef));
        this.msg.add({
          severity: 'success',
          summary: 'Departed',
          detail: `${this.departRef} marked as departed.`,
        });
      },
      error: () => {
        this.departing.set(false);
        this.msg.add({ severity: 'error', summary: 'Error', detail: 'Could not mark as departed.' });
      },
    });
  }
}

const API_ERROR = 'Could not reach the Harmonia API. Is it running on port 5000?';
