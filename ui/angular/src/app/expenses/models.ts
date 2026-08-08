export interface ExpenseDto {
  id: string;
  amountEur: number;
  description: string;
  category: string;
  parentCategory: string | null;
  expenseDate: string;
  recordedAt: string;
  idempotencyKey: string;
}

export interface RecordExpenseRequest {
  amountEur: number;
  description: string;
  category: string;
  parentCategory: string | null;
  expenseDate: string;
  idempotencyKey: string;
}

export const EXPENSE_CATEGORIES = [
  'Maintenance',
  'Cleaning',
  'Utilities',
  'Insurance',
  'Repairs',
  'Other',
] as const;

export const PARENT_CATEGORIES = [
  'Materials', 'External Services', 'Personnel', 'Other',
] as const;

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
