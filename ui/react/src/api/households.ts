import { API_BASE, apiFetch } from './config';

export interface HouseholdDto {
  householdRef: string;
  sqMeters: number;
}

export async function getHouseholds(): Promise<HouseholdDto[]> {
  const res = await apiFetch(`${API_BASE}/households`);
  if (!res.ok) throw Object.assign(new Error(`GET /households failed: ${res.status}`), { status: res.status });
  return res.json();
}

export async function upsertHousehold(householdRef: string, sqMeters: number): Promise<void> {
  const res = await apiFetch(
    `${API_BASE}/households/${encodeURIComponent(householdRef)}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sqMeters }),
    },
  );
  if (!res.ok) throw Object.assign(new Error(`PUT /households failed: ${res.status}`), { status: res.status });
}

export async function deleteHousehold(householdRef: string): Promise<void> {
  const res = await apiFetch(
    `${API_BASE}/households/item?householdRef=${encodeURIComponent(householdRef)}`,
    { method: 'DELETE' },
  );
  if (res.status === 204) return;
  throw Object.assign(new Error(`DELETE /households/item failed: ${res.status}`), { status: res.status });
}
