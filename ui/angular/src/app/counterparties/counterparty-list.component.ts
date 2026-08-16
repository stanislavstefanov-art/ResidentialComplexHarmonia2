import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { ToastModule } from 'primeng/toast';
import { CardModule } from 'primeng/card';
import { MessageService } from 'primeng/api';
import { NavComponent } from '../nav/nav.component';
import { CounterpartyService } from './counterparty.service';
import { Counterparty, CounterpartyInput } from './counterparty.models';

const EMPTY: CounterpartyInput = { name: '', category: '', parentCategory: '', vatNumber: '', phone: '', email: '' };

@Component({
  selector: 'app-counterparty-list',
  standalone: true,
  imports: [
    CommonModule, FormsModule, TableModule, ButtonModule, DialogModule,
    InputTextModule, ToastModule, CardModule, TranslatePipe, NavComponent,
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
              <span>{{ 'counterparties.title' | translate }}</span>
              <p-button [label]="'counterparties.add' | translate" icon="pi pi-plus" [rounded]="true" (onClick)="openAdd()" />
            </div>
          </ng-template>

          @if (loading()) {
            <div class="loading-row"><i class="pi pi-spin pi-spinner"></i><span>{{ 'common.loading' | translate }}</span></div>
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
                  <th>{{ 'counterparties.name' | translate }}</th>
                  <th>{{ 'counterparties.category' | translate }}</th>
                  <th>{{ 'counterparties.parentCategory' | translate }}</th>
                  <th>{{ 'counterparties.vatNumber' | translate }}</th>
                  <th>{{ 'counterparties.phone' | translate }}</th>
                  <th>{{ 'counterparties.email' | translate }}</th>
                  <th style="width:8rem"></th>
                </tr>
              </ng-template>
              <ng-template #body let-c>
                <tr>
                  <td>{{ c.name }}</td>
                  <td>{{ c.category }}</td>
                  <td>{{ c.parentCategory }}</td>
                  <td>{{ c.vatNumber ?? '—' }}</td>
                  <td>{{ c.phone ?? '—' }}</td>
                  <td>{{ c.email ?? '—' }}</td>
                  <td>
                    <div class="action-cell">
                      <p-button icon="pi pi-pencil" [rounded]="true" [text]="true" severity="secondary" size="small" (onClick)="openEdit(c)" />
                      <p-button icon="pi pi-trash" [rounded]="true" [text]="true" severity="danger" size="small" (onClick)="openDelete(c)" />
                    </div>
                  </td>
                </tr>
              </ng-template>
              <ng-template #emptymessage>
                <tr><td colspan="7" class="empty-message">{{ 'counterparties.empty' | translate }}</td></tr>
              </ng-template>
            </p-table>
          }
        </p-card>
      </main>
    </div>

    <p-dialog [(visible)]="dialogVisible" [header]="(editing ? 'counterparties.editTitle' : 'counterparties.addTitle') | translate"
              [modal]="true" [style]="{ width: '34rem' }" [draggable]="false" [resizable]="false">
      <div class="edit-form">
        <div class="field"><label>{{ 'counterparties.name' | translate }} *</label><input pInputText [(ngModel)]="form.name" class="w-full" /></div>
        <div class="field"><label>{{ 'counterparties.category' | translate }} *</label><input pInputText [(ngModel)]="form.category" class="w-full" /></div>
        <div class="field"><label>{{ 'counterparties.parentCategory' | translate }} *</label><input pInputText [(ngModel)]="form.parentCategory" class="w-full" /></div>
        <div class="field"><label>{{ 'counterparties.vatNumber' | translate }}</label><input pInputText [(ngModel)]="form.vatNumber" class="w-full" /></div>
        <div class="field"><label>{{ 'counterparties.phone' | translate }}</label><input pInputText [(ngModel)]="form.phone" class="w-full" /></div>
        <div class="field"><label>{{ 'counterparties.email' | translate }}</label><input pInputText type="email" [(ngModel)]="form.email" class="w-full" /></div>
      </div>
      <ng-template #footer>
        <p-button [label]="'common.cancel' | translate" icon="pi pi-times" severity="secondary" [outlined]="true" (onClick)="dialogVisible = false" />
        <p-button [label]="'common.save' | translate" icon="pi pi-check" [loading]="saving()" [disabled]="!formValid()" (onClick)="save()" />
      </ng-template>
    </p-dialog>

    <p-dialog [(visible)]="deleteVisible" [header]="'counterparties.deleteTitle' | translate"
              [modal]="true" [style]="{ width: '28rem' }" [draggable]="false" [resizable]="false" [closable]="!deleting()">
      <p class="depart-message">{{ t.instant('counterparties.deleteConfirm', { name: deleteTarget?.name }) }}</p>
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
  `],
})
export class CounterpartyListComponent implements OnInit {
  private readonly svc = inject(CounterpartyService);
  private readonly msg = inject(MessageService);
  readonly t = inject(TranslateService);

  rows = signal<Counterparty[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);

  dialogVisible = false;
  editing: Counterparty | null = null;
  form: CounterpartyInput = { ...EMPTY };
  saving = signal(false);

  deleteVisible = false;
  deleteTarget: Counterparty | null = null;
  deleting = signal(false);
  deleteError = signal<string | null>(null);

  formValid() {
    return this.form.name.trim() !== '' && this.form.category.trim() !== '' && this.form.parentCategory.trim() !== '';
  }

  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    this.error.set(null);
    this.svc.list().subscribe({
      next: r => { this.rows.set(r); this.loading.set(false); },
      error: () => { this.error.set(this.t.instant('counterparties.loadError')); this.loading.set(false); },
    });
  }

  openAdd() { this.editing = null; this.form = { ...EMPTY }; this.dialogVisible = true; }
  openEdit(c: Counterparty) {
    this.editing = c;
    this.form = { name: c.name, category: c.category, parentCategory: c.parentCategory,
      vatNumber: c.vatNumber ?? '', phone: c.phone ?? '', email: c.email ?? '' };
    this.dialogVisible = true;
  }

  private normalise(): CounterpartyInput {
    return {
      name: this.form.name.trim(),
      category: this.form.category.trim(),
      parentCategory: this.form.parentCategory.trim(),
      vatNumber: this.form.vatNumber?.trim() || null,
      phone: this.form.phone?.trim() || null,
      email: this.form.email?.trim() || null,
    };
  }

  save() {
    if (!this.formValid()) return;
    this.saving.set(true);
    const payload = this.normalise();
    const done = {
      next: () => {
        this.saving.set(false);
        this.dialogVisible = false;
        this.msg.add({ severity: 'success', summary: 'Saved', detail: this.t.instant(this.editing ? 'counterparties.updated' : 'counterparties.created') });
        this.load();
      },
      error: () => {
        this.saving.set(false);
        this.msg.add({ severity: 'error', summary: 'Error', detail: this.t.instant('counterparties.saveError') });
      },
    };
    if (this.editing) this.svc.update(this.editing.id, payload).subscribe(done);
    else this.svc.create(payload).subscribe(done);
  }

  openDelete(c: Counterparty) { this.deleteTarget = c; this.deleteError.set(null); this.deleteVisible = true; }

  confirmDelete() {
    if (!this.deleteTarget) return;
    this.deleting.set(true);
    this.deleteError.set(null);
    this.svc.remove(this.deleteTarget.id).subscribe({
      next: () => {
        this.deleting.set(false);
        this.deleteVisible = false;
        this.msg.add({ severity: 'success', summary: 'Deleted', detail: this.t.instant('counterparties.deleted') });
        this.load();
      },
      error: (err: { status?: number }) => {
        this.deleting.set(false);
        this.deleteError.set(this.t.instant(err?.status === 409 ? 'counterparties.deleteHasBills' : 'counterparties.deleteError'));
      },
    });
  }
}
