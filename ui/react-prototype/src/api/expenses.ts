import { ExpenseDto, RecordExpenseRequest } from '../types';

const BASE = 'http://localhost:5000';

export async function getExpenses(): Promise<ExpenseDto[]> {
  const res = await fetch(`${BASE}/expenses`);
  if (!res.ok) throw new Error(`getExpenses failed: ${res.status}`);
  return res.json();
}

export async function recordExpense(body: RecordExpenseRequest): Promise<ExpenseDto> {
  const res = await fetch(`${BASE}/expenses`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`recordExpense failed: ${res.status}`);
  return res.json();
}
