import { DirectoryEntry, DirectoryListResponse, UpdateContactRequest } from '../types';

const API = 'http://localhost:5000';

export async function getDirectory(): Promise<DirectoryEntry[]> {
  const res = await fetch(`${API}/directory`);
  if (!res.ok) throw new Error(`GET /directory failed: ${res.status}`);
  const body: DirectoryListResponse = await res.json();
  return body.entries ?? [];
}

export async function updateMyContact(req: UpdateContactRequest): Promise<void> {
  const res = await fetch(`${API}/directory/contact`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  if (!res.ok) throw new Error(`PUT /directory/contact failed: ${res.status}`);
}
