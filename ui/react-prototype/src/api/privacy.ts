const BASE = 'http://localhost:5000';

export async function eraseMyContact(): Promise<void> {
  const res = await fetch(`${BASE}/directory/contact`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`eraseMyContact failed: ${res.status}`);
}

export async function eraseContact(householdRef: string): Promise<'erased' | 'not-found'> {
  const res = await fetch(`${BASE}/directory/${encodeURIComponent(householdRef)}/contact`, { method: 'DELETE' });
  if (res.status === 204) return 'erased';
  if (res.status === 404) return 'not-found';
  throw new Error(`eraseContact failed: ${res.status}`);
}

export async function markDeparted(householdRef: string): Promise<'ok' | 'not-found'> {
  const res = await fetch(`${BASE}/directory/${encodeURIComponent(householdRef)}/departed`, { method: 'PUT' });
  if (res.ok) return 'ok';
  if (res.status === 404) return 'not-found';
  throw new Error(`markDeparted failed: ${res.status}`);
}

export async function purgeExpired(): Promise<{ deleted: number }> {
  const res = await fetch(`${BASE}/directory/purge-expired`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`purgeExpired failed: ${res.status}`);
  return res.json();
}
