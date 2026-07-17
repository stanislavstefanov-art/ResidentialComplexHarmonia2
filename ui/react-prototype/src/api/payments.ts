import { PaymentDto, RecordPaymentRequest, BalanceDto } from '../types';

const BASE = 'http://localhost:5000';

export async function getMyPayments(): Promise<PaymentDto[]> {
  const res = await fetch(`${BASE}/payments`);
  if (!res.ok) throw new Error(`getMyPayments failed: ${res.status}`);
  return res.json();
}

export async function getAllPayments(): Promise<PaymentDto[]> {
  const res = await fetch(`${BASE}/payments/all`);
  if (!res.ok) throw new Error(`getAllPayments failed: ${res.status}`);
  return res.json();
}

export async function recordPayment(body: RecordPaymentRequest): Promise<PaymentDto> {
  const res = await fetch(`${BASE}/payments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`recordPayment failed: ${res.status}`);
  return res.json();
}

export async function getBalance(period?: string): Promise<BalanceDto> {
  const url = period ? `${BASE}/balance?period=${encodeURIComponent(period)}` : `${BASE}/balance`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`getBalance failed: ${res.status}`);
  return res.json();
}
