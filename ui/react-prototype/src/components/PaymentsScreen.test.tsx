import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { createTheme, ThemeProvider } from '@mui/material';
import PaymentsScreen from './PaymentsScreen';
import * as api from '../api/payments';

jest.mock('../api/payments');
const mockGetMyPayments  = api.getMyPayments  as jest.Mock;
const mockGetAllPayments = api.getAllPayments  as jest.Mock;
const mockRecordPayment  = api.recordPayment  as jest.Mock;
const mockGetBalance     = api.getBalance     as jest.Mock;

const theme = createTheme();
const wrap = (role: 'resident' | 'admin' = 'resident') => ({
  wrapper: ({ children }: { children: React.ReactNode }) => (
    <ThemeProvider theme={theme}>{children}</ThemeProvider>
  ),
});

const PAYMENT = {
  id: 'p1', householdRef: 'H001', amountEur: 150, period: '2026-07',
  dateReceived: '2026-07-15', recordedAt: '2026-07-15T10:00:00Z', idempotencyKey: 'ik1',
};
const BALANCE = { label: 'YTD-2026', lines: [{ householdRef: 'H001', totalCharged: 300, totalPaid: 150, balance: 150 }] };

beforeEach(() => {
  jest.clearAllMocks();
  mockGetMyPayments.mockResolvedValue([]);
  mockGetAllPayments.mockResolvedValue([]);
  mockRecordPayment.mockResolvedValue(PAYMENT);
  mockGetBalance.mockResolvedValue(BALANCE);
  Object.defineProperty(global, 'crypto', {
    value: { randomUUID: () => 'test-idempotency-key' },
    writable: true, configurable: true,
  });
});

test('renders payment rows for resident from getMyPayments', async () => {
  mockGetMyPayments.mockResolvedValue([PAYMENT]);
  render(<PaymentsScreen role="resident" />, wrap('resident'));
  await waitFor(() => screen.getByTestId('payment-row-p1'));
  expect(screen.getByTestId('payment-row-p1').textContent).toContain('2026-07');
});

test('shows record form for admin role', async () => {
  render(<PaymentsScreen role="admin" />, wrap('admin'));
  await waitFor(() => screen.getByTestId('record-form'));
  expect(screen.getByTestId('record-form')).toBeInTheDocument();
});

test('hides record form for resident role', async () => {
  render(<PaymentsScreen role="resident" />, wrap('resident'));
  await waitFor(() => expect(mockGetMyPayments).toHaveBeenCalled());
  expect(screen.queryByTestId('record-form')).not.toBeInTheDocument();
});

test('submit calls recordPayment and reloads list', async () => {
  mockGetAllPayments.mockResolvedValue([PAYMENT]);
  render(<PaymentsScreen role="admin" />, wrap('admin'));
  await waitFor(() => screen.getByTestId('record-form'));
  fireEvent.change(screen.getByLabelText(/Household Ref/i), { target: { value: 'H001' } });
  fireEvent.change(screen.getByLabelText(/Amount/i), { target: { value: '150' } });
  fireEvent.submit(screen.getByTestId('record-form'));
  await waitFor(() => expect(mockRecordPayment).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(mockGetAllPayments).toHaveBeenCalledTimes(2));
  expect(screen.getByTestId('submit-success')).toBeInTheDocument();
});
