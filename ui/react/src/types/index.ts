export interface DirectoryEntry {
  householdRef: string;
  displayName: string | null;
  role?: string;
}

export interface DirectoryListResponse {
  entries: DirectoryEntry[];
}

export interface DirectoryEntryAdmin {
  householdRef: string;
  displayName: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  isOptedOut: boolean;
  departedAt: string | null;
  role?: string;
}

export interface AdminDirectoryListResponse {
  entries: DirectoryEntryAdmin[];
}

export interface UpdateContactRequest {
  displayName?: string | null;
  phone?: string | null;
  email?: string | null;
  isOptedOut?: boolean | null;
}

export interface AdminUpdateContactRequest {
  displayName?: string | null;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
  isOptedOut?: boolean | null;
}

export interface MyContact {
  displayName: string;
  phone: string;
  email: string;
  isOptedOut: boolean;
}

export interface AdminContact {
  displayName: string;
  phone: string;
  email: string;
  notes: string;
  isOptedOut: boolean;
}

export type Role = 'resident' | 'admin';

export type SlotState = 'free' | 'taken-mine' | 'taken-other';

export interface Slot {
  slotKey: string;
  state: SlotState;
}

export interface DaySlotsResponse {
  day: string;
  slots: Slot[];
}

export interface ClaimResponse {
  outcome: 'confirmed-yours' | 'refused-already-taken' | 'couldnt-confirm';
}

export interface PeriodSummaryDto {
  period: string;
  totalChargesEur: number;
  totalExpensesEur: number;
}

export interface ChargeDto {
  id: string;
  householdRef: string;
  amountEur: number;
  description: string;
  period: string;
  chargedAt: string;
  idempotencyKey: string;
}

export interface PaymentDto {
  id: string;
  householdRef: string;
  amountEur: number;
  period: string;
  dateReceived: string;
  recordedAt: string;
  idempotencyKey: string;
}

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
  'Maintenance', 'Cleaning', 'Utilities', 'Insurance', 'Repairs', 'Other',
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

export interface AnnualReportDto {
  year: number;
  months: string[];
  maintenanceFees: MonthlyLineDto;
  otherIncome: MonthlyLineDto[];
  expenses: ParentCategoryLineDto[];
  periodResultByMonth: number[];
  periodResultTotal: number;
}

export interface ScannedInvoiceDto {
  amount: number | null;
  date: string | null;
  vendor: string | null;
  confidence: number;
}

export interface RecordChargeRequest {
  amountEur: number;
  description: string;
  period: string;
  idempotencyKey: string;
}

export interface RecordPaymentRequest {
  householdRef: string;
  amountEur: number;
  period: string;
  dateReceived: string;
  idempotencyKey: string;
}

export interface BalanceLineDto {
  householdRef: string;
  totalCharged: number;
  totalPaid: number;
  balance: number;
}

export interface BalanceDto {
  label: string;
  lines: BalanceLineDto[];
}

export interface NotificationRecordDto {
  id: string;
  title: string;
  sentAt: string;
  channel: string;
}

export interface AnnouncementRequest {
  title: string;
  body: string;
}

export interface PendingSignInDto {
  entraObjectId: string;
  email: string;
  displayName: string;
  firstSeenAt: string;
}

export interface PurgeExpiredResult {
  deleted: number;
}
