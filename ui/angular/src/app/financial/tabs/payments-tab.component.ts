import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { PaymentService } from '../../payments/payment.service';
import { PaymentDto } from '../models';
import { BalanceDto } from '../../payments/models';

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatEur(n: number): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n);
}

@Component({
  selector: 'app-payments-tab',
  standalone: true,
  imports: [CommonModule, FormsModule, ProgressSpinnerModule, TranslatePipe],
  template: `
    <!-- ── Payments ── -->
    <div class="section-divider"><span class="section-label">{{ 'nav.payments' | translate }}</span></div>

    @if (balance()) {
      <div class="summary-card" style="margin-bottom:16px">
        <table class="fin-table" style="width:100%">
          <thead><tr>
            <th>{{ 'common.household' | translate }}</th>
            <th>{{ 'payments.charged' | translate }}</th>
            <th>{{ 'payments.paid' | translate }}</th>
            <th>{{ 'payments.balance' | translate }}</th>
          </tr></thead>
          <tbody>
            @for (l of balance()!.lines; track l.householdRef) {
              <tr [attr.data-testid]="'balance-row-' + l.householdRef">
                <td>{{ l.householdRef }}</td>
                <td>{{ formatEur(l.totalCharged) }}</td>
                <td>{{ formatEur(l.totalPaid) }}</td>
                <td [class.overdue]="l.balance > 0">{{ formatEur(l.balance) }}</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    }

    <form data-testid="payment-form" class="record-form" (ngSubmit)="onPaymentSubmit()">
      <h3 class="form-title">{{ 'payments.record' | translate }}</h3>
      <div class="form-grid">
        <div class="form-row">
          <label>{{ 'common.householdRef' | translate }}</label>
          <input type="text" [(ngModel)]="payForm.householdRef" name="payRef" required class="form-input" placeholder="e.g. H001" />
        </div>
        <div class="form-row">
          <label>{{ 'payments.amountEuro' | translate }}</label>
          <input type="number" step="0.01" min="0.01" [(ngModel)]="payForm.amountEurStr" name="payAmt" required class="form-input" />
        </div>
        <div class="form-row">
          <label>{{ 'payments.periodYm' | translate }}</label>
          <input type="month" [(ngModel)]="payForm.period" name="payPer" required class="form-input" />
        </div>
        <div class="form-row">
          <label>{{ 'payments.dateReceived' | translate }}</label>
          <input type="date" [(ngModel)]="payForm.dateReceived" name="payDate" required class="form-input" />
        </div>
      </div>
      <button type="submit" data-testid="payment-submit-btn" class="submit-btn" [disabled]="paySaving()">{{ 'payments.record' | translate }}</button>
      @if (payOk()) { <p data-testid="payment-submit-success" class="success-msg">{{ 'payments.recorded' | translate }}</p> }
      @if (payErr()) { <p data-testid="payment-submit-error" class="error-msg">{{ payErr() }}</p> }
    </form>

    @if (payLoading()) {
      <div class="center-state"><p-progressspinner strokeWidth="4" [style]="{width:'36px',height:'36px'}" /></div>
    } @else if (payError()) {
      <div class="error-state"><p>{{ payError() }}</p><button (click)="loadPayments()">{{ 'common.retry' | translate }}</button></div>
    } @else {
      <div class="table-scroll">
        <table class="fin-table">
          <thead><tr>
            <th>{{ 'common.period' | translate }}</th>
            <th>{{ 'common.household' | translate }}</th>
            <th>{{ 'common.amount' | translate }}</th>
            <th>{{ 'payments.dateReceived' | translate }}</th>
          </tr></thead>
          <tbody>
            @for (p of payments(); track p.id) {
              <tr [attr.data-testid]="'payment-row-' + p.id">
                <td>{{ p.period }}</td>
                <td>{{ p.householdRef }}</td>
                <td>{{ formatEur(p.amountEur) }}</td>
                <td>{{ p.dateReceived }}</td>
              </tr>
            }
            @if (payments().length === 0) {
              <tr><td colspan="4" class="empty-cell">{{ 'payments.none' | translate }}</td></tr>
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
    .summary-card { display: flex; gap: 32px; margin-bottom: 16px; padding: 16px; background: white; border-radius: 8px; border: 1px solid #e0e0e0; flex-wrap: wrap; }
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
    .overdue { color: #c00; font-weight: 600; }
    .center-state { display: flex; justify-content: center; padding: 32px; }
    .error-state { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 32px; color: #c00; }
  `],
})
export class PaymentsTabComponent implements OnInit {
  private readonly paySvc = inject(PaymentService);
  private readonly t = inject(TranslateService);

  readonly formatEur = formatEur;

  // ── Payments ─────────────────────────────────────────────────────────────
  readonly payments    = signal<PaymentDto[]>([]);
  readonly balance     = signal<BalanceDto | null>(null);
  readonly payLoading  = signal(true);
  readonly payError    = signal<string | null>(null);
  readonly paySaving   = signal(false);
  readonly payOk       = signal(false);
  readonly payErr      = signal<string | null>(null);
  payForm = { householdRef: '', amountEurStr: '', period: currentMonth(), dateReceived: today() };

  ngOnInit(): void {
    this.loadPayments();
    this.loadBalance();
  }

  loadPayments(): void {
    this.payLoading.set(true); this.payError.set(null);
    this.paySvc.getAllPayments().subscribe({
      next: list => { this.payments.set(list); this.payLoading.set(false); },
      error: () => { this.payError.set(this.t.instant('payments.errLoad')); this.payLoading.set(false); },
    });
  }

  loadBalance(): void {
    this.paySvc.getBalance().subscribe({
      next: b => this.balance.set(b),
      error: () => { /* non-blocking */ },
    });
  }

  onPaymentSubmit(): void {
    this.payOk.set(false); this.payErr.set(null);
    const parsed = parseFloat(this.payForm.amountEurStr);
    if (!this.payForm.householdRef || !this.payForm.amountEurStr || isNaN(parsed) || parsed <= 0) {
      this.payErr.set(this.t.instant('payments.errInput')); return;
    }
    this.paySaving.set(true);
    this.paySvc.recordPayment({
      householdRef: this.payForm.householdRef, amountEur: parsed,
      period: this.payForm.period, dateReceived: this.payForm.dateReceived,
      idempotencyKey: crypto.randomUUID(),
    }).subscribe({
      next: () => {
        this.payOk.set(true);
        this.payForm = { householdRef: '', amountEurStr: '', period: currentMonth(), dateReceived: today() };
        this.paySaving.set(false);
        this.loadPayments();
        this.loadBalance();
      },
      error: () => { this.payErr.set(this.t.instant('payments.errRecord')); this.paySaving.set(false); },
    });
  }
}
