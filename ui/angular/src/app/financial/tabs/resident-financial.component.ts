import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { TabsModule } from 'primeng/tabs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { FinancialService } from '../financial.service';
import { MaintenanceFeeService } from '../../maintenance-fees/maintenance-fee.service';
import { PaymentService } from '../../payments/payment.service';
import { PeriodSummaryDto, ChargeDto, PaymentDto } from '../models';
import { BalanceDto } from '../../payments/models';

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function formatEur(n: number): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n);
}

@Component({
  selector: 'app-resident-financial',
  standalone: true,
  imports: [CommonModule, FormsModule, ProgressSpinnerModule, TabsModule, TranslatePipe],
  template: `
    <!-- Period summary -->
    <div class="period-row">
      <label class="period-label">{{ 'finance.periodLabel' | translate }}</label>
      <input type="month" [(ngModel)]="period" (ngModelChange)="loadSummary()" class="period-input" />
      @if (sumLoading()) {
        <p-progressspinner strokeWidth="4" [style]="{width:'24px',height:'24px'}" />
      }
    </div>

    @if (sumError()) {
      <p class="error-msg">{{ sumError() }}</p>
    }

    @if (summary()) {
      <div class="summary-card">
        <div class="summary-item">
          <span class="summary-label">{{ 'finance.totalCharges' | translate }}</span>
          <span data-testid="summary-charges" class="summary-value">{{ formatEur(summary()!.totalChargesEur) }}</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">{{ 'finance.totalExpenses' | translate }}</span>
          <span data-testid="summary-expenses" class="summary-value">{{ formatEur(summary()!.totalExpensesEur) }}</span>
        </div>
      </div>
    }

    <p-tabs value="fees">
      <p-tablist>
        <p-tab value="fees">{{ 'finance.residentTabFees' | translate }}</p-tab>
        <p-tab value="payments">{{ 'finance.residentTabPayments' | translate }}</p-tab>
      </p-tablist>
      <p-tabpanels>
        <p-tabpanel value="fees">
          <!-- ── Maintenance fees ── -->
          @if (feesLoading()) {
            <div class="center-state"><p-progressspinner strokeWidth="4" [style]="{width:'36px',height:'36px'}" /></div>
          } @else if (feesError()) {
            <div class="error-state"><p>{{ feesError() }}</p><button (click)="loadFees()">{{ 'common.retry' | translate }}</button></div>
          } @else {
            <div class="table-scroll">
              <table class="fin-table">
                <thead><tr>
                  <th>{{ 'common.period' | translate }}</th>
                  <th>{{ 'common.description' | translate }}</th>
                  <th>{{ 'common.amount' | translate }}</th>
                  <th>{{ 'fees.chargedAt' | translate }}</th>
                </tr></thead>
                <tbody>
                  @for (c of charges(); track c.id) {
                    <tr [attr.data-testid]="'charge-row-' + c.id">
                      <td>{{ c.period }}</td>
                      <td>{{ c.description }}</td>
                      <td>{{ formatEur(c.amountEur) }}</td>
                      <td>{{ c.chargedAt | date:'yyyy-MM-dd' }}</td>
                    </tr>
                  }
                  @if (charges().length === 0) {
                    <tr><td colspan="4" class="empty-cell">{{ 'fees.none' | translate }}</td></tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </p-tabpanel>

        <p-tabpanel value="payments">
          <!-- ── Payments ── -->
          @if (balance()) {
            <div class="summary-card" style="margin-bottom:16px">
              <table class="fin-table" style="width:100%">
                <thead><tr>
                  <th>{{ 'payments.charged' | translate }}</th>
                  <th>{{ 'payments.paid' | translate }}</th>
                  <th>{{ 'payments.balance' | translate }}</th>
                </tr></thead>
                <tbody>
                  @for (l of balance()!.lines; track l.householdRef) {
                    <tr>
                      <td>{{ formatEur(l.totalCharged) }}</td>
                      <td>{{ formatEur(l.totalPaid) }}</td>
                      <td [class.overdue]="l.balance > 0">{{ formatEur(l.balance) }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }

          @if (payLoading()) {
            <div class="center-state"><p-progressspinner strokeWidth="4" [style]="{width:'36px',height:'36px'}" /></div>
          } @else if (payError()) {
            <div class="error-state"><p>{{ payError() }}</p><button (click)="loadPayments()">{{ 'common.retry' | translate }}</button></div>
          } @else {
            <div class="table-scroll">
              <table class="fin-table">
                <thead><tr>
                  <th>{{ 'common.period' | translate }}</th>
                  <th>{{ 'common.amount' | translate }}</th>
                  <th>{{ 'payments.dateReceived' | translate }}</th>
                </tr></thead>
                <tbody>
                  @for (p of payments(); track p.id) {
                    <tr [attr.data-testid]="'payment-row-' + p.id">
                      <td>{{ p.period }}</td>
                      <td>{{ formatEur(p.amountEur) }}</td>
                      <td>{{ p.dateReceived }}</td>
                    </tr>
                  }
                  @if (payments().length === 0) {
                    <tr><td colspan="3" class="empty-cell">{{ 'payments.none' | translate }}</td></tr>
                  }
                </tbody>
              </table>
            </div>
          }

          <!-- Request payment button + dialog -->
          <div class="pay-row">
            <button data-testid="pay-btn" class="pay-btn" (click)="showPayDialog = true">{{ 'finance.requestPayment' | translate }}</button>
          </div>

          @if (showPayDialog) {
            <div class="dialog-backdrop">
              <div class="dialog-box" data-testid="pay-dialog">
                <h4 class="dialog-title">{{ 'finance.requestPayment' | translate }}</h4>
                <p>{{ 'finance.requestInfo' | translate }}</p>
                <p>{{ 'finance.contactOffice' | translate }}</p>
                <button class="dialog-close-btn" (click)="showPayDialog = false">{{ 'common.close' | translate }}</button>
              </div>
            </div>
          }
        </p-tabpanel>
      </p-tabpanels>
    </p-tabs>
  `,
  styles: [`
    .period-row { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; }
    .period-label { font-weight: 500; }
    .period-input { padding: 6px 8px; border-radius: 4px; border: 1px solid #ccc; font-size: 14px; }
    .summary-card { display: flex; gap: 32px; margin-bottom: 16px; padding: 16px; background: white; border-radius: 8px; border: 1px solid #e0e0e0; flex-wrap: wrap; }
    .summary-item { display: flex; flex-direction: column; gap: 4px; }
    .summary-label { font-size: .8125rem; color: #666; }
    .summary-value { font-size: 1.25rem; font-weight: 700; color: #2e6b4f; }
    .error-msg { color: #c00; margin: 8px 0 0; font-size: .875rem; }
    .table-scroll { overflow-x: auto; }
    .fin-table { width: 100%; border-collapse: collapse; }
    .fin-table th, .fin-table td { padding: 8px 12px; text-align: left; border-bottom: 1px solid #eee; font-size: .875rem; white-space: nowrap; }
    .fin-table th { background: #f9f9f7; font-weight: 600; color: #555; }
    .empty-cell { text-align: center; color: #999; padding: 16px; white-space: normal; }
    .overdue { color: #c00; font-weight: 600; }
    .center-state { display: flex; justify-content: center; padding: 32px; }
    .error-state { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 32px; color: #c00; }
    .pay-row { margin-top: 16px; }
    .pay-btn { background: #2e6b4f; color: white; border: none; padding: 8px 20px; border-radius: 6px; font-size: .9rem; cursor: pointer; }
    .pay-btn:hover { background: #245a40; }
    .dialog-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,.4); display: flex; align-items: center; justify-content: center; z-index: 1000; }
    .dialog-box { background: white; border-radius: 8px; padding: 24px; max-width: 360px; width: 90%; box-shadow: 0 8px 32px rgba(0,0,0,.2); }
    .dialog-title { margin: 0 0 12px; font-size: 1.1rem; font-weight: 600; }
    .dialog-close-btn { margin-top: 16px; background: #2e6b4f; color: white; border: none; padding: 6px 16px; border-radius: 4px; cursor: pointer; }
  `],
})
export class ResidentFinancialComponent implements OnInit {
  private readonly finSvc  = inject(FinancialService);
  private readonly feeSvc  = inject(MaintenanceFeeService);
  private readonly paySvc  = inject(PaymentService);
  private readonly t       = inject(TranslateService);

  readonly formatEur = formatEur;

  // ── Period summary ────────────────────────────────────────────────────────
  period = currentMonth();
  readonly summary    = signal<PeriodSummaryDto | null>(null);
  readonly sumLoading = signal(true);
  readonly sumError   = signal<string | null>(null);

  // ── Maintenance fees ──────────────────────────────────────────────────────
  readonly charges     = signal<ChargeDto[]>([]);
  readonly feesLoading = signal(true);
  readonly feesError   = signal<string | null>(null);

  // ── Payments ──────────────────────────────────────────────────────────────
  readonly payments    = signal<PaymentDto[]>([]);
  readonly balance     = signal<BalanceDto | null>(null);
  readonly payLoading  = signal(true);
  readonly payError    = signal<string | null>(null);

  showPayDialog = false;

  ngOnInit(): void {
    this.loadSummary();
    this.loadFees();
    this.loadPayments();
    this.loadBalance();
  }

  loadSummary(): void {
    this.sumLoading.set(true); this.sumError.set(null);
    this.finSvc.getPeriodSummary(this.period).subscribe({
      next: s => { this.summary.set(s); this.sumLoading.set(false); },
      error: () => { this.sumError.set(this.t.instant('finance.errLoad')); this.sumLoading.set(false); },
    });
  }

  loadFees(): void {
    this.feesLoading.set(true); this.feesError.set(null);
    this.feeSvc.getMyCharges().subscribe({
      next: list => { this.charges.set(list); this.feesLoading.set(false); },
      error: () => { this.feesError.set(this.t.instant('fees.errLoad')); this.feesLoading.set(false); },
    });
  }

  loadPayments(): void {
    this.payLoading.set(true); this.payError.set(null);
    this.paySvc.getMyPayments().subscribe({
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
}
