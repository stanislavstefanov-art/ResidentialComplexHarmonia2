import { API_BASE, apiFetch } from './config';

export interface HouseholdDto {
  householdRef: string;
  sqMeters: number;
}

export async function getHouseholds(): Promise<HouseholdDto[]> {
  const res = await apiFetch(`${API_BASE}/households`);
  if (!res.ok) throw { status: res.status };
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
  if (!res.ok) throw { status: res.status };
}
