import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { forkJoin } from 'rxjs';
import { FinancialService } from './financial.service';
import { ChargeDto, PaymentDto, PeriodSummaryDto } from './models';

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function formatEur(n: number): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n);
}

@Component({
  selector: 'app-financial',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    CardModule,
    ButtonModule,
    ProgressSpinnerModule,
  ],
  template: `
    <div class="harmonia-shell">
      <header class="harmonia-header">
        <span class="harmonia-logo">🏡 Harmonia</span>
        <span class="harmonia-subtitle">Resident Portal</span>
        <div class="flex-spacer"></div>
        <a routerLink="/directory" class="nav-link">Directory</a>
        <a routerLink="/reservations" class="nav-link">Reservations</a>
        <a routerLink="/financial" class="nav-link nav-active">Finance</a>
        <a routerLink="/expenses" class="nav-link">Expenses</a>
        <a routerLink="/maintenance-fees" class="nav-link">Fees</a>
        <a routerLink="/payments" class="nav-link">Payments</a>
        <a routerLink="/notifications" class="nav-link">Notifications</a>
        <a routerLink="/privacy" class="nav-link">Privacy</a>
        <a routerLink="/contact-edit" class="nav-link">Edit Contact</a>
      </header>

      <main class="harmonia-content">
        <p-card>
          <ng-template #title>Financial Summary</ng-template>
          <ng-template #content>

            @if (loading()) {
              <div class="center-state">
                <p-progressspinner strokeWidth="4" [style]="{width:'48px',height:'48px'}" />
              </div>
            }

            @if (error()) {
              <div data-testid="error-state" class="error-state">
                <p>{{ error() }}</p>
                <button data-testid="retry-btn" (click)="loadAll()">Retry</button>
              </div>
            }

            @if (!loading() && !error()) {
              <div class="period-row">
                <label class="period-label">Period:</label>
                <input
                  type="month"
                  [(ngModel)]="period"
                  (ngModelChange)="loadAll()"
                  class="period-input"
                />
              </div>

              @if (summary()) {
                <div class="summary-card">
                  <div class="summary-item">
                    <span class="summary-label">Total charges this period</span>
                    <span data-testid="summary-charges" class="summary-value">
                      {{ formatEur(summary()!.totalChargesEur) }}
                    </span>
                  </div>
                  <div class="summary-item">
                    <span class="summary-label">Total expenses this period</span>
                    <span data-testid="summary-expenses" class="summary-value">
                      {{ formatEur(summary()!.totalExpensesEur) }}
                    </span>
                  </div>
                </div>
              }

              <h3 class="section-title">My Charges</h3>
              <table class="fin-table">
                <thead>
                  <tr><th>Date</th><th>Description</th><th>Period</th><th>Amount</th></tr>
                </thead>
                <tbody>
                  @for (c of charges(); track c.id) {
                    <tr [attr.data-testid]="'charge-row-' + c.id">
                      <td>{{ c.chargedAt | date:'yyyy-MM-dd' }}</td>
                      <td>{{ c.description }}</td>
                      <td>{{ c.period }}</td>
                      <td>{{ formatEur(c.amountEur) }}</td>
                    </tr>
                  }
                  @if (charges().length === 0) {
                    <tr><td colspan="4" class="empty-cell">No charges on record.</td></tr>
                  }
                </tbody>
              </table>

              <h3 class="section-title">My Payments</h3>
              <table class="fin-table">
                <thead>
                  <tr><th>Date received</th><th>Period</th><th>Amount</th></tr>
                </thead>
                <tbody>
                  @for (p of payments(); track p.id) {
                    <tr [attr.data-testid]="'payment-row-' + p.id">
                      <td>{{ p.dateReceived }}</td>
                      <td>{{ p.period }}</td>
                      <td>{{ formatEur(p.amountEur) }}</td>
                    </tr>
                  }
                  @if (payments().length === 0) {
                    <tr><td colspan="3" class="empty-cell">No payments on record.</td></tr>
                  }
                </tbody>
              </table>

              <div class="pay-row">
                <button data-testid="pay-btn" class="pay-btn" (click)="showPayDialog = true">
                  Request Payment
                </button>
              </div>
            }

            @if (showPayDialog) {
              <div class="dialog-backdrop">
                <div class="dialog-box" data-testid="pay-dialog">
                  <h4 class="dialog-title">Request Payment</h4>
                  <p>Payments are recorded by the building administrator.</p>
                  <p>Please contact the office to register a payment.</p>
                  <button class="dialog-close-btn" (click)="showPayDialog = false">Close</button>
                </div>
              </div>
            }

          </ng-template>
        </p-card>
      </main>
    </div>
  `,
  styles: [`
    .harmonia-shell { min-height: 100vh; background: #f5f5f0; }
    .harmonia-header {
      display: flex; align-items: center; gap: 12px; padding: 12px 24px;
      background: #2e6b4f; color: white;
    }
    .harmonia-logo { font-size: 1.25rem; font-weight: 700; }
    .harmonia-subtitle { opacity: .7; font-size: .875rem; }
    .flex-spacer { flex: 1; }
    .nav-link { color: rgba(255,255,255,.75); text-decoration: none; padding: 6px 12px; border-radius: 6px; font-size: .875rem; }
    .nav-link:hover { background: rgba(255,255,255,.1); }
    .nav-active { background: rgba(255,255,255,.18); color: white; font-weight: 600; }
    .harmonia-content { max-width: 900px; margin: 0 auto; padding: 24px 16px; }
    .period-row { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
    .period-label { font-weight: 500; }
    .period-input { padding: 6px 8px; border-radius: 4px; border: 1px solid #ccc; font-size: 14px; }
    .summary-card { display: flex; gap: 32px; margin-bottom: 24px; padding: 16px; background: white; border-radius: 8px; border: 1px solid #e0e0e0; }
    .summary-item { display: flex; flex-direction: column; gap: 4px; }
    .summary-label { font-size: .8125rem; color: #666; }
    .summary-value { font-size: 1.25rem; font-weight: 700; color: #2e6b4f; }
    .section-title { margin: 20px 0 8px; font-size: 1rem; font-weight: 600; color: #333; }
    .fin-table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    .fin-table th, .fin-table td { padding: 8px 12px; text-align: left; border-bottom: 1px solid #eee; font-size: .875rem; }
    .fin-table th { background: #f9f9f7; font-weight: 600; color: #555; }
    .empty-cell { text-align: center; color: #999; padding: 16px; }
    .center-state { display: flex; justify-content: center; padding: 48px; }
    .error-state { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 48px; color: #c00; }
    .pay-row { margin-top: 8px; }
    .pay-btn { background: #2e6b4f; color: white; border: none; padding: 8px 20px; border-radius: 6px; font-size: .9rem; cursor: pointer; }
    .pay-btn:hover { background: #245a40; }
    .dialog-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,.4); display: flex; align-items: center; justify-content: center; z-index: 1000; }
    .dialog-box { background: white; border-radius: 8px; padding: 24px; max-width: 360px; width: 90%; box-shadow: 0 8px 32px rgba(0,0,0,.2); }
    .dialog-title { margin: 0 0 12px; font-size: 1.1rem; font-weight: 600; }
    .dialog-close-btn { margin-top: 16px; background: #2e6b4f; color: white; border: none; padding: 6px 16px; border-radius: 4px; cursor: pointer; }
  `],
})
export class FinancialComponent implements OnInit {
  private readonly svc = inject(FinancialService);

  readonly summary   = signal<PeriodSummaryDto | null>(null);
  readonly charges   = signal<ChargeDto[]>([]);
  readonly payments  = signal<PaymentDto[]>([]);
  readonly loading   = signal(true);
  readonly error     = signal<string | null>(null);
  period = currentMonth();
  showPayDialog = false;

  readonly formatEur = formatEur;

  ngOnInit(): void { this.loadAll(); }

  loadAll(): void {
    this.loading.set(true);
    this.error.set(null);
    forkJoin({
      summary:  this.svc.getPeriodSummary(this.period),
      charges:  this.svc.getMyCharges(),
      payments: this.svc.getMyPayments(),
    }).subscribe({
      next: ({ summary, charges, payments }) => {
        this.summary.set(summary);
        this.charges.set(charges);
        this.payments.set(payments);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Could not load financial data. Please try again.');
        this.loading.set(false);
      },
    });
  }

}
