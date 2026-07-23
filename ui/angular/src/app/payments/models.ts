export interface PaymentDto {
  id: string;
  householdRef: string;
  amountEur: number;
  period: string;
  dateReceived: string;
  recordedAt: string;
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
