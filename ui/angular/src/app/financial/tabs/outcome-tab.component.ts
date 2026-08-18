import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ExpenseService } from '../../expenses/expense.service';
import { ExpenseListItemDto, ScannedInvoiceDto } from '../../expenses/models';
import { CounterpartyPickerComponent } from '../counterparty-picker.component';
import { Counterparty } from '../../counterparties/counterparty.models';

function today(): string { return new Date().toISOString().slice(0, 10); }
function formatEur(n: number): string { return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n); }

@Component({
  selector: 'app-outcome-tab',
  standalone: true,
  imports: [CommonModule, FormsModule, CardModule, ButtonModule, ProgressSpinnerModule, TranslatePipe, CounterpartyPickerComponent],
  template: `
    <p-card>
      <ng-template #content>
        <div class="record-form">
          <h3 class="form-title">{{ 'finance.addBill' | translate }}</h3>

          <!-- Scan control -->
          <div class="upload-row">
            <label class="upload-btn">
              {{ 'finance.scanInvoice' | translate }}
              <input
                type="file"
                data-testid="bill-scan-input"
                accept="application/pdf,image/*"
                (change)="onInvoiceSelected($event)"
                style="display:none"
              />
            </label>
          </div>

          @if (scanning()) {
            <div class="center-state">
              <p-progressspinner strokeWidth="4" [style]="{width:'36px',height:'36px'}" />
            </div>
          }

          @if (confidence() !== null) {
            <span class="confidence-chip">
              {{ 'invoiceScan.confidence' | translate }}: {{ (confidence()! * 100).toFixed(0) }}%
            </span>
          }

          @if (scanNote()) {
            <p class="scan-note" data-testid="bill-scan-note">{{ scanNote() }}</p>
          }

          <p class="scan-caption">{{ 'finance.orEnterManually' | translate }}</p>

          @if (scanErr()) {
            <p class="error-msg">{{ scanErr() }}</p>
          }

          <!-- Shared bill form -->
          <form data-testid="bill-form" (ngSubmit)="onSubmit()">
            <div class="form-grid">
              <div class="form-row">
                <label>{{ 'expenses.amountEuro' | translate }}</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  data-testid="bill-amount"
                  name="billAmt"
                  [(ngModel)]="billForm.amountEurStr"
                  class="form-input"
                />
              </div>
              <div class="form-row">
                <label>{{ 'expenses.expenseDate' | translate }}</label>
                <input
                  type="date"
                  name="billDate"
                  [(ngModel)]="billForm.expenseDate"
                  class="form-input"
                />
              </div>
              <div class="form-row">
                <label>{{ 'common.description' | translate }}</label>
                <input
                  type="text"
                  data-testid="bill-desc"
                  name="billDesc"
                  [(ngModel)]="billForm.description"
                  class="form-input"
                />
              </div>
              <div class="form-row">
                <label>{{ 'finance.counterpartyLabel' | translate }}</label>
                <app-counterparty-picker data-testid="bill-counterparty" (counterpartyChange)="onCounterpartyChange($event)" />
              </div>
            </div>
            <div class="scan-actions">
              <button type="submit" data-testid="bill-submit" class="submit-btn" [disabled]="saving()">
                {{ 'expenses.record' | translate }}
              </button>
              <button type="button" class="reset-btn" (click)="resetForm()">
                {{ 'finance.clearForm' | translate }}
              </button>
            </div>
            @if (ok()) {
              <p data-testid="bill-success" class="success-msg">{{ 'expenses.recorded' | translate }}</p>
            }
            @if (formErr()) {
              <p class="error-msg">{{ formErr() }}</p>
            }
          </form>
        </div>

        <!-- Expenses list -->
        <div class="section-divider"><span class="section-label">{{ 'nav.expenses' | translate }}</span></div>

        @if (expLoading()) {
          <div class="center-state"><p-progressspinner strokeWidth="4" [style]="{width:'36px',height:'36px'}" /></div>
        } @else if (expError()) {
          <div class="error-state">
            <p>{{ expError() }}</p>
            <button (click)="loadExpenses()">{{ 'common.retry' | translate }}</button>
          </div>
        } @else {
          <div class="table-scroll">
            <table class="fin-table">
              <thead><tr>
                <th>{{ 'common.date' | translate }}</th>
                <th>{{ 'expenses.category' | translate }}</th>
                <th>{{ 'common.description' | translate }}</th>
                <th>{{ 'common.amount' | translate }}</th>
              </tr></thead>
              <tbody>
                @for (e of expenses(); track e.id) {
                  <tr [attr.data-testid]="'expense-row-' + e.id">
                    <td>{{ e.expenseDate }}</td>
                    <td>{{ e.counterpartyName }} ({{ e.counterpartyCategory }})</td>
                    <td>{{ e.description }}</td>
                    <td>{{ formatEur(e.amountEur) }}</td>
                  </tr>
                }
                @if (expenses().length === 0) {
                  <tr><td colspan="4" class="empty-cell">{{ 'expenses.none' | translate }}</td></tr>
                }
              </tbody>
            </table>
          </div>
        }
      </ng-template>
    </p-card>
  `,
  styles: [`
    .record-form { background: white; border: 1px solid #e0e0e0; border-radius: 8px; padding: 20px; margin-bottom: 16px; }
    .form-title { margin: 0 0 12px; font-size: .9375rem; font-weight: 600; }
    .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px; }
    @media (max-width: 480px) { .form-grid { grid-template-columns: 1fr; } }
    .form-row { display: flex; flex-direction: column; gap: 4px; }
    .form-row label { font-size: .8125rem; font-weight: 500; color: #555; }
    .form-input { padding: 7px 10px; border: 1px solid #ccc; border-radius: 4px; font-size: .875rem; }
    .submit-btn { background: #2e6b4f; color: white; border: none; padding: 7px 18px; border-radius: 6px; cursor: pointer; font-size: .875rem; }
    .submit-btn:hover { background: #245a40; }
    .submit-btn:disabled { opacity: .6; cursor: not-allowed; }
    .reset-btn { background: transparent; border: 1px solid #ccc; color: #555; padding: 7px 16px; border-radius: 6px; cursor: pointer; font-size: .875rem; }
    .reset-btn:hover { background: #f5f5f0; }
    .success-msg { color: #2e6b4f; font-weight: 500; margin: 8px 0 0; font-size: .875rem; }
    .error-msg { color: #c00; margin: 8px 0 0; font-size: .875rem; }
    .table-scroll { overflow-x: auto; }
    .fin-table { width: 100%; border-collapse: collapse; }
    .fin-table th, .fin-table td { padding: 8px 12px; text-align: left; border-bottom: 1px solid #eee; font-size: .875rem; white-space: nowrap; }
    .fin-table th { background: #f9f9f7; font-weight: 600; color: #555; }
    .empty-cell { text-align: center; color: #999; padding: 16px; white-space: normal; }
    .center-state { display: flex; justify-content: center; padding: 32px; }
    .error-state { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 32px; color: #c00; }
    .upload-row { margin-bottom: 8px; }
    .upload-btn { display: inline-block; background: #2e6b4f; color: white; padding: 7px 18px; border-radius: 6px; cursor: pointer; font-size: .875rem; }
    .upload-btn:hover { background: #245a40; }
    .confidence-chip { display: inline-block; background: #e8f0ec; color: #2e6b4f; border-radius: 12px; padding: 2px 10px; font-size: .8125rem; font-weight: 600; margin-bottom: 8px; }
    .scan-note { background: #fdf6e3; color: #8a6d3b; border-radius: 6px; padding: 6px 10px; font-size: .8125rem; margin: 0 0 8px; }
    .scan-caption { font-size: .8125rem; color: #888; margin: 6px 0 8px; }
    .scan-actions { display: flex; gap: 12px; align-items: center; margin-top: 4px; }
    .confidence-val { background: none; border: none; padding-left: 0; font-size: .875rem; color: #555; }
    .section-divider { display: flex; align-items: center; margin: 24px 0 16px; gap: 12px; }
    .section-divider::before, .section-divider::after { content: ''; flex: 1; height: 1px; background: #e0e0e0; }
    .section-label { font-size: .75rem; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; color: #888; white-space: nowrap; }
  `],
})
export class OutcomeTabComponent implements OnInit {
  private readonly expSvc = inject(ExpenseService);
  private readonly t = inject(TranslateService);

  readonly formatEur = formatEur;

  billForm = { amountEurStr: '', expenseDate: today(), description: '' };
  selectedCounterparty: Counterparty | null = null;
  readonly confidence = signal<number | null>(null);
  readonly scanning = signal(false);
  readonly scanErr = signal<string | null>(null);
  readonly scanNote = signal<string | null>(null);
  readonly saving = signal(false);
  readonly ok = signal(false);
  readonly formErr = signal<string | null>(null);

  readonly expenses = signal<ExpenseListItemDto[]>([]);
  readonly expLoading = signal(true);
  readonly expError = signal<string | null>(null);

  ngOnInit(): void { this.loadExpenses(); }

  loadExpenses(): void {
    this.expLoading.set(true); this.expError.set(null);
    this.expSvc.getExpenses().subscribe({
      next: list => { this.expenses.set(list); this.expLoading.set(false); },
      error: () => { this.expError.set(this.t.instant('expenses.errLoad')); this.expLoading.set(false); },
    });
  }

  resetForm(): void {
    this.billForm = { amountEurStr: '', expenseDate: today(), description: '' };
    this.selectedCounterparty = null;
    this.confidence.set(null); this.ok.set(false); this.scanErr.set(null); this.scanNote.set(null);
  }

  onCounterpartyChange(counterparty: Counterparty | null): void {
    this.selectedCounterparty = counterparty;
  }

  onInvoiceSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) { this.scanErr.set(this.t.instant('invoiceScan.errEmpty')); return; }
    this.scanErr.set(null); this.scanNote.set(null); this.ok.set(false); this.scanning.set(true);
    this.expSvc.scanInvoice(file).subscribe({
      next: (dto: ScannedInvoiceDto) => {
        // Only overwrite what the scan actually found. A field the model missed must not
        // wipe out something the admin already typed, and a missed date must not silently
        // reset the form to today.
        if (dto.amount != null) this.billForm.amountEurStr = String(dto.amount);
        if (dto.date) this.billForm.expenseDate = dto.date;
        if (dto.vendor) this.billForm.description = dto.vendor;
        // Scanning never auto-selects a counterparty — manual selection is always required.
        this.confidence.set(dto.confidence);
        // A null confidence means the document was analysed but no invoice fields matched —
        // say so, instead of leaving a blank form next to a reassuring badge.
        this.scanNote.set(dto.confidence == null ? this.t.instant('invoiceScan.noFields') : null);
        this.scanning.set(false);
      },
      error: () => { this.scanErr.set(this.t.instant('invoiceScan.errScan')); this.scanning.set(false); },
    });
  }

  onSubmit(): void {
    this.ok.set(false); this.formErr.set(null);
    if (!this.selectedCounterparty) { this.formErr.set(this.t.instant('finance.errCounterpartyRequired')); return; }
    const parsed = parseFloat(this.billForm.amountEurStr);
    if (!this.billForm.amountEurStr || isNaN(parsed) || parsed <= 0) { this.formErr.set(this.t.instant('expenses.errAmount')); return; }
    this.saving.set(true);
    this.expSvc.recordExpense({
      amountEur: parsed, description: this.billForm.description,
      counterpartyId: this.selectedCounterparty.id,
      expenseDate: this.billForm.expenseDate, idempotencyKey: crypto.randomUUID(),
    }).subscribe({
      next: () => { this.resetForm(); this.ok.set(true); this.saving.set(false); this.loadExpenses(); },
      error: () => { this.formErr.set(this.t.instant('expenses.errRecord')); this.saving.set(false); },
    });
  }
}
