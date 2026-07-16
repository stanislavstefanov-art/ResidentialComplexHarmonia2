import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { TableModule, SortIcon } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { ToastModule } from 'primeng/toast';
import { ToolbarModule } from 'primeng/toolbar';
import { TagModule } from 'primeng/tag';
import { CardModule } from 'primeng/card';
import { MessageService } from 'primeng/api';

import { DirectoryService } from './directory.service';
import { DirectoryEntry, MyContact } from './models';

@Component({
  selector: 'app-directory-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    SortIcon,
    ButtonModule,
    DialogModule,
    InputTextModule,
    ToggleSwitchModule,
    ToastModule,
    ToolbarModule,
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
      </header>

      <main class="harmonia-content">
        <p-card>
          <ng-template #title>
            <div class="card-title-row">
              <span>Member Directory</span>
              <p-button
                label="My Profile"
                icon="pi pi-user-edit"
                (onClick)="openEditDialog()"
                [rounded]="true"
                severity="secondary"
              />
            </div>
          </ng-template>

          <ng-template #subtitle>
            Showing residents who have shared their details.
          </ng-template>

          @if (loading()) {
            <div class="loading-row">
              <i class="pi pi-spin pi-spinner" style="font-size: 1.5rem"></i>
              <span>Loading directory…</span>
            </div>
          } @else if (error()) {
            <div class="error-row">
              <i class="pi pi-exclamation-circle"></i>
              <span>{{ error() }}</span>
              <p-button label="Retry" icon="pi pi-refresh" severity="secondary" (onClick)="load()" />
            </div>
          } @else {
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
                      pInputText
                      type="text"
                      placeholder="Search…"
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
                  <td>
                    <p-tag [value]="entry.householdRef" severity="secondary" />
                  </td>
                  <td>{{ entry.displayName ?? '—' }}</td>
                </tr>
              </ng-template>

              <ng-template #emptymessage>
                <tr>
                  <td colspan="2" class="empty-message">
                    No residents found.
                  </td>
                </tr>
              </ng-template>
            </p-table>
          }
        </p-card>
      </main>
    </div>

    <!-- Edit My Profile dialog -->
    <p-dialog
      [(visible)]="editVisible"
      header="My Profile"
      [modal]="true"
      [style]="{ width: '32rem' }"
      [draggable]="false"
      [resizable]="false"
    >
      <div class="edit-form">
        <div class="field">
          <label for="displayName">Display Name</label>
          <input
            id="displayName"
            pInputText
            [(ngModel)]="form.displayName"
            placeholder="Your name as shown to neighbours"
            class="w-full"
          />
        </div>

        <div class="field">
          <label for="phone">Phone</label>
          <input
            id="phone"
            pInputText
            [(ngModel)]="form.phone"
            placeholder="+359 88 …"
            class="w-full"
          />
        </div>

        <div class="field">
          <label for="email">Email</label>
          <input
            id="email"
            pInputText
            type="email"
            [(ngModel)]="form.email"
            placeholder="you@example.com"
            class="w-full"
          />
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
        <p-button
          label="Cancel"
          icon="pi pi-times"
          severity="secondary"
          [outlined]="true"
          (onClick)="editVisible = false"
        />
        <p-button
          label="Save"
          icon="pi pi-check"
          [loading]="saving()"
          (onClick)="save()"
        />
      </ng-template>
    </p-dialog>
  `,
  styles: [`
    .harmonia-shell {
      min-height: 100vh;
      background: var(--p-surface-ground);
    }

    .harmonia-header {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 1rem 2rem;
      background: var(--p-primary-color);
      color: var(--p-primary-contrast-color);
      box-shadow: 0 2px 8px rgba(0,0,0,.15);
    }

    .harmonia-logo {
      font-size: 1.25rem;
      font-weight: 700;
      letter-spacing: -.5px;
    }

    .harmonia-subtitle {
      font-size: 0.875rem;
      opacity: .8;
    }

    .harmonia-content {
      max-width: 900px;
      margin: 2rem auto;
      padding: 0 1rem;
    }

    .card-title-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .table-caption {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
    }

    .loading-row, .error-row {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 2rem;
      color: var(--p-text-muted-color);
    }

    .error-row { color: var(--p-red-500); }

    .empty-message {
      text-align: center;
      padding: 2rem;
      color: var(--p-text-muted-color);
    }

    .edit-form {
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
      padding-top: 0.5rem;
    }

    .field {
      display: flex;
      flex-direction: column;
      gap: 0.375rem;
    }

    .field label {
      font-size: 0.875rem;
      font-weight: 500;
      color: var(--p-text-color);
    }

    .field input { width: 100%; }

    .opt-out-field { border-top: 1px solid var(--p-surface-border); padding-top: 1.25rem; }

    .opt-out-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
    }

    .opt-out-label { font-weight: 500; }

    .opt-out-hint {
      font-size: 0.8rem;
      color: var(--p-text-muted-color);
      margin: 0.25rem 0 0;
    }
  `]
})
export class DirectoryListComponent implements OnInit {
  private readonly svc = inject(DirectoryService);
  private readonly msg = inject(MessageService);

  entries  = signal<DirectoryEntry[]>([]);
  loading  = signal(false);
  error    = signal<string | null>(null);
  saving   = signal(false);
  editVisible = false;

  form: MyContact = { displayName: '', phone: '', email: '', isOptedOut: false };

  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    this.error.set(null);
    this.svc.getDirectory().subscribe({
      next: entries => { this.entries.set(entries); this.loading.set(false); },
      error: ()      => {
        this.error.set('Could not reach the Harmonia API. Is it running on port 5000?');
        this.loading.set(false);
      }
    });
  }

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
      }
    });
  }
}
