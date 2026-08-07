import { API_BASE, apiFetch } from './config';

const BASE = API_BASE;

export interface MyContactDto {
  displayName: string | null;
  phone: string | null;
  email: string | null;
  isOptedOut: boolean;
}

export async function getMyContact(): Promise<MyContactDto | null> {
  const res = await apiFetch(`${BASE}/directory/contact`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`getMyContact failed: ${res.status}`);
  return res.json();
}

export interface UpdateContactRequest {
  displayName?: string | null;
  phone?: string | null;
  email?: string | null;
  optedOut?: boolean | null;
}

export async function updateMyContact(body: UpdateContactRequest): Promise<void> {
  const res = await apiFetch(`${BASE}/directory/contact`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`updateMyContact failed: ${res.status}`);
}

export async function updateContact(householdRef: string, body: UpdateContactRequest): Promise<void> {
  const res = await apiFetch(`${BASE}/directory/${encodeURIComponent(householdRef)}/contact`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`updateContact failed: ${res.status}`);
}

export async function updateNotes(householdRef: string, notes: string | null): Promise<void> {
  const res = await apiFetch(`${BASE}/directory/${encodeURIComponent(householdRef)}/notes`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ notes }),
  });
  if (!res.ok) throw new Error(`updateNotes failed: ${res.status}`);
}
