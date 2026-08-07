import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { LanguageSwitcherComponent } from '../language-switcher/language-switcher.component';

import { TableModule, SortIcon } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { ToastModule } from 'primeng/toast';
import { TagModule } from 'primeng/tag';
import { CardModule } from 'primeng/card';
import { MessageService } from 'primeng/api';

import { DirectoryService } from './directory.service';
import { AdminContact, DirectoryEntry, DirectoryEntryAdmin, MyContact } from './models';
import { RoleService } from '../role.service';

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
    TranslatePipe,
    LanguageSwitcherComponent,
  ],
  providers: [MessageService],
  template: `
    <p-toast />

    <div class="harmonia-shell">
      <header class="harmonia-header">
        <span class="harmonia-logo">🏡 {{ 'app.brand' | translate }}</span>
        <span class="harmonia-subtitle">{{ 'app.subtitle' | translate }}</span>
        <div class="flex-spacer"></div>
        <a routerLink="/directory" class="nav-link nav-active">{{ 'nav.directory' | translate }}</a>
        <a routerLink="/reservations" class="nav-link">{{ 'nav.reservations' | translate }}</a>
        <a routerLink="/financial" class="nav-link">{{ 'nav.finance' | translate }}</a>
        <a routerLink="/expenses" class="nav-link">{{ 'nav.expenses' | translate }}</a>
        <a routerLink="/maintenance-fees" class="nav-link">{{ 'nav.fees' | translate }}</a>
        <a routerLink="/payments" class="nav-link">{{ 'nav.payments' | translate }}</a>
        <a routerLink="/notifications" class="nav-link">{{ 'nav.notifications' | translate }}</a>
        <a routerLink="/contact-edit" class="nav-link">{{ 'nav.contactEdit' | translate }}</a>
        @if (isAdmin) { <a routerLink="/admin-pending" class="nav-link">{{ 'nav.adminPending' | translate }}</a> }
        <a routerLink="/privacy" class="nav-link">{{ 'nav.privacy' | translate }}</a>
        @if (isAdmin) {
        <span class="role-toggle">
          <button [class.role-active]="selectedRole === 'resident'" (click)="onRoleChange('resident')" class="role-btn">{{ 'app.roleResident' | translate }}</button>
          <button [class.role-active]="selectedRole === 'admin'" (click)="onRoleChange('admin')" class="role-btn">{{ 'app.roleAdmin' | translate }}</button>
        </span>
        }
        <app-language-switcher />
      </header>

      <main class="harmonia-content" [class.wide]="selectedRole === 'admin'">
        <p-card>
          <ng-template #title>
            <div class="card-title-row">
              <span>{{ 'directory.title' | translate }}</span>
              @if (selectedRole === 'resident') {
                <p-button
                  [label]="'directory.myProfile' | translate"
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
              {{ 'directory.residentSubtitle' | translate }}
            } @else {
              {{ 'directory.adminSubtitle' | translate }}
            }
          </ng-template>

          @if (loading()) {
            <div class="loading-row">
              <i class="pi pi-spin pi-spinner" style="font-size:1.5rem"></i>
              <span>{{ 'directory.loading' | translate }}</span>
            </div>
          } @else if (error()) {
            <div class="error-row">
              <i class="pi pi-exclamation-circle"></i>
              <span>{{ error() }}</span>
              <p-button [label]="'common.retry' | translate" icon="pi pi-refresh" severity="secondary" (onClick)="load()" />
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
                  <span>{{ 'directory.residentCount' | translate: { count: entries().length } }}</span>
                  <span class="p-input-icon-left">
                    <i class="pi pi-search"></i>
                    <input
                      pInputText type="text" [placeholder]="'directory.searchResident' | translate"
                      (input)="dt.filterGlobal($any($event.target).value, 'contains')"
                    />
                  </span>
                </div>
              </ng-template>

              <ng-template #header>
                <tr>
                  <th pSortableColumn="householdRef" style="width:12rem">
                    {{ 'directory.apartment' | translate }} <p-sort-icon field="householdRef" />
                  </th>
                  <th pSortableColumn="displayName">
                    {{ 'directory.name' | translate }} <p-sort-icon field="displayName" />
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
                <tr><td colspan="2" class="empty-message">{{ 'directory.noResidents' | translate }}</td></tr>
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
                  <span>{{ 'directory.residentCount' | translate: { count: adminEntries().length } }}</span>
                  <span class="p-input-icon-left">
                    <i class="pi pi-search"></i>
                    <input
                      pInputText type="text"
                      [placeholder]="'directory.searchAdmin' | translate"
                      (input)="adminDt.filterGlobal($any($event.target).value, 'contains')"
                    />
                  </span>
                </div>
              </ng-template>

              <ng-template #header>
                <tr>
                  <th pSortableColumn="householdRef" style="width:10rem">
                    {{ 'directory.apartment' | translate }} <p-sort-icon field="householdRef" />
                  </th>
                  <th pSortableColumn="displayName" style="width:14rem">
                    {{ 'directory.name' | translate }} <p-sort-icon field="displayName" />
                  </th>
                  <th pSortableColumn="phone" style="width:12rem">
                    {{ 'common.phone' | translate }} <p-sort-icon field="phone" />
                  </th>
                  <th pSortableColumn="email" style="width:16rem">
                    {{ 'common.email' | translate }} <p-sort-icon field="email" />
                  </th>
                  <th style="width:9rem">{{ 'directory.optOut' | translate }}</th>
                  <th pSortableColumn="deactivatedAt" style="width:12rem">
                    {{ 'directory.departed' | translate }} <p-sort-icon field="deactivatedAt" />
                  </th>
                  <th style="width:9rem"></th>
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
                      <p-tag [value]="'directory.optedOut' | translate" severity="warn" />
                    } @else {
                      <p-tag [value]="'directory.active' | translate" severity="success" />
                    }
                  </td>
                  <td>{{ entry.deactivatedAt ? (entry.deactivatedAt | date:'MMM d, y') : '—' }}</td>
                  <td>
                    <div class="action-cell">
                      <p-button
                        icon="pi pi-pencil"
                        [rounded]="true" [text]="true"
                        severity="secondary" size="small"
                        [title]="'directory.tipEdit' | translate"
                        (onClick)="openAdminEdit(entry)"
                      />
                      <p-button
                        icon="pi pi-user-minus"
                        [rounded]="true" [text]="true"
                        severity="danger" size="small"
                        [title]="'directory.tipDepart' | translate"
                        (onClick)="openDepartConfirm(entry.householdRef)"
                      />
                      <p-button
                        icon="pi pi-trash"
                        [rounded]="true" [text]="true"
                        severity="danger" size="small"
                        [title]="'directory.tipErase' | translate"
                        (onClick)="openEraseContact(entry.householdRef)"
                      />
                    </div>
                  </td>
                </tr>
              </ng-template>

              <ng-template #emptymessage>
                <tr><td colspan="7" class="empty-message">{{ 'directory.noResidents' | translate }}</td></tr>
              </ng-template>
            </p-table>

          }
        </p-card>
      </main>
    </div>

    <!-- ── Resident edit dialog ── -->
    <p-dialog
      [(visible)]="editVisible"
      [header]="'dialog.myProfileTitle' | translate"
      [modal]="true" [style]="{ width: '32rem' }"
      [draggable]="false" [resizable]="false"
    >
      <div class="edit-form">
        <div class="field">
          <label for="displayName">{{ 'common.displayName' | translate }}</label>
          <input id="displayName" pInputText [(ngModel)]="form.displayName"
            [placeholder]="'dialog.nameHelp' | translate" class="w-full" />
        </div>
        <div class="field">
          <label for="phone">{{ 'common.phone' | translate }}</label>
          <input id="phone" pInputText [(ngModel)]="form.phone"
            [placeholder]="'dialog.phonePlaceholder' | translate" class="w-full" />
        </div>
        <div class="field">
          <label for="email">{{ 'common.email' | translate }}</label>
          <input id="email" pInputText type="email" [(ngModel)]="form.email"
            [placeholder]="'dialog.emailPlaceholder' | translate" class="w-full" />
        </div>
        <div class="field opt-out-field">
          <div class="opt-out-row">
            <div>
              <span class="opt-out-label">{{ 'dialog.hideFromDirectory' | translate }}</span>
              <p class="opt-out-hint">
                {{ 'dialog.hideFromDirectoryHelp' | translate }}
              </p>
            </div>
            <p-toggleswitch [(ngModel)]="form.isOptedOut" />
          </div>
        </div>
      </div>
      <ng-template #footer>
        <p-button [label]="'dialog.deleteMine' | translate" icon="pi pi-trash" severity="danger"
          [outlined]="true" (onClick)="openEraseMyContact()" [style]="{'margin-right': 'auto'}" />
        <p-button [label]="'common.cancel' | translate" icon="pi pi-times" severity="secondary"
          [outlined]="true" (onClick)="editVisible = false" />
        <p-button [label]="'common.save' | translate" icon="pi pi-check"
          [loading]="saving()" (onClick)="save()" />
      </ng-template>
    </p-dialog>

    <!-- ── Admin edit dialog ── -->
    <p-dialog
      [(visible)]="adminEditVisible"
      [header]="t.instant('dialog.editResidentTitle', { ref: selectedAdminRef })"
      [modal]="true" [style]="{ width: '36rem' }"
      [draggable]="false" [resizable]="false"
    >
      <div class="edit-form">
        <div class="field">
          <label>{{ 'common.displayName' | translate }}</label>
          <input pInputText [(ngModel)]="adminForm.displayName" class="w-full" />
        </div>
        <div class="field">
          <label>{{ 'common.phone' | translate }}</label>
          <input pInputText [(ngModel)]="adminForm.phone" class="w-full" />
        </div>
        <div class="field">
          <label>{{ 'common.email' | translate }}</label>
          <input pInputText type="email" [(ngModel)]="adminForm.email" class="w-full" />
        </div>
        <div class="field">
          <label>{{ 'common.notes' | translate }}</label>
          <textarea
            [(ngModel)]="adminForm.notes"
            rows="4"
            [placeholder]="'dialog.adminNotesPlaceholder' | translate"
            class="admin-notes"
          ></textarea>
        </div>
        <div class="field opt-out-field">
          <div class="opt-out-row">
            <span class="opt-out-label">{{ 'dialog.optedOutOfDirectory' | translate }}</span>
            <p-toggleswitch [(ngModel)]="adminForm.isOptedOut" />
          </div>
        </div>
      </div>
      <ng-template #footer>
        <p-button [label]="'common.cancel' | translate" icon="pi pi-times" severity="secondary"
          [outlined]="true" (onClick)="adminEditVisible = false" />
        <p-button [label]="'common.save' | translate" icon="pi pi-check"
          [loading]="adminSaving()" (onClick)="saveAdminEdit()" />
      </ng-template>
    </p-dialog>

    <!-- ── Mark Departed confirm dialog ── -->
    <p-dialog
      [(visible)]="departVisible"
      [header]="'dialog.markDepartedTitle' | translate"
      [modal]="true" [style]="{ width: '28rem' }"
      [draggable]="false" [resizable]="false"
      [closable]="!departing()"
    >
      <p class="depart-message" [innerHTML]="t.instant('dialog.markDepartedBody', { ref: departRef })">
      </p>
      <ng-template #footer>
        <p-button
          [label]="'common.cancel' | translate" icon="pi pi-times"
          severity="secondary" [outlined]="true"
          [disabled]="departing()"
          (onClick)="departVisible = false"
        />
        <p-button
          [label]="'dialog.markDeparted' | translate" icon="pi pi-user-minus"
          severity="danger"
          [loading]="departing()"
          (onClick)="confirmDepart()"
        />
      </ng-template>
    </p-dialog>

    <!-- ── Erase my contact dialog ── -->
    <p-dialog
      [(visible)]="eraseMyVisible"
      [header]="'dialog.eraseMineTitle' | translate"
      [modal]="true" [style]="{ width: '28rem' }"
      [draggable]="false" [resizable]="false"
      [closable]="!erasing()"
    >
      <p class="depart-message">
        {{ 'dialog.permanentlyDeleted' | translate }}. {{ 'dialog.cannotBeUndone' | translate }}
      </p>
      <ng-template #footer>
        <p-button
          [label]="'common.cancel' | translate" icon="pi pi-times"
          severity="secondary" [outlined]="true"
          [disabled]="erasing()"
          (onClick)="eraseMyVisible = false"
        />
        <p-button
          [label]="'dialog.deleteMine' | translate" icon="pi pi-trash"
          severity="danger"
          [loading]="erasing()"
          (onClick)="confirmEraseMyContact()"
        />
      </ng-template>
    </p-dialog>

    <!-- ── Erase contact dialog (admin) ── -->
    <p-dialog
      [(visible)]="eraseContactVisible"
      [header]="'dialog.eraseContactTitle' | translate"
      [modal]="true" [style]="{ width: '28rem' }"
      [draggable]="false" [resizable]="false"
      [closable]="!erasingContact()"
    >
      <p class="depart-message">
        {{ t.instant('dialog.markDepartedBody', { ref: eraseContactRef }) }}
        {{ 'dialog.permanentlyDeleted' | translate }}. {{ 'dialog.cannotBeUndone' | translate }}
      </p>
      <ng-template #footer>
        <p-button
          [label]="'common.cancel' | translate" icon="pi pi-times"
          severity="secondary" [outlined]="true"
          [disabled]="erasingContact()"
          (onClick)="eraseContactVisible = false"
        />
        <p-button
          [label]="'dialog.eraseContact' | translate" icon="pi pi-trash"
          severity="danger"
          [loading]="erasingContact()"
          (onClick)="confirmEraseContact()"
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

    .role-toggle { display: flex; gap: 0; border: 1px solid rgba(255,255,255,0.35); border-radius: 6px; overflow: hidden; }
    .role-btn { background: transparent; color: rgba(255,255,255,0.8); border: none; padding: 0.375rem 1rem; font-size: 0.8125rem; cursor: pointer; }
    .role-btn:hover { background: rgba(255,255,255,0.1); }
    .role-active { background: rgba(255,255,255,0.22) !important; color: white !important; font-weight: 600; }

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
  readonly t = inject(TranslateService);
  readonly isAdmin = inject(RoleService).isAdmin;

  // ── shared ──
  loading = signal(false);
  error   = signal<string | null>(null);

  // ── role ──
  selectedRole: 'resident' | 'admin' = 'resident';

  get roleOptions() {
    return [
      { label: this.t.instant('app.roleResident'), value: 'resident' },
      { label: this.t.instant('app.roleAdmin'),    value: 'admin'    },
    ];
  }

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

  // ── erase my contact ──
  eraseMyVisible = false;
  erasing        = signal(false);

  // ── erase contact (admin) ──
  eraseContactVisible = false;
  eraseContactRef     = '';
  erasingContact      = signal(false);

  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    this.error.set(null);
    if (this.selectedRole === 'resident') {
      this.svc.getDirectory().subscribe({
        next: e  => { this.entries.set(e);      this.loading.set(false); },
        error: () => { this.error.set(this.t.instant('directory.errApi')); this.loading.set(false); },
      });
    } else {
      this.svc.getAdminDirectory().subscribe({
        next: e  => { this.adminEntries.set(e); this.loading.set(false); },
        error: () => { this.error.set(this.t.instant('directory.errApi')); this.loading.set(false); },
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
        this.msg.add({ severity: 'success', summary: 'Saved', detail: this.t.instant('directory.toastProfileUpdated') });
        this.load();
      },
      error: () => {
        this.saving.set(false);
        this.msg.add({ severity: 'error', summary: 'Error', detail: this.t.instant('directory.errSave') });
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
        this.msg.add({ severity: 'success', summary: 'Saved', detail: this.t.instant('directory.toastResidentUpdated') });
        this.load();
      },
      error: () => {
        this.adminSaving.set(false);
        this.msg.add({ severity: 'error', summary: 'Error', detail: this.t.instant('directory.errSave') });
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
          detail: this.t.instant('directory.toastDeparted', { ref: this.departRef }),
        });
      },
      error: () => {
        this.departing.set(false);
        this.msg.add({ severity: 'error', summary: 'Error', detail: this.t.instant('directory.errDepart') });
      },
    });
  }

  // ── erase my contact handlers ──
  openEraseMyContact() {
    this.editVisible    = false;
    this.eraseMyVisible = true;
  }

  confirmEraseMyContact() {
    this.erasing.set(true);
    this.svc.eraseMyContact().subscribe({
      next: () => {
        this.erasing.set(false);
        this.eraseMyVisible = false;
        this.entries.set([]);
        this.msg.add({ severity: 'success', summary: 'Deleted', detail: this.t.instant('directory.toastMyDataDeleted') });
      },
      error: () => {
        this.erasing.set(false);
        this.msg.add({ severity: 'error', summary: 'Error', detail: this.t.instant('directory.errDeleteMine') });
      },
    });
  }

  // ── erase contact handlers (admin) ──
  openEraseContact(householdRef: string) {
    this.eraseContactRef     = householdRef;
    this.eraseContactVisible = true;
  }

  confirmEraseContact() {
    this.erasingContact.set(true);
    this.svc.eraseContact(this.eraseContactRef).subscribe({
      next: () => {
        this.erasingContact.set(false);
        this.eraseContactVisible = false;
        this.adminEntries.update(list => list.filter(e => e.householdRef !== this.eraseContactRef));
        this.msg.add({ severity: 'success', summary: 'Erased', detail: this.t.instant('directory.toastContactErased', { ref: this.eraseContactRef }) });
      },
      error: () => {
        this.erasingContact.set(false);
        this.msg.add({ severity: 'error', summary: 'Error', detail: this.t.instant('directory.errErase') });
      },
    });
  }
}
