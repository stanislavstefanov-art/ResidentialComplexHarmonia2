import { API_BASE, apiFetch } from './config';

export interface MeStatusDto {
  status: string;
}

export async function getMyStatus(): Promise<MeStatusDto> {
  const res = await apiFetch(`${API_BASE}/me`);
  if (!res.ok) throw Object.assign(new Error(`GET /me failed: ${res.status}`), { status: res.status });
  return res.json();
}
