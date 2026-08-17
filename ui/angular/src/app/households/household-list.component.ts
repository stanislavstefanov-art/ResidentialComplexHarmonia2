import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { ToastModule } from 'primeng/toast';
import { CardModule } from 'primeng/card';
import { MessageService } from 'primeng/api';
import { NavComponent } from '../nav/nav.component';
import { HouseholdService } from './household.service';
import { Household } from './household.models';
import { HouseholdRefPickerComponent } from './household-ref-picker.component';
import { DirectoryService } from '../directory/directory.service';
import { DirectoryEntryAdmin } from '../directory/models';

interface HouseholdRow extends Household {
  residentName: string | null;
}

// Build householdRef -> displayName, preferring Owner-role entries and falling back
// to any directory entry that has a displayName, mirroring the React screen.
function buildNameByRef(entries: DirectoryEntryAdmin[]): Map<string, string> {
  const nameByRef = new Map<string, string>();
  for (const entry of entries) {
    if (entry.role === 'Owner' && entry.displayName) {
      nameByRef.set(entry.householdRef, entry.displayName);
    }
  }
  for (const entry of entries) {
    if (!nameByRef.has(entry.householdRef) && entry.displayName) {
      nameByRef.set(entry.householdRef, entry.displayName);
    }
  }
  return nameByRef;
}

@Component({
  selector: 'app-household-list',
  standalone: true,
  imports: [
    CommonModule, FormsModule, TableModule, ButtonModule, DialogModule,
    InputTextModule, ToastModule, CardModule, TranslatePipe, NavComponent,
    HouseholdRefPickerComponent,
  ],
  providers: [MessageService],
  template: `
    <p-toast />
    <div class="harmonia-shell">
      <app-nav [showRoleToggle]="false" />
      <main class="harmonia-content wide">
        <p-card>
          <ng-template #title>
            <div class="card-title-row">
              <span>{{ 'households.title' | translate }}</span>
              <p-button [label]="'households.addHousehold' | translate" icon="pi pi-plus" [rounded]="true" (onClick)="openAdd()" />
            </div>
          </ng-template>

          @if (loading()) {
            <div class="loading-row"><i class="pi pi-spin pi-spinner"></i><span>{{ 'households.loading' | translate }}</span></div>
          } @else if (error()) {
            <div class="error-row">
              <i class="pi pi-exclamation-circle"></i><span>{{ error() }}</span>
              <p-button [label]="'common.retry' | translate" icon="pi pi-refresh" severity="secondary" (onClick)="load()" />
            </div>
          } @else {
            <p-table [value]="rows()" [paginator]="true" [rows]="25" [rowsPerPageOptions]="[25,50,100]"
                     styleClass="p-datatable-striped p-datatable-sm">
              <ng-template #header>
                <tr>
                  <th>{{ 'households.residentName' | translate }}</th>
                  <th>{{ 'households.apartment' | translate }}</th>
                  <th style="text-align:right">{{ 'households.sqMeters' | translate }}</th>
                  <th style="width:8rem"></th>
                </tr>
              </ng-template>
              <ng-template #body let-h>
                <tr>
                  <td>{{ h.residentName ?? ('households.none' | translate) }}</td>
                  <td class="ref-cell">{{ h.householdRef }}</td>
                  <td style="text-align:right">{{ h.sqMeters | number:'1.2-2' }}</td>
                  <td>
                    <div class="action-cell">
                      <p-button icon="pi pi-pencil" [rounded]="true" [text]="true" severity="secondary" size="small" (onClick)="openEdit(h)" />
                      <p-button icon="pi pi-trash" [rounded]="true" [text]="true" severity="danger" size="small" (onClick)="openDelete(h)" />
                    </div>
                  </td>
                </tr>
              </ng-template>
              <ng-template #emptymessage>
                <tr><td colspan="4" class="empty-message">{{ 'households.none' | translate }}</td></tr>
              </ng-template>
            </p-table>
          }
        </p-card>
      </main>
    </div>

    <p-dialog [(visible)]="addDialogVisible" [header]="'households.addTitle' | translate"
              [modal]="true" [style]="{ width: '34rem' }" [draggable]="false" [resizable]="false">
      <div class="edit-form">
        <div class="field">
          <label>{{ 'households.pickerLabel' | translate }}</label>
          <app-household-ref-picker (refChange)="onRefChange($event)" />
        </div>
        <div class="field">
          <label>{{ 'households.sqMetersLabel' | translate }}</label>
          <input pInputText type="number" step="0.01" min="0" [(ngModel)]="addSqMeters" class="w-full" />
        </div>
      </div>
      <ng-template #footer>
        <p-button [label]="'common.cancel' | translate" icon="pi pi-times" severity="secondary" [outlined]="true" (onClick)="addDialogVisible = false" />
        <p-button [label]="'common.save' | translate" icon="pi pi-check" [loading]="saving()" [disabled]="!addFormValid()" (onClick)="saveAdd()" />
      </ng-template>
    </p-dialog>

    <p-dialog [(visible)]="editDialogVisible" [header]="t.instant('households.editTitle', { ref: editTarget?.householdRef })"
              [modal]="true" [style]="{ width: '28rem' }" [draggable]="false" [resizable]="false">
      <div class="edit-form">
        <div class="field">
          <label>{{ 'households.sqMetersLabel' | translate }}</label>
          <input pInputText type="number" step="0.01" min="0" [(ngModel)]="editSqMeters" class="w-full" />
        </div>
      </div>
      <ng-template #footer>
        <p-button [label]="'common.cancel' | translate" icon="pi pi-times" severity="secondary" [outlined]="true" (onClick)="editDialogVisible = false" />
        <p-button [label]="'common.save' | translate" icon="pi pi-check" [loading]="saving()" [disabled]="!editFormValid()" (onClick)="saveEdit()" />
      </ng-template>
    </p-dialog>

    <p-dialog [(visible)]="deleteVisible" [header]="'households.deleteTitle' | translate"
              [modal]="true" [style]="{ width: '28rem' }" [draggable]="false" [resizable]="false" [closable]="!deleting()">
      <p class="depart-message" [innerHTML]="t.instant('households.deleteConfirm', { ref: deleteTarget?.householdRef })"></p>
      @if (deleteError()) { <p class="error-row">{{ deleteError() }}</p> }
      <ng-template #footer>
        <p-button [label]="'common.cancel' | translate" icon="pi pi-times" severity="secondary" [outlined]="true" [disabled]="deleting()" (onClick)="deleteVisible = false" />
        <p-button [label]="'common.delete' | translate" icon="pi pi-trash" severity="danger" [loading]="deleting()" (onClick)="confirmDelete()" />
      </ng-template>
    </p-dialog>
  `,
  styles: [`
    .harmonia-shell { min-height: 100vh; background: var(--p-surface-ground); }
    .harmonia-content { max-width: 1200px; margin: 2rem auto; padding: 0 1rem; }
    .card-title-row { display: flex; align-items: center; justify-content: space-between; }
    .action-cell { display: flex; gap: 0.125rem; }
    .loading-row, .error-row { display: flex; align-items: center; gap: 0.75rem; padding: 1rem; color: var(--p-text-muted-color); }
    .error-row { color: var(--p-red-500, #ef4444); }
    .empty-message { text-align: center; padding: 2rem; color: var(--p-text-muted-color); }
    .edit-form { display: flex; flex-direction: column; gap: 1rem; padding-top: 0.5rem; }
    .field { display: flex; flex-direction: column; gap: 0.375rem; }
    .field label { font-size: 0.875rem; font-weight: 500; }
    .w-full { width: 100%; }
    .depart-message { margin: 0; line-height: 1.6; }
    .ref-cell { font-family: monospace; }
  `],
})
export class HouseholdListComponent implements OnInit {
  private readonly svc = inject(HouseholdService);
  private readonly directorySvc = inject(DirectoryService);
  private readonly msg = inject(MessageService);
  readonly t = inject(TranslateService);

  rows = signal<HouseholdRow[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);

  addDialogVisible = false;
  newRef = '';
  addSqMeters: number | null = null;
  saving = signal(false);

  editDialogVisible = false;
  editTarget: Household | null = null;
  editSqMeters: number | null = null;

  deleteVisible = false;
  deleteTarget: Household | null = null;
  deleting = signal(false);
  deleteError = signal<string | null>(null);

  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    this.error.set(null);
    forkJoin({
      households: this.svc.list(),
      directory: this.directorySvc.getAdminDirectory(),
    }).subscribe({
      next: ({ households, directory }) => {
        const nameByRef = buildNameByRef(directory);
        this.rows.set(households.map(h => ({ ...h, residentName: nameByRef.get(h.householdRef) ?? null })));
        this.loading.set(false);
      },
      error: () => {
        this.error.set(this.t.instant('households.errLoad'));
        this.loading.set(false);
      },
    });
  }

  openAdd() {
    this.newRef = '';
    this.addSqMeters = null;
    this.addDialogVisible = true;
  }

  onRefChange(ref: string) {
    this.newRef = ref;
  }

  addFormValid() {
    return this.newRef.trim() !== '' && this.addSqMeters != null && !isNaN(this.addSqMeters) && this.addSqMeters > 0;
  }

  saveAdd() {
    if (!this.addFormValid()) return;
    this.saving.set(true);
    this.svc.upsert(this.newRef, this.addSqMeters!).subscribe({
      next: () => {
        this.saving.set(false);
        this.addDialogVisible = false;
        this.msg.add({ severity: 'success', summary: 'Saved', detail: this.t.instant('households.saved') });
        this.load();
      },
      error: () => {
        this.saving.set(false);
        this.msg.add({ severity: 'error', summary: 'Error', detail: this.t.instant('households.errSave') });
      },
    });
  }

  openEdit(h: Household) {
    this.editTarget = h;
    this.editSqMeters = h.sqMeters;
    this.editDialogVisible = true;
  }

  editFormValid() {
    return this.editSqMeters != null && !isNaN(this.editSqMeters) && this.editSqMeters > 0;
  }

  saveEdit() {
    if (!this.editTarget || !this.editFormValid()) return;
    this.saving.set(true);
    this.svc.upsert(this.editTarget.householdRef, this.editSqMeters!).subscribe({
      next: () => {
        this.saving.set(false);
        this.editDialogVisible = false;
        this.msg.add({ severity: 'success', summary: 'Saved', detail: this.t.instant('households.saved') });
        this.load();
      },
      error: () => {
        this.saving.set(false);
        this.msg.add({ severity: 'error', summary: 'Error', detail: this.t.instant('households.errSave') });
      },
    });
  }

  openDelete(h: Household) {
    this.deleteTarget = h;
    this.deleteError.set(null);
    this.deleteVisible = true;
  }

  confirmDelete() {
    if (!this.deleteTarget) return;
    this.deleting.set(true);
    this.deleteError.set(null);
    this.svc.remove(this.deleteTarget.householdRef).subscribe({
      next: () => {
        this.deleting.set(false);
        this.deleteVisible = false;
        this.msg.add({ severity: 'success', summary: 'Deleted', detail: this.t.instant('households.deleted') });
        this.load();
      },
      error: () => {
        this.deleting.set(false);
        this.deleteError.set(this.t.instant('households.errDelete'));
      },
    });
  }
}
