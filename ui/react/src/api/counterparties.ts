import { API_BASE, apiFetch } from './config';

export interface CounterpartyDto {
  id: string;
  name: string;
  category: string;
  parentCategory: string;
  vatNumber: string | null;
  phone: string | null;
  email: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CounterpartyInput {
  name: string;
  category: string;
  parentCategory: string;
  vatNumber: string | null;
  phone: string | null;
  email: string | null;
}

export async function getCounterparties(): Promise<CounterpartyDto[]> {
  const res = await apiFetch(`${API_BASE}/counterparties`);
  if (!res.ok) throw Object.assign(new Error(`GET /counterparties failed: ${res.status}`), { status: res.status });
  return res.json();
}

export async function createCounterparty(input: CounterpartyInput): Promise<CounterpartyDto> {
  const res = await apiFetch(`${API_BASE}/counterparties`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw Object.assign(new Error(`POST /counterparties failed: ${res.status}`), { status: res.status });
  return res.json();
}

export async function updateCounterparty(id: string, input: CounterpartyInput): Promise<CounterpartyDto> {
  const res = await apiFetch(`${API_BASE}/counterparties/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw Object.assign(new Error(`PUT /counterparties/${id} failed: ${res.status}`), { status: res.status });
  return res.json();
}

export async function deleteCounterparty(id: string): Promise<void> {
  const res = await apiFetch(`${API_BASE}/counterparties/${id}`, { method: 'DELETE' });
  if (res.status === 204) return;
  throw Object.assign(new Error(`DELETE /counterparties/${id} failed: ${res.status}`), { status: res.status });
}
