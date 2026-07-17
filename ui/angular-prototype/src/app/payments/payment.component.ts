import { Component, Input, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { PaymentService } from './payment.service';
import { PaymentDto, BalanceDto } from './models';

function formatEur(n: number): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

@Component({
  selector: 'app-payments',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, CardModule, ButtonModule, ProgressSpinnerModule],
  template: `
    <div class="harmonia-shell">
      <header class="harmonia-header">
        <span class="harmonia-logo">🏡 Harmonia</span>
        <span class="harmonia-subtitle">Resident Portal</span>
        <div class="flex-spacer"></div>
        <a routerLink="/directory" class="nav-link">Directory</a>
        <a routerLink="/reservations" class="nav-link">Reservations</a>
        <a routerLink="/financial" class="nav-link">Finance</a>
        <a routerLink="/expenses" class="nav-link">Expenses</a>
        <a routerLink="/maintenance-fees" class="nav-link">Fees</a>
        <a routerLink="/payments" class="nav-link nav-active">Payments</a>
        <a routerLink="/notifications" class="nav-link">Notifications</a>
        <a routerLink="/privacy" class="nav-link">Privacy</a>
        <span class="role-toggle">
          <button [class.role-active]="role === 'resident'" (click)="role = 'resident'; reload()" class="role-btn">Resident</button>
          <button [class.role-active]="role === 'admin'" (click)="role = 'admin'; reload()" class="role-btn">Admin</button>
        </span>
      </header>

      <main class="harmonia-content">

        @if (role === 'admin') {
          <p-card styleClass="mb-card">
            <ng-template #title>Record Payment</ng-template>
            <ng-template #content>
              <form data-testid="record-form" class="record-form" (ngSubmit)="onSubmit()">
                <div class="form-grid">
                  <div class="form-row">
                    <label>Household Ref</label>
                    <input type="text" [(ngModel)]="form.householdRef" name="householdRef" required class="form-input" placeholder="e.g. H001" />
                  </div>
                  <div class="form-row">
                    <label>Amount (€)</label>
                    <input type="number" step="0.01" min="0.01" [(ngModel)]="form.amountEurStr" name="amountEur" required class="form-input" />
                  </div>
                  <div class="form-row">
                    <label>Period (YYYY-MM)</label>
                    <input type="month" [(ngModel)]="form.period" name="period" required class="form-input" />
                  </div>
                  <div class="form-row">
                    <label>Date received</label>
                    <input type="date" [(ngModel)]="form.dateReceived" name="dateReceived" required class="form-input" />
                  </div>
                </div>
                <button type="submit" data-testid="submit-btn" class="submit-btn" [disabled]="submitting()">Record Payment</button>
                @if (submitSuccess()) {
                  <p data-testid="submit-success" class="success-msg">Payment recorded.</p>
                }
                @if (submitError()) {
                  <p data-testid="submit-error" class="error-msg">{{ submitError() }}</p>
                }
              </form>
            </ng-template>
          </p-card>
        }

        <p-card styleClass="mb-card">
          <ng-template #title>Balance — {{ balance()?.label ?? '…' }}</ng-template>
          <ng-template #content>
            @if (loadingBalance()) {
              <div class="center-state"><p-progressspinner strokeWidth="4" [style]="{width:'36px',height:'36px'}" /></div>
            }
            @if (!loadingBalance() && balance()) {
              <table class="pay-table">
                <thead>
                  <tr>
                    @if (role === 'admin') { <th>Household</th> }
                    <th>Charged</th>
                    <th>Paid</th>
                    <th>Balance</th>
                  </tr>
                </thead>
                <tbody>
                  @for (line of balance()!.lines; track line.householdRef) {
                    <tr [attr.data-testid]="'balance-row-' + line.householdRef">
                      @if (role === 'admin') { <td>{{ line.householdRef }}</td> }
                      <td>{{ formatEur(line.totalCharged) }}</td>
                      <td>{{ formatEur(line.totalPaid) }}</td>
                      <td [class.overdue]="line.balance > 0">{{ formatEur(line.balance) }}</td>
                    </tr>
                  }
                  @if (balance()!.lines.length === 0) {
                    <tr><td [attr.colspan]="role === 'admin' ? 4 : 3" class="empty-cell">No balance data.</td></tr>
                  }
                </tbody>
              </table>
            }
          </ng-template>
        </p-card>

        <p-card>
          <ng-template #title>{{ role === 'admin' ? 'All Payments' : 'My Payments' }}</ng-template>
          <ng-template #content>
            @if (loading()) {
              <div class="center-state"><p-progressspinner strokeWidth="4" [style]="{width:'48px',height:'48px'}" /></div>
            }
            @if (error()) {
              <div data-testid="error-state" class="error-state">
                <p>{{ error() }}</p>
                <button (click)="reload()">Retry</button>
              </div>
            }
            @if (!loading() && !error()) {
              <table class="pay-table">
                <thead>
                  <tr>
                    <th>Period</th>
                    @if (role === 'admin') { <th>Household</th> }
                    <th>Amount</th>
                    <th>Date received</th>
                  </tr>
                </thead>
                <tbody>
                  @for (p of payments(); track p.id) {
                    <tr [attr.data-testid]="'payment-row-' + p.id">
                      <td>{{ p.period }}</td>
                      @if (role === 'admin') { <td>{{ p.householdRef }}</td> }
                      <td>{{ formatEur(p.amountEur) }}</td>
                      <td>{{ p.dateReceived }}</td>
                    </tr>
                  }
                  @if (payments().length === 0) {
                    <tr><td [attr.colspan]="role === 'admin' ? 4 : 3" class="empty-cell">No payments on record.</td></tr>
                  }
                </tbody>
              </table>
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
    .role-toggle { display: flex; border-radius: 6px; overflow: hidden; border: 1px solid rgba(255,255,255,.3); margin-left: 8px; }
    .role-btn { background: transparent; color: rgba(255,255,255,.75); border: none; padding: 4px 12px; cursor: pointer; font-size: .8125rem; }
    .role-btn.role-active { background: rgba(255,255,255,.22); color: white; font-weight: 600; }
    .harmonia-content { max-width: 1000px; margin: 0 auto; padding: 24px 16px; display: flex; flex-direction: column; gap: 20px; }
    ::ng-deep .mb-card { margin-bottom: 0 !important; }
    .record-form {}
    .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px; }
    .form-row { display: flex; flex-direction: column; gap: 4px; }
    .form-row label { font-size: .8125rem; font-weight: 500; color: #555; }
    .form-input { padding: 7px 10px; border: 1px solid #ccc; border-radius: 4px; font-size: .875rem; }
    .submit-btn { background: #2e6b4f; color: white; border: none; padding: 8px 20px; border-radius: 6px; cursor: pointer; font-size: .9rem; }
    .submit-btn:hover { background: #245a40; }
    .submit-btn:disabled { opacity: .6; cursor: not-allowed; }
    .success-msg { color: #2e6b4f; font-weight: 500; margin-top: 8px; }
    .error-msg { color: #c00; margin-top: 8px; }
    .pay-table { width: 100%; border-collapse: collapse; }
    .pay-table th, .pay-table td { padding: 8px 12px; text-align: left; border-bottom: 1px solid #eee; font-size: .875rem; }
    .pay-table th { background: #f9f9f7; font-weight: 600; color: #555; }
    .overdue { color: #c00; font-weight: 600; }
    .empty-cell { text-align: center; color: #999; padding: 16px; }
    .center-state { display: flex; justify-content: center; padding: 32px; }
    .error-state { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 32px; color: #c00; }
  `],
})
export class PaymentComponent implements OnInit {
  @Input() role: 'resident' | 'admin' = 'resident';

  private readonly svc = inject(PaymentService);

  readonly payments       = signal<PaymentDto[]>([]);
  readonly balance        = signal<BalanceDto | null>(null);
  readonly loading        = signal(true);
  readonly loadingBalance = signal(true);
  readonly error          = signal<string | null>(null);
  readonly submitSuccess  = signal(false);
  readonly submitError    = signal<string | null>(null);
  readonly submitting     = signal(false);

  readonly formatEur = formatEur;

  form = {
    householdRef: '',
    amountEurStr: '',
    period: currentMonth(),
    dateReceived: today(),
  };

  ngOnInit(): void { this.reload(); }

  reload(): void {
    this.loadPayments();
    this.loadBalance();
  }

  private loadPayments(): void {
    this.loading.set(true);
    this.error.set(null);
    const obs = this.role === 'admin' ? this.svc.getAllPayments() : this.svc.getMyPayments();
    obs.subscribe({
      next: list => { this.payments.set(list); this.loading.set(false); },
      error: () => { this.error.set('Could not load payments. Please try again.'); this.loading.set(false); },
    });
  }

  private loadBalance(): void {
    this.loadingBalance.set(true);
    this.svc.getBalance().subscribe({
      next: b => { this.balance.set(b); this.loadingBalance.set(false); },
      error: () => { this.loadingBalance.set(false); },
    });
  }

  onSubmit(): void {
    this.submitSuccess.set(false);
    this.submitError.set(null);
    const parsed = parseFloat(this.form.amountEurStr);
    if (!this.form.householdRef || !this.form.amountEurStr || isNaN(parsed) || parsed <= 0) {
      this.submitError.set('Enter a valid household ref and amount greater than zero.');
      return;
    }
    this.submitting.set(true);
    const body = {
      householdRef: this.form.householdRef,
      amountEur: parsed,
      period: this.form.period,
      dateReceived: this.form.dateReceived,
      idempotencyKey: crypto.randomUUID(),
    };
    this.svc.recordPayment(body).subscribe({
      next: () => {
        this.submitSuccess.set(true);
        this.form = { householdRef: '', amountEurStr: '', period: currentMonth(), dateReceived: today() };
        this.submitting.set(false);
        this.reload();
      },
      error: () => {
        this.submitError.set('Could not record payment. Please try again.');
        this.submitting.set(false);
      },
    });
  }
}
