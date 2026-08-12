import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ExpenseService } from '../../expenses/expense.service';
import { AnnualReportDto, EXPENSE_CATEGORIES } from '../../expenses/models';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatEur(n: number): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n);
}

@Component({
  selector: 'app-report-tab',
  standalone: true,
  imports: [CommonModule, FormsModule, ProgressSpinnerModule, TranslatePipe],
  template: `
    <!-- ── Annual Report ── -->
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
    .xlsx-btn { background: #1d6b21; }
    .xlsx-btn:hover { background: #155218; }
    .success-msg { color: #2e6b4f; font-weight: 500; margin: 8px 0 0; font-size: .875rem; }
    .error-msg { color: #c00; margin: 8px 0 0; font-size: .875rem; }
    .period-row { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; }
    .period-label { font-weight: 500; }
    .period-input { padding: 6px 8px; border-radius: 4px; border: 1px solid #ccc; font-size: 14px; }
    .table-scroll { overflow-x: auto; }
    .fin-table { width: 100%; border-collapse: collapse; }
    .fin-table th, .fin-table td { padding: 8px 12px; text-align: left; border-bottom: 1px solid #eee; font-size: .875rem; white-space: nowrap; }
    .fin-table th { background: #f9f9f7; font-weight: 600; color: #555; }
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
  `],
})
export class ReportTabComponent implements OnInit {
  private readonly expSvc = inject(ExpenseService);
  private readonly t = inject(TranslateService);

  readonly formatEur = formatEur;

  // ── Annual report ─────────────────────────────────────────────────────────
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

  ngOnInit(): void {
    // Report is loaded on demand via the year picker button; no auto-load needed.
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
}
