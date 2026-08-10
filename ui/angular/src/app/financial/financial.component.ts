import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { LanguageSwitcherComponent } from '../language-switcher/language-switcher.component';
import { UserMenuComponent } from '../user-menu/user-menu.component';
import { PendingBadgeComponent } from '../pending-badge/pending-badge.component';
import { FinancialService } from './financial.service';
import { MaintenanceFeeService } from '../maintenance-fees/maintenance-fee.service';
import { ExpenseService } from '../expenses/expense.service';
import { PaymentService } from '../payments/payment.service';
import { ChargeDto, PaymentDto, PeriodSummaryDto } from './models';
import { ExpenseDto, EXPENSE_CATEGORIES, PARENT_CATEGORIES, AnnualReportDto, RecordIncomeRequest, ScannedInvoiceDto } from '../expenses/models';
import { BalanceDto } from '../payments/models';
import { RoleService } from '../role.service';

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
  selector: 'app-financial',
  standalone: true,
  imports: [
    CommonModule, RouterModule, FormsModule,
    CardModule, ButtonModule, ProgressSpinnerModule,
    TranslatePipe, LanguageSwitcherComponent, UserMenuComponent, PendingBadgeComponent,
  ],
  template: `
    <div class="harmonia-shell">
      <header class="harmonia-header">
        <span class="harmonia-logo">🏡 {{ 'app.brand' | translate }}</span>
        <span class="harmonia-subtitle">{{ 'app.subtitle' | translate }}</span>
        <div class="flex-spacer"></div>
        <a routerLink="/notifications" class="nav-link">{{ 'nav.notifications' | translate }}</a>
        <a routerLink="/directory" class="nav-link">{{ 'nav.directory' | translate }}</a>
        <a routerLink="/reservations" class="nav-link">{{ 'nav.reservations' | translate }}</a>
        <a routerLink="/financial" class="nav-link nav-active">{{ 'nav.finance' | translate }}</a>
        @if (isAdmin) { <a routerLink="/admin-pending" class="nav-link">{{ 'nav.adminPending' | translate }}<app-pending-badge /></a> }
        <a routerLink="/privacy" class="nav-link">{{ 'nav.privacy' | translate }}</a>
        @if (isAdmin) {
          <span class="role-toggle">
            <button [class.role-active]="role === 'resident'" (click)="role = 'resident'; reloadSections()" class="role-btn">{{ 'app.roleResident' | translate }}</button>
            <button [class.role-active]="role === 'admin'" (click)="role = 'admin'; reloadSections()" class="role-btn">{{ 'app.roleAdmin' | translate }}</button>
          </span>
        }
        <app-language-switcher />
        <app-user-menu />
      </header>

      <main class="harmonia-content">
        <p-card>
          <ng-template #content>

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

            <!-- ── Maintenance fees ── -->
            <div class="section-divider"><span class="section-label">{{ 'nav.fees' | translate }}</span></div>

            @if (role === 'admin') {
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
            }

            @if (feesLoading()) {
              <div class="center-state"><p-progressspinner strokeWidth="4" [style]="{width:'36px',height:'36px'}" /></div>
            } @else if (feesError()) {
              <div class="error-state"><p>{{ feesError() }}</p><button (click)="loadFees()">{{ 'common.retry' | translate }}</button></div>
            } @else {
              <div class="table-scroll">
                <table class="fin-table">
                  <thead><tr>
                    <th>{{ 'common.period' | translate }}</th>
                    @if (role === 'admin') { <th>{{ 'common.household' | translate }}</th> }
                    <th>{{ 'common.description' | translate }}</th>
                    <th>{{ 'common.amount' | translate }}</th>
                    <th>{{ 'fees.chargedAt' | translate }}</th>
                  </tr></thead>
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
                      <tr><td [attr.colspan]="role === 'admin' ? 5 : 4" class="empty-cell">{{ 'fees.none' | translate }}</td></tr>
                    }
                  </tbody>
                </table>
              </div>
            }

            <!-- ── Building expenses ── -->
            <div class="section-divider"><span class="section-label">{{ 'nav.expenses' | translate }}</span></div>

            @if (role === 'admin') {
              <form data-testid="expense-form" class="record-form" (ngSubmit)="onExpenseSubmit()">
                <h3 class="form-title">{{ 'expenses.record' | translate }}</h3>
                <div class="form-grid">
                  <div class="form-row">
                    <label>{{ 'expenses.amountEuro' | translate }}</label>
                    <input type="number" step="0.01" min="0.01" [(ngModel)]="expForm.amountEurStr" name="expAmt" required class="form-input" />
                  </div>
                  <div class="form-row">
                    <label>{{ 'common.description' | translate }}</label>
                    <input type="text" [(ngModel)]="expForm.description" name="expDesc" required class="form-input" />
                  </div>
                  <div class="form-row">
                    <label>{{ 'expenses.category' | translate }}</label>
                    <select [(ngModel)]="expForm.category" name="expCat" class="form-input">
                      @for (cat of expCategories; track cat) { <option [value]="cat">{{ cat }}</option> }
                    </select>
                  </div>
                  <div class="form-row">
                    <label>{{ 'expenses.parentCategory' | translate }}</label>
                    <select [(ngModel)]="expForm.parentCategory" name="expParent" class="form-input">
                      @for (p of parentCategories; track p) { <option [value]="p">{{ p }}</option> }
                    </select>
                  </div>
                  <div class="form-row">
                    <label>{{ 'expenses.expenseDate' | translate }}</label>
                    <input type="date" [(ngModel)]="expForm.expenseDate" name="expDate" required class="form-input" />
                  </div>
                </div>
                <button type="submit" data-testid="expense-submit-btn" class="submit-btn" [disabled]="expSaving()">{{ 'expenses.record' | translate }}</button>
                @if (expOk()) { <p data-testid="expense-submit-success" class="success-msg">{{ 'expenses.recorded' | translate }}</p> }
                @if (expErr()) { <p data-testid="expense-submit-error" class="error-msg">{{ expErr() }}</p> }
              </form>
            }

            @if (expLoading()) {
              <div class="center-state"><p-progressspinner strokeWidth="4" [style]="{width:'36px',height:'36px'}" /></div>
            } @else if (expError()) {
              <div class="error-state"><p>{{ expError() }}</p><button (click)="loadExpenses()">{{ 'common.retry' | translate }}</button></div>
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
                        <td>{{ e.category }}</td>
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

            <!-- ── Payments ── -->
            <div class="section-divider"><span class="section-label">{{ 'nav.payments' | translate }}</span></div>

            @if (balance()) {
              <div class="summary-card" style="margin-bottom:16px">
                <table class="fin-table" style="width:100%">
                  <thead><tr>
                    @if (role === 'admin') { <th>{{ 'common.household' | translate }}</th> }
                    <th>{{ 'payments.charged' | translate }}</th>
                    <th>{{ 'payments.paid' | translate }}</th>
                    <th>{{ 'payments.balance' | translate }}</th>
                  </tr></thead>
                  <tbody>
                    @for (l of balance()!.lines; track l.householdRef) {
                      <tr [attr.data-testid]="'balance-row-' + l.householdRef">
                        @if (role === 'admin') { <td>{{ l.householdRef }}</td> }
                        <td>{{ formatEur(l.totalCharged) }}</td>
                        <td>{{ formatEur(l.totalPaid) }}</td>
                        <td [class.overdue]="l.balance > 0">{{ formatEur(l.balance) }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            }

            @if (role === 'admin') {
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
                    @if (role === 'admin') { <th>{{ 'common.household' | translate }}</th> }
                    <th>{{ 'common.amount' | translate }}</th>
                    <th>{{ 'payments.dateReceived' | translate }}</th>
                  </tr></thead>
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
                      <tr><td [attr.colspan]="role === 'admin' ? 4 : 3" class="empty-cell">{{ 'payments.none' | translate }}</td></tr>
                    }
                  </tbody>
                </table>
              </div>
            }

            <!-- ── Annual Report (admin only) ── -->
            @if (role === 'admin') {
              <div class="section-divider"><span class="section-label">{{ 'annualReport.title' | translate }}</span></div>

              <!-- Record income form -->
              <form data-testid="income-form" class="record-form" (ngSubmit)="onIncomeSubmit()">
                <h3 class="form-title">{{ 'annualReport.recordIncome' | translate }}</h3>
                <div class="form-grid">
                  <div class="form-row">
                    <label>{{ 'annualReport.incomeCategory' | translate }}</label>
                    <select [(ngModel)]="incForm.category" name="incCat" class="form-input">
                      @for (cat of incCategories; track cat) { <option [value]="cat">{{ cat }}</option> }
                    </select>
                  </div>
                  <div class="form-row">
                    <label>{{ 'common.description' | translate }}</label>
                    <input type="text" [(ngModel)]="incForm.description" name="incDesc" class="form-input" />
                  </div>
                  <div class="form-row">
                    <label>{{ 'expenses.amountEuro' | translate }}</label>
                    <input type="number" step="0.01" min="0.01" [(ngModel)]="incForm.amountEurStr" name="incAmt" required class="form-input" />
                  </div>
                  <div class="form-row">
                    <label>{{ 'annualReport.incomeDate' | translate }}</label>
                    <input type="date" [(ngModel)]="incForm.incomeDate" name="incDate" required class="form-input" />
                  </div>
                </div>
                <button type="submit" data-testid="income-submit-btn" class="submit-btn" [disabled]="incSaving()">{{ 'annualReport.recordIncome' | translate }}</button>
                @if (incOk()) { <p data-testid="income-submit-success" class="success-msg">{{ 'annualReport.incomeRecorded' | translate }}</p> }
                @if (incErr()) { <p data-testid="income-submit-error" class="error-msg">{{ incErr() }}</p> }
              </form>

              <!-- Year picker + load -->
              <div class="period-row" style="margin-bottom:12px">
                <label class="period-label">{{ 'annualReport.yearLabel' | translate }}</label>
                <input type="number" [(ngModel)]="reportYear" min="2000" max="2100" class="period-input" style="width:90px" />
                <button class="submit-btn" (click)="loadAnnualReport()" [disabled]="repLoad()">{{ 'common.load' | translate }}</button>
                <button class="submit-btn xlsx-btn" (click)="downloadXlsx()" [disabled]="xlsxLoad()">{{ 'annualReport.downloadExcel' | translate }}</button>
                @if (repLoad() || xlsxLoad()) { <p-progressspinner strokeWidth="4" [style]="{width:'24px',height:'24px'}" /> }
              </div>
              @if (repErr()) { <p class="error-msg">{{ repErr() }}</p> }

              @if (report()) {
                <div class="table-scroll">
                  <table class="fin-table rep-table">
                    <thead>
                      <tr>
                        <th class="rep-label-col">{{ 'annualReport.title' | translate }}</th>
                        @for (m of report()!.months; track m) { <th class="rep-month-col">{{ m }}</th> }
                        <th class="rep-total-col">{{ 'annualReport.total' | translate }}</th>
                      </tr>
                    </thead>
                    <tbody>
                      <!-- Income section -->
                      <tr class="rep-section-row">
                        <td [attr.colspan]="report()!.months.length + 2" class="rep-section-label">{{ 'annualReport.income' | translate }}</td>
                      </tr>
                      <!-- Maintenance fees -->
                      <tr>
                        <td class="rep-label-cell">{{ 'annualReport.maintenanceFees' | translate }}</td>
                        @for (v of report()!.maintenanceFees.byMonth; track $index) {
                          <td class="rep-num-cell">{{ v !== 0 ? formatEur(v) : '' }}</td>
                        }
                        <td class="rep-num-cell rep-total-cell">{{ formatEur(report()!.maintenanceFees.total) }}</td>
                      </tr>
                      <!-- Other income rows -->
                      @for (line of report()!.otherIncome; track line.category) {
                        <tr>
                          <td class="rep-label-cell rep-indent">{{ line.category }}</td>
                          @for (v of line.byMonth; track $index) {
                            <td class="rep-num-cell">{{ v !== 0 ? formatEur(v) : '' }}</td>
                          }
                          <td class="rep-num-cell rep-total-cell">{{ formatEur(line.total) }}</td>
                        </tr>
                      }

                      <!-- Expenses section -->
                      <tr class="rep-section-row">
                        <td [attr.colspan]="report()!.months.length + 2" class="rep-section-label">{{ 'annualReport.expenses' | translate }}</td>
                      </tr>
                      @for (parent of report()!.expenses; track parent.parentCategory) {
                        @for (sub of parent.subCategories; track sub.name; let fi = $first) {
                          <tr>
                            <td class="rep-label-cell">
                              @if (fi) { <span class="rep-parent-label">{{ parent.parentCategory }} /</span> }
                              <span class="rep-indent">{{ sub.name }}</span>
                            </td>
                            @for (v of sub.byMonth; track $index) {
                              <td class="rep-num-cell">{{ v !== 0 ? formatEur(v) : '' }}</td>
                            }
                            <td class="rep-num-cell rep-total-cell">{{ formatEur(sub.total) }}</td>
                          </tr>
                        }
                      }

                      <!-- Period result -->
                      <tr class="rep-result-row">
                        <td class="rep-label-cell">{{ 'annualReport.periodResult' | translate }}</td>
                        @for (v of report()!.periodResultByMonth; track $index) {
                          <td class="rep-num-cell" [class.rep-positive]="v > 0" [class.rep-negative]="v < 0">{{ formatEur(v) }}</td>
                        }
                        <td class="rep-num-cell rep-total-cell" [class.rep-positive]="report()!.periodResultTotal > 0" [class.rep-negative]="report()!.periodResultTotal < 0">
                          {{ formatEur(report()!.periodResultTotal) }}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              }
            }

            <!-- ── Invoice Scanner (admin only) ── -->
            @if (role === 'admin') {
              <div class="section-divider"><span class="section-label">{{ 'invoiceScan.title' | translate }}</span></div>

              @if (scanStep() === 'idle') {
                <div class="record-form">
                  <label class="upload-label">{{ 'invoiceScan.uploadLabel' | translate }}</label>
                  <div class="upload-row">
                    <label class="upload-btn">
                      {{ 'invoiceScan.uploadBtn' | translate }}
                      <input type="file" accept="application/pdf,image/*" (change)="onInvoiceSelected($event)" style="display:none" />
                    </label>
                  </div>
                  @if (scanErr()) { <p class="error-msg">{{ scanErr() }}</p> }
                </div>
              }

              @if (scanStep() === 'scanning') {
                <div class="center-state">
                  <p-progressspinner strokeWidth="4" [style]="{width:'36px',height:'36px'}" />
                  <span style="margin-left:12px">{{ 'invoiceScan.scanning' | translate }}</span>
                </div>
              }

              @if (scanStep() === 'done') {
                <div class="record-form">
                  <h3 class="form-title">{{ 'invoiceScan.resultTitle' | translate }}</h3>
                  <div class="form-grid">
                    <div class="form-row">
                      <label>{{ 'invoiceScan.fieldAmount' | translate }}</label>
                      <input type="number" step="0.01" [(ngModel)]="scanForm.amountEurStr" name="scanAmt" class="form-input" />
                    </div>
                    <div class="form-row">
                      <label>{{ 'invoiceScan.fieldDate' | translate }}</label>
                      <input type="date" [(ngModel)]="scanForm.expenseDate" name="scanDate" class="form-input" />
                    </div>
                    <div class="form-row">
                      <label>{{ 'invoiceScan.fieldVendor' | translate }}</label>
                      <input type="text" [(ngModel)]="scanForm.description" name="scanDesc" class="form-input" />
                    </div>
                    <div class="form-row">
                      <label>{{ 'expenses.category' | translate }}</label>
                      <select [(ngModel)]="scanForm.category" name="scanCat" class="form-input">
                        @for (cat of expCategories; track cat) { <option [value]="cat">{{ cat }}</option> }
                      </select>
                    </div>
                    <div class="form-row">
                      <label>{{ 'expenses.parentCategory' | translate }}</label>
                      <select [(ngModel)]="scanForm.parentCategory" name="scanParent" class="form-input">
                        @for (p of parentCategories; track p) { <option [value]="p">{{ p }}</option> }
                      </select>
                    </div>
                    <div class="form-row">
                      <label>{{ 'invoiceScan.confidence' | translate }}</label>
                      <span class="form-input confidence-val">{{ (scanConfidence() * 100).toFixed(0) }}%</span>
                    </div>
                  </div>
                  <div class="scan-actions">
                    <button class="submit-btn" (click)="onScanSubmit()" [disabled]="scanExpSaving()">
                      {{ scanExpSaving() ? ('invoiceScan.saving' | translate) : ('invoiceScan.saveAsExpense' | translate) }}
                    </button>
                    <button class="reset-btn" (click)="resetScan()">{{ 'invoiceScan.reset' | translate }}</button>
                  </div>
                  @if (scanExpOk()) { <p class="success-msg">{{ 'invoiceScan.saved' | translate }}</p> }
                  @if (scanExpErr()) { <p class="error-msg">{{ scanExpErr() }}</p> }
                </div>
              }
            }

            @if (role !== 'admin') {
              <div class="pay-row">
                <button data-testid="pay-btn" class="pay-btn" (click)="showPayDialog = true">{{ 'finance.requestPayment' | translate }}</button>
              </div>
            }

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
      overflow-x: auto; scrollbar-width: none;
    }
    .harmonia-header::-webkit-scrollbar { display: none; }
    .harmonia-logo { font-size: 1.25rem; font-weight: 700; white-space: nowrap; }
    .harmonia-subtitle { opacity: .7; font-size: .875rem; white-space: nowrap; }
    .flex-spacer { flex: 1; }
    .nav-link { color: rgba(255,255,255,.75); text-decoration: none; padding: 6px 12px; border-radius: 6px; font-size: .875rem; white-space: nowrap; }
    .nav-link:hover { background: rgba(255,255,255,.1); }
    .nav-active { background: rgba(255,255,255,.18); color: white; font-weight: 600; }
    .role-toggle { display: flex; border-radius: 6px; overflow: hidden; border: 1px solid rgba(255,255,255,.3); margin-left: 8px; flex-shrink: 0; }
    .role-btn { background: transparent; color: rgba(255,255,255,.75); border: none; padding: 4px 12px; cursor: pointer; font-size: .8125rem; white-space: nowrap; }
    .role-btn.role-active { background: rgba(255,255,255,.22); color: white; font-weight: 600; }
    .harmonia-content { max-width: 960px; margin: 0 auto; padding: 24px 16px; }
    .period-row { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; }
    .period-label { font-weight: 500; }
    .period-input { padding: 6px 8px; border-radius: 4px; border: 1px solid #ccc; font-size: 14px; }
    .summary-card { display: flex; gap: 32px; margin-bottom: 16px; padding: 16px; background: white; border-radius: 8px; border: 1px solid #e0e0e0; flex-wrap: wrap; }
    .summary-item { display: flex; flex-direction: column; gap: 4px; }
    .summary-label { font-size: .8125rem; color: #666; }
    .summary-value { font-size: 1.25rem; font-weight: 700; color: #2e6b4f; }
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
    .xlsx-btn { background: #1d6b21; }
    .xlsx-btn:hover { background: #155218; }
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
    .pay-row { margin-top: 16px; }
    .pay-btn { background: #2e6b4f; color: white; border: none; padding: 8px 20px; border-radius: 6px; font-size: .9rem; cursor: pointer; }
    .pay-btn:hover { background: #245a40; }
    .dialog-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,.4); display: flex; align-items: center; justify-content: center; z-index: 1000; }
    .dialog-box { background: white; border-radius: 8px; padding: 24px; max-width: 360px; width: 90%; box-shadow: 0 8px 32px rgba(0,0,0,.2); }
    .dialog-title { margin: 0 0 12px; font-size: 1.1rem; font-weight: 600; }
    .dialog-close-btn { margin-top: 16px; background: #2e6b4f; color: white; border: none; padding: 6px 16px; border-radius: 4px; cursor: pointer; }
    .rep-table { font-size: .8125rem; }
    .rep-label-col { min-width: 180px; }
    .rep-month-col { min-width: 72px; text-align: right; }
    .rep-total-col { min-width: 80px; text-align: right; }
    .rep-label-cell { font-size: .8125rem; }
    .rep-num-cell { text-align: right; font-variant-numeric: tabular-nums; }
    .rep-total-cell { font-weight: 600; }
    .rep-section-row td { background: #f0f4f1; font-weight: 700; font-size: .75rem; text-transform: uppercase; letter-spacing: .05em; color: #555; padding: 6px 12px; }
    .rep-section-label { }
    .rep-indent { padding-left: 12px; }
    .rep-parent-label { color: #888; font-size: .75rem; margin-right: 4px; }
    .rep-result-row td { background: #e8f0ec; font-weight: 700; border-top: 2px solid #2e6b4f; }
    .rep-positive { color: #2e6b4f; }
    .rep-negative { color: #c00; }
    .upload-label { font-size: .875rem; font-weight: 500; color: #555; display: block; margin-bottom: 8px; }
    .upload-row { margin-bottom: 8px; }
    .upload-btn { display: inline-block; background: #2e6b4f; color: white; padding: 7px 18px; border-radius: 6px; cursor: pointer; font-size: .875rem; }
    .upload-btn:hover { background: #245a40; }
    .confidence-val { background: none; border: none; padding-left: 0; font-size: .875rem; color: #555; }
    .scan-actions { display: flex; gap: 12px; align-items: center; margin-top: 4px; }
    .reset-btn { background: transparent; border: 1px solid #ccc; color: #555; padding: 7px 16px; border-radius: 6px; cursor: pointer; font-size: .875rem; }
    .reset-btn:hover { background: #f5f5f0; }
  `],
})
export class FinancialComponent implements OnInit {
  private readonly finSvc  = inject(FinancialService);
  private readonly feeSvc  = inject(MaintenanceFeeService);
  private readonly expSvc  = inject(ExpenseService);
  private readonly paySvc  = inject(PaymentService);
  private readonly t       = inject(TranslateService);
  readonly isAdmin = inject(RoleService).isAdmin;

  role: 'resident' | 'admin' = inject(RoleService).isAdmin ? 'admin' : 'resident';

  // ── Period summary ──────────────────────────────────────────────────────────
  period = currentMonth();
  readonly summary    = signal<PeriodSummaryDto | null>(null);
  readonly sumLoading = signal(true);
  readonly sumError   = signal<string | null>(null);

  // ── Maintenance fees ────────────────────────────────────────────────────────
  readonly charges     = signal<ChargeDto[]>([]);
  readonly feesLoading = signal(true);
  readonly feesError   = signal<string | null>(null);
  readonly feeSaving   = signal(false);
  readonly feeOk       = signal(false);
  readonly feeErr      = signal<string | null>(null);
  feeForm = { householdRef: '', amountEurStr: '', description: '', period: currentMonth() };

  // ── Building expenses ───────────────────────────────────────────────────────
  readonly expenses    = signal<ExpenseDto[]>([]);
  readonly expLoading  = signal(true);
  readonly expError    = signal<string | null>(null);
  readonly expSaving   = signal(false);
  readonly expOk       = signal(false);
  readonly expErr      = signal<string | null>(null);
  readonly expCategories = EXPENSE_CATEGORIES;
  readonly parentCategories = PARENT_CATEGORIES;
  expForm = { amountEurStr: '', description: '', category: EXPENSE_CATEGORIES[0], parentCategory: PARENT_CATEGORIES[3], expenseDate: today() };

  // ── Annual report ───────────────────────────────────────────────────────────
  reportYear = new Date().getFullYear();
  readonly report    = signal<AnnualReportDto | null>(null);
  readonly repLoad   = signal(false);
  readonly repErr    = signal<string | null>(null);
  readonly xlsxLoad  = signal(false);
  readonly incSaving = signal(false);
  readonly incOk     = signal(false);
  readonly incErr    = signal<string | null>(null);
  readonly incCategories = EXPENSE_CATEGORIES;
  incForm = { category: EXPENSE_CATEGORIES[0], description: '', amountEurStr: '', incomeDate: today() };

  // ── Payments ────────────────────────────────────────────────────────────────
  readonly payments    = signal<PaymentDto[]>([]);
  readonly balance     = signal<BalanceDto | null>(null);
  readonly payLoading  = signal(true);
  readonly payError    = signal<string | null>(null);
  readonly paySaving   = signal(false);
  readonly payOk       = signal(false);
  readonly payErr      = signal<string | null>(null);
  payForm = { householdRef: '', amountEurStr: '', period: currentMonth(), dateReceived: today() };

  // ── Invoice scan ────────────────────────────────────────────────────────────
  readonly scanStep       = signal<'idle' | 'scanning' | 'done'>('idle');
  readonly scanErr        = signal<string | null>(null);
  readonly scanExpSaving  = signal(false);
  readonly scanExpOk      = signal(false);
  readonly scanExpErr     = signal<string | null>(null);
  readonly scanConfidence = signal(0);
  scanForm = { amountEurStr: '', expenseDate: today(), description: '', category: EXPENSE_CATEGORIES[0], parentCategory: PARENT_CATEGORIES[3] };

  showPayDialog = false;
  readonly formatEur = formatEur;

  ngOnInit(): void {
    this.loadSummary();
    this.loadFees();
    this.loadExpenses();
    this.loadPayments();
    this.loadBalance();
  }

  reloadSections(): void {
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
    const obs = this.role === 'admin' ? this.feeSvc.getAllCharges() : this.feeSvc.getMyCharges();
    obs.subscribe({
      next: list => { this.charges.set(list); this.feesLoading.set(false); },
      error: () => { this.feesError.set(this.t.instant('fees.errLoad')); this.feesLoading.set(false); },
    });
  }

  loadExpenses(): void {
    this.expLoading.set(true); this.expError.set(null);
    this.expSvc.getExpenses().subscribe({
      next: list => { this.expenses.set(list); this.expLoading.set(false); },
      error: () => { this.expError.set(this.t.instant('expenses.errLoad')); this.expLoading.set(false); },
    });
  }

  loadPayments(): void {
    this.payLoading.set(true); this.payError.set(null);
    const obs = this.role === 'admin' ? this.paySvc.getAllPayments() : this.paySvc.getMyPayments();
    obs.subscribe({
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

  onExpenseSubmit(): void {
    this.expOk.set(false); this.expErr.set(null);
    const parsed = parseFloat(this.expForm.amountEurStr);
    if (!this.expForm.amountEurStr || isNaN(parsed) || parsed <= 0) {
      this.expErr.set(this.t.instant('expenses.errAmount')); return;
    }
    this.expSaving.set(true);
    this.expSvc.recordExpense({
      amountEur: parsed, description: this.expForm.description,
      category: this.expForm.category, parentCategory: this.expForm.parentCategory,
      expenseDate: this.expForm.expenseDate, idempotencyKey: crypto.randomUUID(),
    }).subscribe({
      next: () => {
        this.expOk.set(true);
        this.expForm = { amountEurStr: '', description: '', category: EXPENSE_CATEGORIES[0], parentCategory: PARENT_CATEGORIES[3], expenseDate: today() };
        this.expSaving.set(false);
        this.loadExpenses();
      },
      error: () => { this.expErr.set(this.t.instant('expenses.errRecord')); this.expSaving.set(false); },
    });
  }

  loadAnnualReport(): void {
    this.repLoad.set(true); this.repErr.set(null);
    this.expSvc.getAnnualReport(this.reportYear).subscribe({
      next: r => { this.report.set(r); this.repLoad.set(false); },
      error: () => { this.repErr.set(this.t.instant('annualReport.errLoad')); this.repLoad.set(false); },
    });
  }

  downloadXlsx(): void {
    this.xlsxLoad.set(true);
    this.expSvc.downloadAnnualReportXlsx(this.reportYear).subscribe({
      next: blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `annual-report-${this.reportYear}.xlsx`;
        a.click(); URL.revokeObjectURL(url);
        this.xlsxLoad.set(false);
      },
      error: () => { this.repErr.set(this.t.instant('annualReport.errLoad')); this.xlsxLoad.set(false); },
    });
  }

  onIncomeSubmit(): void {
    this.incOk.set(false); this.incErr.set(null);
    const parsed = parseFloat(this.incForm.amountEurStr);
    if (!this.incForm.amountEurStr || isNaN(parsed) || parsed <= 0) {
      this.incErr.set(this.t.instant('annualReport.errAmount')); return;
    }
    this.incSaving.set(true);
    this.expSvc.recordIncome({
      category: this.incForm.category, description: this.incForm.description,
      amountEur: parsed, incomeDate: this.incForm.incomeDate, idempotencyKey: crypto.randomUUID(),
    }).subscribe({
      next: () => {
        this.incOk.set(true);
        this.incForm = { category: EXPENSE_CATEGORIES[0], description: '', amountEurStr: '', incomeDate: today() };
        this.incSaving.set(false);
      },
      error: () => { this.incErr.set(this.t.instant('annualReport.errRecord')); this.incSaving.set(false); },
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

  onInvoiceSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) { this.scanErr.set(this.t.instant('invoiceScan.errEmpty')); return; }
    this.scanErr.set(null);
    this.scanStep.set('scanning');
    this.expSvc.scanInvoice(file).subscribe({
      next: (dto: ScannedInvoiceDto) => {
        this.scanForm = {
          amountEurStr: dto.amount != null ? String(dto.amount) : '',
          expenseDate: dto.date ?? today(),
          description: dto.vendor ?? '',
          category: EXPENSE_CATEGORIES[0],
          parentCategory: PARENT_CATEGORIES[3],
        };
        this.scanConfidence.set(dto.confidence);
        this.scanStep.set('done');
      },
      error: () => { this.scanErr.set(this.t.instant('invoiceScan.errScan')); this.scanStep.set('idle'); },
    });
  }

  resetScan(): void {
    this.scanStep.set('idle');
    this.scanErr.set(null);
    this.scanExpOk.set(false);
    this.scanExpErr.set(null);
    this.scanForm = { amountEurStr: '', expenseDate: today(), description: '', category: EXPENSE_CATEGORIES[0], parentCategory: PARENT_CATEGORIES[3] };
  }

  onScanSubmit(): void {
    this.scanExpOk.set(false); this.scanExpErr.set(null);
    const parsed = parseFloat(this.scanForm.amountEurStr);
    if (isNaN(parsed) || parsed <= 0) { this.scanExpErr.set(this.t.instant('expenses.errAmount')); return; }
    this.scanExpSaving.set(true);
    this.expSvc.recordExpense({
      amountEur: parsed, description: this.scanForm.description,
      category: this.scanForm.category, parentCategory: this.scanForm.parentCategory,
      expenseDate: this.scanForm.expenseDate, idempotencyKey: crypto.randomUUID(),
    }).subscribe({
      next: () => {
        this.scanExpOk.set(true);
        this.scanExpSaving.set(false);
        this.loadExpenses();
      },
      error: () => { this.scanExpErr.set(this.t.instant('invoiceScan.errSave')); this.scanExpSaving.set(false); },
    });
  }
}
