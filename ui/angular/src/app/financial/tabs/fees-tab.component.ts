import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { MaintenanceFeeService } from '../../maintenance-fees/maintenance-fee.service';
import { ChargeDto } from '../models';

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function formatEur(n: number): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n);
}

@Component({
  selector: 'app-fees-tab',
  standalone: true,
  imports: [CommonModule, FormsModule, ProgressSpinnerModule, TranslatePipe],
  template: `
    <!-- ── Maintenance fees ── -->
    <div class="section-divider"><span class="section-label">{{ 'nav.fees' | translate }}</span></div>

    <form data-testid="fee-form" class="record-form" (ngSubmit)="onFeeSubmit()">
      <h3 class="form-title">{{ 'fees.record' | translate }}</h3>
      <div class="form-grid">
        <div class="form-row">
          <label>{{ 'common.householdRef' | translate }}</label>
          <input type="text" [(ngModel)]="feeForm.householdRef" name="feeRef" required class="form-input" placeholder="e.g. H001" />
        </div>
        <div class="form-row">
          <label>{{ 'fees.amountEuro' | translate }}</label>
          <input type="number" step="0.01" min="0.01" [(ngModel)]="feeForm.amountEurStr" name="feeAmt" required class="form-input" />
        </div>
        <div class="form-row">
          <label>{{ 'common.description' | translate }}</label>
          <input type="text" [(ngModel)]="feeForm.description" name="feeDesc" class="form-input" />
        </div>
        <div class="form-row">
          <label>{{ 'fees.periodYm' | translate }}</label>
          <input type="month" [(ngModel)]="feeForm.period" name="feePer" required class="form-input" />
        </div>
      </div>
      <button type="submit" data-testid="fee-submit-btn" class="submit-btn" [disabled]="feeSaving()">{{ 'fees.record' | translate }}</button>
      @if (feeOk()) { <p data-testid="fee-submit-success" class="success-msg">{{ 'fees.recorded' | translate }}</p> }
      @if (feeErr()) { <p data-testid="fee-submit-error" class="error-msg">{{ feeErr() }}</p> }
    </form>

    @if (feesLoading()) {
      <div class="center-state"><p-progressspinner strokeWidth="4" [style]="{width:'36px',height:'36px'}" /></div>
    } @else if (feesError()) {
      <div class="error-state"><p>{{ feesError() }}</p><button (click)="loadFees()">{{ 'common.retry' | translate }}</button></div>
    } @else {
      <div class="table-scroll">
        <table class="fin-table">
          <thead><tr>
            <th>{{ 'common.period' | translate }}</th>
            <th>{{ 'common.household' | translate }}</th>
            <th>{{ 'common.description' | translate }}</th>
            <th>{{ 'common.amount' | translate }}</th>
            <th>{{ 'fees.chargedAt' | translate }}</th>
          </tr></thead>
          <tbody>
            @for (c of charges(); track c.id) {
              <tr [attr.data-testid]="'charge-row-' + c.id">
                <td>{{ c.period }}</td>
                <td>{{ c.householdRef }}</td>
                <td>{{ c.description }}</td>
                <td>{{ formatEur(c.amountEur) }}</td>
                <td>{{ c.chargedAt | date:'yyyy-MM-dd' }}</td>
              </tr>
            }
            @if (charges().length === 0) {
              <tr><td colspan="5" class="empty-cell">{{ 'fees.none' | translate }}</td></tr>
            }
          </tbody>
        </table>
      </div>
    }
  `,
  styles: [`
    .section-divider { display: flex; align-items: center; margin: 24px 0 16px; gap: 12px; }
    .section-divider::before, .section-divider::after { content: ''; flex: 1; height: 1px; background: #e0e0e0; }
    .section-label { font-size: .75rem; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; color: #888; white-space: nowrap; }
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
    .success-msg { color: #2e6b4f; font-weight: 500; margin: 8px 0 0; font-size: .875rem; }
    .error-msg { color: #c00; margin: 8px 0 0; font-size: .875rem; }
    .table-scroll { overflow-x: auto; }
    .fin-table { width: 100%; border-collapse: collapse; }
    .fin-table th, .fin-table td { padding: 8px 12px; text-align: left; border-bottom: 1px solid #eee; font-size: .875rem; white-space: nowrap; }
    .fin-table th { background: #f9f9f7; font-weight: 600; color: #555; }
    .empty-cell { text-align: center; color: #999; padding: 16px; white-space: normal; }
    .center-state { display: flex; justify-content: center; padding: 32px; }
    .error-state { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 32px; color: #c00; }
  `],
})
export class FeesTabComponent implements OnInit {
  private readonly feeSvc = inject(MaintenanceFeeService);
  private readonly t = inject(TranslateService);

  readonly formatEur = formatEur;

  // ── Maintenance fees ──────────────────────────────────────────────────────
  readonly charges     = signal<ChargeDto[]>([]);
  readonly feesLoading = signal(true);
  readonly feesError   = signal<string | null>(null);
  readonly feeSaving   = signal(false);
  readonly feeOk       = signal(false);
  readonly feeErr      = signal<string | null>(null);
  feeForm = { householdRef: '', amountEurStr: '', description: '', period: currentMonth() };

  ngOnInit(): void {
    this.loadFees();
  }

  loadFees(): void {
    this.feesLoading.set(true); this.feesError.set(null);
    this.feeSvc.getAllCharges().subscribe({
      next: list => { this.charges.set(list); this.feesLoading.set(false); },
      error: () => { this.feesError.set(this.t.instant('fees.errLoad')); this.feesLoading.set(false); },
    });
  }

  onFeeSubmit(): void {
    this.feeOk.set(false); this.feeErr.set(null);
    const parsed = parseFloat(this.feeForm.amountEurStr);
    if (!this.feeForm.householdRef || !this.feeForm.amountEurStr || isNaN(parsed) || parsed <= 0) {
      this.feeErr.set(this.t.instant('fees.errInput')); return;
    }
    this.feeSaving.set(true);
    this.feeSvc.recordCharge(this.feeForm.householdRef, {
      amountEur: parsed, description: this.feeForm.description,
      period: this.feeForm.period, idempotencyKey: crypto.randomUUID(),
    }).subscribe({
      next: () => {
        this.feeOk.set(true);
        this.feeForm = { householdRef: '', amountEurStr: '', description: '', period: currentMonth() };
        this.feeSaving.set(false);
        this.loadFees();
      },
      error: () => { this.feeErr.set(this.t.instant('fees.errRecord')); this.feeSaving.set(false); },
    });
  }
}
