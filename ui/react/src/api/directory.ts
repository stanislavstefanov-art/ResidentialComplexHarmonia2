import {
  AdminUpdateContactRequest,
  DirectoryEntry,
  DirectoryEntryAdmin,
  UpdateContactRequest,
} from '../types';
import { API_BASE, apiFetch } from './config';

const API = API_BASE;

// The API returns a bare JSON array (e.g. `[ {...}, {...} ]`). Guard with
// Array.isArray: if `body` is an array, `body.entries` would resolve to
// `Array.prototype.entries` (a function), which must never reach setState.
// A wrapped `{ entries: [...] }` shape is tolerated for forward-compatibility.
function unwrapEntries<T>(body: unknown): T[] {
  if (Array.isArray(body)) return body as T[];
  const entries = (body as { entries?: T[] } | null)?.entries;
  return Array.isArray(entries) ? entries : [];
}

export async function getDirectory(): Promise<DirectoryEntry[]> {
  const res = await apiFetch(`${API}/directory`);
  if (!res.ok) throw new Error(`GET /directory failed: ${res.status}`);
  return unwrapEntries<DirectoryEntry>(await res.json());
}

export async function getAdminDirectory(): Promise<DirectoryEntryAdmin[]> {
  const res = await apiFetch(`${API}/directory/admin`);
  if (!res.ok) throw new Error(`GET /directory/admin failed: ${res.status}`);
  return unwrapEntries<DirectoryEntryAdmin>(await res.json());
}

export async function updateMyContact(req: UpdateContactRequest): Promise<void> {
  const res = await apiFetch(`${API}/directory/contact`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  if (!res.ok) throw new Error(`PUT /directory/contact failed: ${res.status}`);
}

export async function adminUpdateContact(
  householdRef: string,
  req: AdminUpdateContactRequest,
): Promise<void> {
  const res = await apiFetch(`${API}/directory/${householdRef}/contact`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  if (!res.ok) throw new Error(`PUT /directory/${householdRef}/contact failed: ${res.status}`);
}

export async function markDeparted(householdRef: string): Promise<void> {
  const res = await apiFetch(`${API}/directory/${householdRef}/departed`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error(`DELETE /directory/${householdRef}/departed failed: ${res.status}`);
}
