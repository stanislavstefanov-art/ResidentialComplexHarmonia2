import { ChargeDto, RecordChargeRequest } from '../types';

const BASE = 'http://localhost:5000';

export async function getMyCharges(): Promise<ChargeDto[]> {
  const res = await fetch(`${BASE}/maintenance-fees/charges`);
  if (!res.ok) throw new Error(`getMyCharges failed: ${res.status}`);
  return res.json();
}

export async function getAllCharges(): Promise<ChargeDto[]> {
  const res = await fetch(`${BASE}/maintenance-fees/charges/all`);
  if (!res.ok) throw new Error(`getAllCharges failed: ${res.status}`);
  return res.json();
}

export async function recordCharge(
  householdRef: string,
  body: RecordChargeRequest,
): Promise<ChargeDto> {
  const res = await fetch(`${BASE}/maintenance-fees/charges/${encodeURIComponent(householdRef)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`recordCharge failed: ${res.status}`);
  return res.json();
}
