import { API_BASE, apiFetch } from './config';
import { ExpenseDto, ExpenseListItemDto, RecordExpenseRequest, RecordIncomeRequest, AnnualReportDto, ScannedInvoiceDto } from '../types';

const BASE = API_BASE;

export async function getExpenses(): Promise<ExpenseListItemDto[]> {
  const res = await apiFetch(`${BASE}/expenses`);
  if (!res.ok) throw new Error(`getExpenses failed: ${res.status}`);
  return res.json();
}

export async function recordExpense(body: RecordExpenseRequest): Promise<ExpenseDto> {
  const res = await apiFetch(`${BASE}/expenses`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`recordExpense failed: ${res.status}`);
  return res.json();
}

export async function recordIncome(body: RecordIncomeRequest): Promise<void> {
  const res = await apiFetch(`${BASE}/financial/income`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`recordIncome failed: ${res.status}`);
}

export async function getAnnualReport(year: number): Promise<AnnualReportDto> {
  const res = await apiFetch(`${BASE}/financial/annual-report?year=${year}`);
  if (!res.ok) throw new Error(`getAnnualReport failed: ${res.status}`);
  return res.json();
}

export async function scanInvoice(file: File): Promise<ScannedInvoiceDto> {
  const fd = new FormData();
  fd.append('file', file);
  const res = await apiFetch(`${BASE}/financial/invoices/scan`, { method: 'POST', body: fd });
  if (!res.ok) throw new Error(`scanInvoice failed: ${res.status}`);
  return res.json();
}

export async function downloadAnnualReportXlsx(year: number): Promise<void> {
  const res = await apiFetch(`${BASE}/financial/annual-report?year=${year}&format=xlsx`);
  if (!res.ok) throw new Error(`downloadAnnualReport failed: ${res.status}`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `annual-report-${year}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
