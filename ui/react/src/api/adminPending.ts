import { API_BASE, apiFetch } from './config';
import { PendingSignInDto, PurgeExpiredResult } from '../types';

export async function listPending(): Promise<PendingSignInDto[]> {
  const res = await apiFetch(`${API_BASE}/admin/pending`);
  if (res.status === 403) throw Object.assign(new Error('forbidden'), { status: 403 });
  if (!res.ok) throw new Error(`GET /admin/pending failed: ${res.status}`);
  return res.json();
}

export async function activatePending(oid: string, householdRef: string, role: string): Promise<void> {
  const res = await apiFetch(`${API_BASE}/admin/pending/${encodeURIComponent(oid)}/activate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ householdRef, role }),
  });
  if (res.status === 403) throw Object.assign(new Error('forbidden'), { status: 403 });
  if (res.status === 404) throw Object.assign(new Error('not-found'), { status: 404 });
  if (res.status === 409) throw Object.assign(new Error('conflict'), { status: 409 });
  if (!res.ok) throw new Error(`POST activate failed: ${res.status}`);
}

export async function purgeExpired(): Promise<PurgeExpiredResult> {
  const res = await apiFetch(`${API_BASE}/admin/pending/purge-expired`, { method: 'DELETE' });
  if (res.status === 403) throw Object.assign(new Error('forbidden'), { status: 403 });
  if (!res.ok) throw new Error(`DELETE purge-expired failed: ${res.status}`);
  return res.json();
}
