export interface ChargeDto {
  id: string;
  householdRef: string;
  amountEur: number;
  description: string;
  period: string;
  chargedAt: string;
  idempotencyKey: string;
}

export interface RecordChargeRequest {
  amountEur: number;
  description: string;
  period: string;
  idempotencyKey: string;
}
