import { Component, Input, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { MaintenanceFeeService } from './maintenance-fee.service';
import { ChargeDto } from './models';

function formatEur(n: number): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n);
}

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

@Component({
  selector: 'app-maintenance-fees',
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
        <a routerLink="/maintenance-fees" class="nav-link nav-active">Fees</a>
        <a routerLink="/payments" class="nav-link">Payments</a>
        <a routerLink="/notifications" class="nav-link">Notifications</a>
        <a routerLink="/privacy" class="nav-link">Privacy</a>
        <a routerLink="/contact-edit" class="nav-link">Edit Contact</a>
        <span class="role-toggle">
          <button [class.role-active]="role === 'resident'" (click)="role = 'resident'; reload()" class="role-btn">Resident</button>
          <button [class.role-active]="role === 'admin'" (click)="role = 'admin'; reload()" class="role-btn">Admin</button>
        </span>
      </header>

      <main class="harmonia-content">
        <p-card>
          <ng-template #title>Maintenance Fee Charges</ng-template>
          <ng-template #content>

            @if (loading()) {
              <div class="center-state">
                <p-progressspinner strokeWidth="4" [style]="{width:'48px',height:'48px'}" />
              </div>
            }

            @if (error()) {
              <div data-testid="error-state" class="error-state">
                <p>{{ error() }}</p>
                <button (click)="reload()">Retry</button>
              </div>
            }

            @if (role === 'admin') {
              <form data-testid="record-form" class="record-form" (ngSubmit)="onSubmit()">
                <h3 class="form-title">Record Charge</h3>
                <div class="form-row">
                  <label>Household Ref</label>
                  <input type="text" [(ngModel)]="form.householdRef" name="householdRef" required class="form-input" placeholder="e.g. H001" />
                </div>
                <div class="form-row">
                  <label>Amount (€)</label>
                  <input type="number" step="0.01" min="0.01" [(ngModel)]="form.amountEurStr" name="amountEur" required class="form-input" />
                </div>
                <div class="form-row">
                  <label>Description</label>
                  <input type="text" [(ngModel)]="form.description" name="description" required class="form-input" />
                </div>
                <div class="form-row">
                  <label>Period (YYYY-MM)</label>
                  <input type="month" [(ngModel)]="form.period" name="period" required class="form-input" />
                </div>
                <div class="form-row">
                  <button type="submit" data-testid="submit-btn" class="submit-btn" [disabled]="submitting()">Record Charge</button>
                </div>
                @if (submitSuccess()) {
                  <p data-testid="submit-success" class="success-msg">Charge recorded.</p>
                }
                @if (submitError()) {
                  <p data-testid="submit-error" class="error-msg">{{ submitError() }}</p>
                }
              </form>
            }

            @if (!loading() && !error()) {
              <h3 class="section-title">{{ role === 'admin' ? 'All Charges' : 'My Charges' }}</h3>
              <table class="fee-table">
                <thead>
                  <tr>
                    <th>Period</th>
                    @if (role === 'admin') { <th>Household</th> }
                    <th>Description</th>
                    <th>Amount</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  @for (c of charges(); track c.id) {
                    <tr [attr.data-testid]="'charge-row-' + c.id">
                      <td>{{ c.period }}</td>
                      @if (role === 'admin') { <td>{{ c.householdRef }}</td> }
                      <td>{{ c.description }}</td>
                      <td>{{ formatEur(c.amountEur) }}</td>
                      <td>{{ c.chargedAt | date:'yyyy-MM-dd' }}</td>
                    </tr>
                  }
                  @if (charges().length === 0) {
                    <tr><td [attr.colspan]="role === 'admin' ? 5 : 4" class="empty-cell">No charges on record.</td></tr>
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
    .harmonia-content { max-width: 960px; margin: 0 auto; padding: 24px 16px; }
    .record-form { background: white; border: 1px solid #e0e0e0; border-radius: 8px; padding: 20px; margin-bottom: 24px; }
    .form-title { margin: 0 0 16px; font-size: 1rem; font-weight: 600; }
    .form-row { display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px; }
    .form-row label { font-size: .8125rem; font-weight: 500; color: #555; }
    .form-input { padding: 7px 10px; border: 1px solid #ccc; border-radius: 4px; font-size: .875rem; }
    .submit-btn { background: #2e6b4f; color: white; border: none; padding: 8px 20px; border-radius: 6px; cursor: pointer; font-size: .9rem; }
    .submit-btn:hover { background: #245a40; }
    .submit-btn:disabled { opacity: .6; cursor: not-allowed; }
    .success-msg { color: #2e6b4f; font-weight: 500; margin-top: 8px; }
    .error-msg { color: #c00; margin-top: 8px; }
    .section-title { margin: 0 0 8px; font-size: 1rem; font-weight: 600; color: #333; }
    .fee-table { width: 100%; border-collapse: collapse; }
    .fee-table th, .fee-table td { padding: 8px 12px; text-align: left; border-bottom: 1px solid #eee; font-size: .875rem; }
    .fee-table th { background: #f9f9f7; font-weight: 600; color: #555; }
    .empty-cell { text-align: center; color: #999; padding: 16px; }
    .center-state { display: flex; justify-content: center; padding: 48px; }
    .error-state { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 48px; color: #c00; }
  `],
})
export class MaintenanceFeeComponent implements OnInit {
  @Input() role: 'resident' | 'admin' = 'resident';

  private readonly svc = inject(MaintenanceFeeService);

  readonly charges       = signal<ChargeDto[]>([]);
  readonly loading       = signal(true);
  readonly error         = signal<string | null>(null);
  readonly submitSuccess = signal(false);
  readonly submitError   = signal<string | null>(null);
  readonly submitting    = signal(false);

  readonly formatEur = formatEur;

  form = {
    householdRef: '',
    amountEurStr: '',
    description: '',
    period: currentMonth(),
  };

  ngOnInit(): void { this.reload(); }

  reload(): void {
    this.loading.set(true);
    this.error.set(null);
    const obs = this.role === 'admin' ? this.svc.getAllCharges() : this.svc.getMyCharges();
    obs.subscribe({
      next: list => { this.charges.set(list); this.loading.set(false); },
      error: () => { this.error.set('Could not load charges. Please try again.'); this.loading.set(false); },
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
      amountEur: parsed,
      description: this.form.description,
      period: this.form.period,
      idempotencyKey: crypto.randomUUID(),
    };
    this.svc.recordCharge(this.form.householdRef, body).subscribe({
      next: () => {
        this.submitSuccess.set(true);
        this.form = { householdRef: '', amountEurStr: '', description: '', period: currentMonth() };
        this.submitting.set(false);
        this.reload();
      },
      error: () => {
        this.submitError.set('Could not record charge. Please try again.');
        this.submitting.set(false);
      },
    });
  }
}
