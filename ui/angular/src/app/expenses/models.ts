export interface ExpenseDto {
  id: string;
  amountEur: number;
  description: string;
  counterpartyId: string;
  expenseDate: string;
  recordedAt: string;
  idempotencyKey: string;
}

export interface ExpenseListItemDto {
  id: string;
  amountEur: number;
  description: string;
  counterpartyId: string;
  counterpartyName: string;
  counterpartyCategory: string;
  counterpartyParentCategory: string;
  expenseDate: string;
  recordedAt: string;
  idempotencyKey: string;
}

export interface RecordExpenseRequest {
  amountEur: number;
  description: string;
  counterpartyId: string;
  expenseDate: string;
  idempotencyKey: string;
}

export interface RecordIncomeRequest {
  category: string;
  description: string;
  amountEur: number;
  incomeDate: string;
  idempotencyKey: string;
}

export interface MonthlyLineDto {
  category: string;
  byMonth: number[];
  total: number;
}

export interface SubCategoryLineDto {
  name: string;
  byMonth: number[];
  total: number;
}

export interface ParentCategoryLineDto {
  parentCategory: string;
  subCategories: SubCategoryLineDto[];
}

export interface ScannedInvoiceDto {
  amount: number | null;
  date: string | null;
  vendor: string | null;
  confidence: number;
}

export interface AnnualReportDto {
  year: number;
  months: string[];
  maintenanceFees: MonthlyLineDto;
  otherIncome: MonthlyLineDto[];
  expenses: ParentCategoryLineDto[];
  periodResultByMonth: number[];
  periodResultTotal: number;
}
