import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { createTheme, ThemeProvider } from '@mui/material';
import FinancialScreen from './FinancialScreen';
import * as api from '../api/financial';

jest.mock('../api/financial');
const mockGetPeriodSummary = api.getPeriodSummary as jest.Mock;
const mockGetMyCharges     = api.getMyCharges as jest.Mock;
const mockGetMyPayments    = api.getMyPayments as jest.Mock;

const theme = createTheme();
const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ThemeProvider theme={theme}>{children}</ThemeProvider>
);
const renderScreen = () => render(<FinancialScreen />, { wrapper: Wrapper });

beforeEach(() => {
  jest.clearAllMocks();
  mockGetPeriodSummary.mockResolvedValue({ period: '2026-07', totalChargesEur: 450, totalExpensesEur: 120 });
  mockGetMyCharges.mockResolvedValue([]);
  mockGetMyPayments.mockResolvedValue([]);
});

test('renders period summary amounts', async () => {
  renderScreen();
  await waitFor(() => screen.getByTestId('summary-charges'));
  expect(screen.getByTestId('summary-charges').textContent).toContain('450');
  expect(screen.getByTestId('summary-expenses').textContent).toContain('120');
});

test('renders charge rows from API', async () => {
  mockGetMyCharges.mockResolvedValue([
    { id: 'c1', householdRef: 'h1', amountEur: 150, description: 'July fee',
      period: '2026-07', chargedAt: '2026-07-01T00:00:00Z', idempotencyKey: 'ik1' },
  ]);
  renderScreen();
  await waitFor(() => screen.getByTestId('charge-row-c1'));
  expect(screen.getByTestId('charge-row-c1').textContent).toContain('July fee');
});

test('renders payment rows from API', async () => {
  mockGetMyPayments.mockResolvedValue([
    { id: 'p1', householdRef: 'h1', amountEur: 300, period: '2026-06',
      dateReceived: '2026-06-15', recordedAt: '2026-06-15T09:00:00Z', idempotencyKey: 'ik2' },
  ]);
  renderScreen();
  await waitFor(() => screen.getByTestId('payment-row-p1'));
  expect(screen.getByTestId('payment-row-p1').textContent).toContain('300');
});

test('pay button opens stub dialog', async () => {
  renderScreen();
  await waitFor(() => screen.getByTestId('pay-btn'));
  fireEvent.click(screen.getByTestId('pay-btn'));
  expect(screen.getByTestId('pay-dialog')).toBeInTheDocument();
});
