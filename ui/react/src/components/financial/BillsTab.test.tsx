import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { createTheme, ThemeProvider } from '@mui/material';
import BillsTab from './BillsTab';
import * as expApi from '../../api/expenses';

jest.mock('../../api/expenses');
const mockGetExpenses  = expApi.getExpenses as jest.Mock;
const mockRecordExpense = expApi.recordExpense as jest.Mock;
const mockScanInvoice   = expApi.scanInvoice as jest.Mock;

const theme = createTheme();
const renderTab = () =>
  render(<ThemeProvider theme={theme}><BillsTab /></ThemeProvider>);

beforeEach(() => {
  jest.clearAllMocks();
  mockGetExpenses.mockResolvedValue([]);
  mockRecordExpense.mockResolvedValue({});
});

test('renders the Add-a-bill form and expenses table', async () => {
  renderTab();
  await waitFor(() => screen.getByTestId('bill-form'));
  expect(screen.getByTestId('bill-scan-input')).toBeInTheDocument();
});

test('manual entry records an expense', async () => {
  renderTab();
  await waitFor(() => screen.getByTestId('bill-form'));
  fireEvent.change(screen.getByTestId('bill-amount'), { target: { value: '42.50' } });
  fireEvent.change(screen.getByTestId('bill-desc'),   { target: { value: 'Cleaning' } });
  fireEvent.submit(screen.getByTestId('bill-form'));
  await waitFor(() => expect(mockRecordExpense).toHaveBeenCalledTimes(1));
  expect(mockRecordExpense.mock.calls[0][0]).toMatchObject({ amountEur: 42.5, description: 'Cleaning' });
});

test('scanning an invoice prefills the same form and shows confidence', async () => {
  mockScanInvoice.mockResolvedValue({ amount: 99.9, date: '2026-08-01', vendor: 'ACME', confidence: 0.9 });
  renderTab();
  await waitFor(() => screen.getByTestId('bill-scan-input'));
  const file = new File(['x'], 'invoice.pdf', { type: 'application/pdf' });
  fireEvent.change(screen.getByTestId('bill-scan-input'), { target: { files: [file] } });
  await waitFor(() => expect((screen.getByTestId('bill-amount') as HTMLInputElement).value).toBe('99.9'));
  expect((screen.getByTestId('bill-desc') as HTMLInputElement).value).toBe('ACME');
  expect(screen.getByTestId('bill-confidence').textContent).toContain('90%');
});
