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
