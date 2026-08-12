import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { createTheme, ThemeProvider } from '@mui/material';
import FinancialScreen from './FinancialScreen';
import { getPeriodSummary } from '../api/financial';
import { getMyCharges, getAllCharges } from '../api/maintenanceFees';
import { getMyPayments, getAllPayments, getBalance } from '../api/payments';
import { getExpenses } from '../api/expenses';

jest.mock('../api/financial');
jest.mock('../api/maintenanceFees');
jest.mock('../api/payments');
jest.mock('../api/expenses');

const mockGetPeriodSummary = getPeriodSummary as jest.Mock;
const mockGetMyCharges     = getMyCharges as jest.Mock;
const mockGetMyPayments    = getMyPayments as jest.Mock;
const mockGetAllCharges    = getAllCharges as jest.Mock;
const mockGetAllPayments   = getAllPayments as jest.Mock;
const mockGetBalance       = getBalance as jest.Mock;
const mockGetExpenses      = getExpenses as jest.Mock;

const theme = createTheme();
const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ThemeProvider theme={theme}>{children}</ThemeProvider>
);
const renderScreen = (role: 'resident' | 'admin' = 'resident') =>
  render(<FinancialScreen role={role} />, { wrapper: Wrapper });

beforeEach(() => {
  jest.clearAllMocks();
  mockGetPeriodSummary.mockResolvedValue({ period: '2026-07', totalChargesEur: 450, totalExpensesEur: 120 });
  mockGetMyCharges.mockResolvedValue([]);
  mockGetMyPayments.mockResolvedValue([]);
  mockGetAllCharges.mockResolvedValue([]);
  mockGetAllPayments.mockResolvedValue([]);
  mockGetBalance.mockResolvedValue({ label: 'x', lines: [] });
  mockGetExpenses.mockResolvedValue([]);
});

test('renders period summary amounts (resident)', async () => {
  renderScreen('resident');
  await waitFor(() => screen.getByTestId('summary-charges'));
  expect(screen.getByTestId('summary-charges').textContent).toContain('450');
  expect(screen.getByTestId('summary-expenses').textContent).toContain('120');
});

test('renders charge rows from API (resident)', async () => {
  mockGetMyCharges.mockResolvedValue([
    { id: 'c1', householdRef: 'h1', amountEur: 150, description: 'July fee',
      period: '2026-07', chargedAt: '2026-07-01T00:00:00Z', idempotencyKey: 'ik1' },
  ]);
  renderScreen('resident');
  await waitFor(() => screen.getByTestId('charge-row-c1'));
  expect(screen.getByTestId('charge-row-c1').textContent).toContain('July fee');
});

test('renders payment rows from API (resident)', async () => {
  mockGetMyPayments.mockResolvedValue([
    { id: 'p1', householdRef: 'h1', amountEur: 300, period: '2026-06',
      dateReceived: '2026-06-15', recordedAt: '2026-06-15T09:00:00Z', idempotencyKey: 'ik2' },
  ]);
  renderScreen('resident');
  await waitFor(() => screen.getByTestId('payment-row-p1'));
  expect(screen.getByTestId('payment-row-p1').textContent).toContain('300');
});

test('pay button opens stub dialog (resident)', async () => {
  renderScreen('resident');
  await waitFor(() => screen.getByTestId('pay-btn'));
  fireEvent.click(screen.getByTestId('pay-btn'));
  expect(screen.getByTestId('pay-dialog')).toBeInTheDocument();
});

test('admin sees Bills as the default active tab', async () => {
  renderScreen('admin');
  await waitFor(() => screen.getByTestId('bill-form'));
  expect(screen.getByRole('tab', { selected: true }).textContent).toMatch(/bill/i);
});

test('resident view has no tabs', async () => {
  renderScreen('resident');
  await waitFor(() => screen.getByTestId('summary-charges'));
  expect(screen.queryByRole('tab')).toBeNull();
});
