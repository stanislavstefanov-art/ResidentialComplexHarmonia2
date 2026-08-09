import { API_BASE, apiFetch } from './config';

const BASE = API_BASE;

export async function eraseMyContact(): Promise<void> {
  const res = await apiFetch(`${BASE}/directory/contact`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`eraseMyContact failed: ${res.status}`);
}

export async function eraseContact(householdRef: string): Promise<'erased' | 'not-found'> {
  // householdRef goes in the query string, not the path: multi-apartment refs contain
  // '/' which ASP.NET Core leaves undecoded (%2F) in a path segment and never matches.
  const res = await apiFetch(
    `${BASE}/directory/board/contact?householdRef=${encodeURIComponent(householdRef)}`,
    { method: 'DELETE' },
  );
  if (res.status === 204) return 'erased';
  if (res.status === 404) return 'not-found';
  throw new Error(`eraseContact failed: ${res.status}`);
}

export async function markDeparted(householdRef: string): Promise<'ok' | 'not-found'> {
  const res = await apiFetch(
    `${BASE}/directory/board/departed?householdRef=${encodeURIComponent(householdRef)}`,
    { method: 'DELETE' },
  );
  if (res.ok) return 'ok';
  if (res.status === 404) return 'not-found';
  throw new Error(`markDeparted failed: ${res.status}`);
}

export async function removeResident(householdRef: string, role: string): Promise<void> {
  const res = await apiFetch(
    `${BASE}/directory/board/resident?householdRef=${encodeURIComponent(householdRef)}&role=${encodeURIComponent(role)}`,
    { method: 'DELETE' },
  );
  if (res.status === 204 || res.status === 404) return;
  throw new Error(`removeResident failed: ${res.status}`);
}

export async function purgeExpired(): Promise<{ deleted: number }> {
  const res = await apiFetch(`${BASE}/directory/purge-expired`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`purgeExpired failed: ${res.status}`);
  return res.json();
}
