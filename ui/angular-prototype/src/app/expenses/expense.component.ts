import { Component, Input, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { ExpenseService } from './expense.service';
import { ExpenseDto, EXPENSE_CATEGORIES } from './models';

function formatEur(n: number): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n);
}

@Component({
  selector: 'app-expenses',
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
        <a routerLink="/expenses" class="nav-link nav-active">Expenses</a>
        <a routerLink="/maintenance-fees" class="nav-link">Fees</a>
        <a routerLink="/payments" class="nav-link">Payments</a>
        <a routerLink="/notifications" class="nav-link">Notifications</a>
        <a routerLink="/privacy" class="nav-link">Privacy</a>
        <span class="role-toggle">
          <button
            [class.role-active]="role === 'resident'"
            (click)="role = 'resident'"
            class="role-btn"
          >Resident</button>
          <button
            [class.role-active]="role === 'admin'"
            (click)="role = 'admin'"
            class="role-btn"
          >Admin</button>
        </span>
      </header>

      <main class="harmonia-content">
        <p-card>
          <ng-template #title>Building Expenses</ng-template>
          <ng-template #content>

            @if (loading()) {
              <div class="center-state">
                <p-progressspinner strokeWidth="4" [style]="{width:'48px',height:'48px'}" />
              </div>
            }

            @if (error()) {
              <div data-testid="error-state" class="error-state">
                <p>{{ error() }}</p>
                <button (click)="loadExpenses()">Retry</button>
              </div>
            }

            @if (role === 'admin') {
              <form data-testid="record-form" class="record-form" (ngSubmit)="onSubmit()">
                <h3 class="form-title">Record Expense</h3>
                <div class="form-row">
                  <label>Amount (€)</label>
                  <input type="number" step="0.01" min="0.01" [(ngModel)]="form.amountEur" name="amountEur" required class="form-input" />
                </div>
                <div class="form-row">
                  <label>Description</label>
                  <input type="text" [(ngModel)]="form.description" name="description" required class="form-input" />
                </div>
                <div class="form-row">
                  <label>Category</label>
                  <select [(ngModel)]="form.category" name="category" class="form-input">
                    @for (cat of categories; track cat) {
                      <option [value]="cat">{{ cat }}</option>
                    }
                  </select>
                </div>
                <div class="form-row">
                  <label>Expense date</label>
                  <input type="date" [(ngModel)]="form.expenseDate" name="expenseDate" required class="form-input" />
                </div>
                <div class="form-row">
                  <button type="submit" data-testid="submit-btn" class="submit-btn">Record Expense</button>
                </div>
                @if (submitSuccess()) {
                  <p data-testid="submit-success" class="success-msg">Expense recorded.</p>
                }
                @if (submitError()) {
                  <p data-testid="submit-error" class="error-msg">{{ submitError() }}</p>
                }
              </form>
            }

            @if (!loading() && !error()) {
              <h3 class="section-title">Expense Ledger</h3>
              <table class="fin-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Category</th>
                    <th>Description</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  @for (e of expenses(); track e.id) {
                    <tr [attr.data-testid]="'expense-row-' + e.id">
                      <td>{{ e.expenseDate }}</td>
                      <td>{{ e.category }}</td>
                      <td>{{ e.description }}</td>
                      <td>{{ formatEur(e.amountEur) }}</td>
                    </tr>
                  }
                  @if (expenses().length === 0) {
                    <tr><td colspan="4" class="empty-cell">No expenses on record.</td></tr>
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
    .harmonia-content { max-width: 900px; margin: 0 auto; padding: 24px 16px; }
    .record-form { background: white; border: 1px solid #e0e0e0; border-radius: 8px; padding: 20px; margin-bottom: 24px; }
    .form-title { margin: 0 0 16px; font-size: 1rem; font-weight: 600; }
    .form-row { display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px; }
    .form-row label { font-size: .8125rem; font-weight: 500; color: #555; }
    .form-input { padding: 7px 10px; border: 1px solid #ccc; border-radius: 4px; font-size: .875rem; }
    .submit-btn { background: #2e6b4f; color: white; border: none; padding: 8px 20px; border-radius: 6px; cursor: pointer; font-size: .9rem; }
    .submit-btn:hover { background: #245a40; }
    .success-msg { color: #2e6b4f; font-weight: 500; margin-top: 8px; }
    .error-msg { color: #c00; margin-top: 8px; }
    .section-title { margin: 0 0 8px; font-size: 1rem; font-weight: 600; color: #333; }
    .fin-table { width: 100%; border-collapse: collapse; }
    .fin-table th, .fin-table td { padding: 8px 12px; text-align: left; border-bottom: 1px solid #eee; font-size: .875rem; }
    .fin-table th { background: #f9f9f7; font-weight: 600; color: #555; }
    .empty-cell { text-align: center; color: #999; padding: 16px; }
    .center-state { display: flex; justify-content: center; padding: 48px; }
    .error-state { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 48px; color: #c00; }
  `],
})
export class ExpenseComponent implements OnInit {
  @Input() role: 'resident' | 'admin' = 'resident';

  private readonly svc = inject(ExpenseService);

  readonly expenses      = signal<ExpenseDto[]>([]);
  readonly loading       = signal(true);
  readonly error         = signal<string | null>(null);
  readonly submitSuccess = signal(false);
  readonly submitError   = signal<string | null>(null);

  readonly categories = EXPENSE_CATEGORIES;
  readonly formatEur  = formatEur;

  form = {
    amountEur: 0,
    description: '',
    category: EXPENSE_CATEGORIES[0],
    expenseDate: new Date().toISOString().slice(0, 10),
  };

  ngOnInit(): void { this.loadExpenses(); }

  loadExpenses(): void {
    this.loading.set(true);
    this.error.set(null);
    this.svc.getExpenses().subscribe({
      next: list => {
        this.expenses.set(list);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Could not load expenses. Please try again.');
        this.loading.set(false);
      },
    });
  }

  onSubmit(): void {
    this.submitSuccess.set(false);
    this.submitError.set(null);
    const body = {
      amountEur:      this.form.amountEur,
      description:    this.form.description,
      category:       this.form.category,
      expenseDate:    this.form.expenseDate,
      idempotencyKey: crypto.randomUUID(),
    };
    this.svc.recordExpense(body).subscribe({
      next: () => {
        this.submitSuccess.set(true);
        this.form = {
          amountEur: 0, description: '', category: EXPENSE_CATEGORIES[0],
          expenseDate: new Date().toISOString().slice(0, 10),
        };
        this.loadExpenses();
      },
      error: () => {
        this.submitError.set('Could not record expense. Please try again.');
      },
    });
  }
}
