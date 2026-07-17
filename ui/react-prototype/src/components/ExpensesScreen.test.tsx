import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { createTheme, ThemeProvider } from '@mui/material';
import ExpensesScreen from './ExpensesScreen';
import * as api from '../api/expenses';

jest.mock('../api/expenses');
const mockGetExpenses    = api.getExpenses    as jest.Mock;
const mockRecordExpense  = api.recordExpense  as jest.Mock;

const theme = createTheme();
const wrap = (role: 'resident' | 'admin' = 'resident') => ({
  wrapper: ({ children }: { children: React.ReactNode }) => (
    <ThemeProvider theme={theme}>{children}</ThemeProvider>
  ),
});

const EXPENSE = {
  id: 'e1', amountEur: 200, description: 'Window cleaning', category: 'Cleaning',
  expenseDate: '2026-07-10', recordedAt: '2026-07-10T09:00:00Z', idempotencyKey: 'ik1',
};

beforeEach(() => {
  jest.clearAllMocks();
  mockGetExpenses.mockResolvedValue([]);
  mockRecordExpense.mockResolvedValue(EXPENSE);
  Object.defineProperty(global, 'crypto', {
    value: { randomUUID: () => 'test-idempotency-key' },
    writable: true,
    configurable: true,
  });
});

test('renders expense rows from API', async () => {
  mockGetExpenses.mockResolvedValue([EXPENSE]);
  render(<ExpensesScreen role="resident" />, wrap('resident'));
  await waitFor(() => screen.getByTestId('expense-row-e1'));
  expect(screen.getByTestId('expense-row-e1').textContent).toContain('Window cleaning');
});

test('shows record form for admin role', async () => {
  render(<ExpensesScreen role="admin" />, wrap('admin'));
  await waitFor(() => screen.getByTestId('record-form'));
  expect(screen.getByTestId('record-form')).toBeInTheDocument();
});

test('hides record form for resident role', async () => {
  render(<ExpensesScreen role="resident" />, wrap('resident'));
  await waitFor(() => expect(mockGetExpenses).toHaveBeenCalled());
  expect(screen.queryByTestId('record-form')).not.toBeInTheDocument();
});

test('submit calls recordExpense and reloads list', async () => {
  mockGetExpenses.mockResolvedValue([EXPENSE]);
  render(<ExpensesScreen role="admin" />, wrap('admin'));
  await waitFor(() => screen.getByTestId('record-form'));
  fireEvent.change(screen.getByLabelText(/Amount/i), { target: { value: '200' } });
  fireEvent.submit(screen.getByTestId('record-form'));
  await waitFor(() => expect(mockRecordExpense).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(mockGetExpenses).toHaveBeenCalledTimes(2));
  expect(screen.getByTestId('submit-success')).toBeInTheDocument();
});
