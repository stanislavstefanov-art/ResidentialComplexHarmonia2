import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { createTheme, ThemeProvider } from '@mui/material';
import MaintenanceFeesScreen from './MaintenanceFeesScreen';
import * as api from '../api/maintenanceFees';

jest.mock('../api/maintenanceFees');
const mockGetMyCharges  = api.getMyCharges  as jest.Mock;
const mockGetAllCharges = api.getAllCharges  as jest.Mock;
const mockRecordCharge  = api.recordCharge  as jest.Mock;

const theme = createTheme();
const wrap = (role: 'resident' | 'admin' = 'resident') => ({
  wrapper: ({ children }: { children: React.ReactNode }) => (
    <ThemeProvider theme={theme}>{children}</ThemeProvider>
  ),
});

const CHARGE = {
  id: 'c1', householdRef: 'H001', amountEur: 150, description: 'Monthly fee',
  period: '2026-07', chargedAt: '2026-07-01T00:00:00Z', idempotencyKey: 'ik1',
};

beforeEach(() => {
  jest.clearAllMocks();
  mockGetMyCharges.mockResolvedValue([]);
  mockGetAllCharges.mockResolvedValue([]);
  mockRecordCharge.mockResolvedValue(CHARGE);
  Object.defineProperty(global, 'crypto', {
    value: { randomUUID: () => 'test-idempotency-key' },
    writable: true, configurable: true,
  });
});

test('renders charge rows for resident from getMyCharges', async () => {
  mockGetMyCharges.mockResolvedValue([CHARGE]);
  render(<MaintenanceFeesScreen role="resident" />, wrap('resident'));
  await waitFor(() => screen.getByTestId('charge-row-c1'));
  expect(screen.getByTestId('charge-row-c1').textContent).toContain('Monthly fee');
});

test('shows record form for admin role', async () => {
  render(<MaintenanceFeesScreen role="admin" />, wrap('admin'));
  await waitFor(() => screen.getByTestId('record-form'));
  expect(screen.getByTestId('record-form')).toBeInTheDocument();
});

test('hides record form for resident role', async () => {
  render(<MaintenanceFeesScreen role="resident" />, wrap('resident'));
  await waitFor(() => expect(mockGetMyCharges).toHaveBeenCalled());
  expect(screen.queryByTestId('record-form')).not.toBeInTheDocument();
});

test('submit calls recordCharge and reloads list', async () => {
  mockGetAllCharges.mockResolvedValue([CHARGE]);
  render(<MaintenanceFeesScreen role="admin" />, wrap('admin'));
  await waitFor(() => screen.getByTestId('record-form'));
  fireEvent.change(screen.getByLabelText(/Household Ref/i), { target: { value: 'H001' } });
  fireEvent.change(screen.getByLabelText(/Amount/i), { target: { value: '150' } });
  fireEvent.submit(screen.getByTestId('record-form'));
  await waitFor(() => expect(mockRecordCharge).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(mockGetAllCharges).toHaveBeenCalledTimes(2));
  expect(screen.getByTestId('submit-success')).toBeInTheDocument();
});
