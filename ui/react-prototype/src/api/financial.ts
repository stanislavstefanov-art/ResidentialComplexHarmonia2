import { API_BASE } from './config';
import { ChargeDto, PaymentDto, PeriodSummaryDto } from '../types';

const BASE = API_BASE;

export async function getPeriodSummary(period: string): Promise<PeriodSummaryDto> {
  const res = await fetch(`${BASE}/financial-summary?period=${period}`);
  if (!res.ok) throw new Error(`getPeriodSummary failed: ${res.status}`);
  return res.json();
}

export async function getMyCharges(): Promise<ChargeDto[]> {
  const res = await fetch(`${BASE}/maintenance-fees/charges`);
  if (!res.ok) throw new Error(`getMyCharges failed: ${res.status}`);
  return res.json();
}

export async function getMyPayments(): Promise<PaymentDto[]> {
  const res = await fetch(`${BASE}/payments`);
  if (!res.ok) throw new Error(`getMyPayments failed: ${res.status}`);
  return res.json();
}
