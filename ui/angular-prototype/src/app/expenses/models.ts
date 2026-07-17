export interface ExpenseDto {
  id: string;
  amountEur: number;
  description: string;
  category: string;
  expenseDate: string;
  recordedAt: string;
  idempotencyKey: string;
}

export interface RecordExpenseRequest {
  amountEur: number;
  description: string;
  category: string;
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
