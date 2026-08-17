import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createTheme, ThemeProvider } from '@mui/material';
import OutcomeTab from './OutcomeTab';
import * as expApi from '../../api/expenses';
import * as cpApi from '../../api/counterparties';

jest.mock('../../api/expenses');
jest.mock('../../api/counterparties');
const mockGetExpenses      = expApi.getExpenses as jest.Mock;
const mockRecordExpense    = expApi.recordExpense as jest.Mock;
const mockScanInvoice      = expApi.scanInvoice as jest.Mock;
const mockGetCounterparties = cpApi.getCounterparties as jest.Mock;

const counterparty = {
  id: 'cp-1',
  name: 'Acme Cleaning',
  category: 'Cleaning',
  parentCategory: 'Maintenance',
  vatNumber: null,
  phone: null,
  email: null,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

const theme = createTheme();
const renderTab = () =>
  render(<ThemeProvider theme={theme}><OutcomeTab /></ThemeProvider>);

beforeEach(() => {
  jest.clearAllMocks();
  mockGetExpenses.mockResolvedValue([]);
  mockRecordExpense.mockResolvedValue({});
  mockGetCounterparties.mockResolvedValue([counterparty]);
});

test('renders the Add-a-bill form and expenses table', async () => {
  renderTab();
  await waitFor(() => screen.getByTestId('bill-form'));
  expect(screen.getByTestId('bill-scan-input')).toBeInTheDocument();
});

test('submit is disabled until a counterparty is picked, then manual entry records an expense', async () => {
  renderTab();
  await waitFor(() => screen.getByTestId('bill-form'));

  fireEvent.change(screen.getByTestId('bill-amount'), { target: { value: '42.50' } });
  fireEvent.change(screen.getByTestId('bill-desc'),   { target: { value: 'Cleaning' } });

  // No counterparty selected yet -> submit disabled.
  expect(screen.getByTestId('bill-submit')).toBeDisabled();

  const combobox = await screen.findByRole('combobox', { name: /counterparty/i });
  await userEvent.type(combobox, 'Acme');
  const option = await screen.findByText('Acme Cleaning (Cleaning)');
  await userEvent.click(option);

  await waitFor(() => expect(screen.getByTestId('bill-submit')).not.toBeDisabled());

  fireEvent.submit(screen.getByTestId('bill-form'));
  await waitFor(() => expect(mockRecordExpense).toHaveBeenCalledTimes(1));
  expect(mockRecordExpense.mock.calls[0][0]).toMatchObject({ amountEur: 42.5, description: 'Cleaning', counterpartyId: 'cp-1' });

  // on success the form resets and the success banner shows
  await waitFor(() => expect(screen.getByTestId('bill-success')).toBeInTheDocument());
  expect((screen.getByTestId('bill-amount') as HTMLInputElement).value).toBe('');
});

test('scanning an invoice prefills amount/description but does not auto-select a counterparty', async () => {
  mockScanInvoice.mockResolvedValue({ amount: 99.9, date: '2026-08-01', vendor: 'ACME', confidence: 0.9 });
  renderTab();
  await waitFor(() => screen.getByTestId('bill-scan-input'));
  const file = new File(['x'], 'invoice.pdf', { type: 'application/pdf' });
  fireEvent.change(screen.getByTestId('bill-scan-input'), { target: { files: [file] } });
  await waitFor(() => expect((screen.getByTestId('bill-amount') as HTMLInputElement).value).toBe('99.9'));
  expect((screen.getByTestId('bill-desc') as HTMLInputElement).value).toBe('ACME');
  expect(screen.getByTestId('bill-confidence').textContent).toContain('90%');

  // Counterparty must still be picked manually -> submit stays disabled after a scan.
  expect(screen.getByTestId('bill-submit')).toBeDisabled();
});
