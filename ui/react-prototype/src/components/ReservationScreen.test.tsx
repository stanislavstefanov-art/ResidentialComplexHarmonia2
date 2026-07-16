import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { createTheme, ThemeProvider } from '@mui/material';
import ReservationScreen from './ReservationScreen';
import * as api from '../api/reservations';

jest.mock('../api/reservations');
const mockGetSlots = api.getSlots as jest.Mock;
const mockClaimSlot = api.claimSlot as jest.Mock;

const theme = createTheme();
const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ThemeProvider theme={theme}>{children}</ThemeProvider>
);
const renderScreen = () => render(<ReservationScreen />, { wrapper: Wrapper });

beforeEach(() => jest.clearAllMocks());

test('renders free, taken-mine, and taken-other slot cards', async () => {
  mockGetSlots.mockResolvedValue({
    day: '2026-07-16',
    slots: [
      { slotKey: 'morning', state: 'free' },
      { slotKey: 'afternoon', state: 'taken-mine' },
      { slotKey: 'evening', state: 'taken-other' },
    ],
  });
  renderScreen();
  await waitFor(() => expect(screen.getByText('morning')).toBeInTheDocument());
  expect(screen.getByText('afternoon')).toBeInTheDocument();
  expect(screen.getByText('evening')).toBeInTheDocument();
  expect(screen.getAllByRole('button', { name: /claim/i }).length).toBe(1);
});

test('claim happy path shows success feedback and removes Claim button', async () => {
  mockGetSlots.mockResolvedValue({
    day: '2026-07-16',
    slots: [{ slotKey: 'morning', state: 'free' }],
  });
  mockClaimSlot.mockResolvedValue({ outcome: 'confirmed-yours' });
  renderScreen();
  await waitFor(() => screen.getByRole('button', { name: /claim/i }));
  fireEvent.click(screen.getByRole('button', { name: /claim/i }));
  await waitFor(() => expect(screen.getByText(/confirmed/i)).toBeInTheDocument());
  expect(screen.queryByRole('button', { name: /^claim$/i })).not.toBeInTheDocument();
});

test('conflict (409) flips slot state and removes Claim button', async () => {
  mockGetSlots.mockResolvedValue({
    day: '2026-07-16',
    slots: [{ slotKey: 'morning', state: 'free' }],
  });
  mockClaimSlot.mockResolvedValue({ outcome: 'refused-already-taken' });
  renderScreen();
  await waitFor(() => screen.getByRole('button', { name: /claim/i }));
  fireEvent.click(screen.getByRole('button', { name: /claim/i }));
  await waitFor(() =>
    expect(screen.queryByRole('button', { name: /^claim$/i })).not.toBeInTheDocument()
  );
});

test('API error shows retry button', async () => {
  mockGetSlots.mockRejectedValue(new Error('Network error'));
  renderScreen();
  await waitFor(() => screen.getByRole('button', { name: /retry/i }));
  expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
});
