import {
  AdminDirectoryListResponse,
  AdminUpdateContactRequest,
  DirectoryEntry,
  DirectoryEntryAdmin,
  DirectoryListResponse,
  UpdateContactRequest,
} from '../types';
import { API_BASE, apiFetch } from './config';

const API = API_BASE;

export async function getDirectory(): Promise<DirectoryEntry[]> {
  const res = await apiFetch(`${API}/directory`);
  if (!res.ok) throw new Error(`GET /directory failed: ${res.status}`);
  const body: DirectoryListResponse = await res.json();
  return body.entries ?? [];
}

export async function getAdminDirectory(): Promise<DirectoryEntryAdmin[]> {
  const res = await apiFetch(`${API}/directory/admin`);
  if (!res.ok) throw new Error(`GET /directory/admin failed: ${res.status}`);
  const body: AdminDirectoryListResponse = await res.json();
  return body.entries ?? [];
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
