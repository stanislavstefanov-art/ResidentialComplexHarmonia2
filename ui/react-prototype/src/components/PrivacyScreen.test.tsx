import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { createTheme, ThemeProvider } from '@mui/material';
import PrivacyScreen from './PrivacyScreen';
import * as api from '../api/privacy';

jest.mock('../api/privacy');
const mockEraseMyContact = api.eraseMyContact as jest.Mock;
const mockEraseContact   = api.eraseContact   as jest.Mock;
const mockMarkDeparted   = api.markDeparted   as jest.Mock;
const mockPurgeExpired   = api.purgeExpired   as jest.Mock;

const theme = createTheme();
const wrap = (role: 'resident' | 'admin' = 'resident') => ({
  wrapper: ({ children }: { children: React.ReactNode }) => (
    <ThemeProvider theme={theme}>{children}</ThemeProvider>
  ),
});

beforeEach(() => {
  jest.clearAllMocks();
  mockEraseMyContact.mockResolvedValue(undefined);
  mockEraseContact.mockResolvedValue('erased');
  mockMarkDeparted.mockResolvedValue('ok');
  mockPurgeExpired.mockResolvedValue({ deleted: 0 });
});

test('shows delete-my-data button for resident', () => {
  render(<PrivacyScreen role="resident" />, wrap('resident'));
  expect(screen.getByTestId('delete-my-data-btn')).toBeInTheDocument();
});

test('hides admin cards for resident', () => {
  render(<PrivacyScreen role="resident" />, wrap('resident'));
  expect(screen.queryByTestId('erase-form')).not.toBeInTheDocument();
  expect(screen.queryByTestId('purge-btn')).not.toBeInTheDocument();
});

test('shows admin cards for admin', () => {
  render(<PrivacyScreen role="admin" />, wrap('admin'));
  expect(screen.getByTestId('erase-form')).toBeInTheDocument();
  expect(screen.getByTestId('purge-btn')).toBeInTheDocument();
});

test('delete-my-data-btn calls eraseMyContact and shows success', async () => {
  render(<PrivacyScreen role="resident" />, wrap('resident'));
  fireEvent.click(screen.getByTestId('delete-my-data-btn'));
  await waitFor(() => screen.getByTestId('delete-success'));
  expect(mockEraseMyContact).toHaveBeenCalledTimes(1);
});

test('erase-form calls eraseContact and shows erased result', async () => {
  render(<PrivacyScreen role="admin" />, wrap('admin'));
  fireEvent.change(screen.getByTestId('erase-ref-input'), { target: { value: 'H001' } });
  fireEvent.submit(screen.getByTestId('erase-form'));
  await waitFor(() => screen.getByTestId('erase-result'));
  expect(mockEraseContact).toHaveBeenCalledTimes(1);
  expect(screen.getByTestId('erase-result')).toBeInTheDocument();
});

test('erase-form shows not-found result when eraseContact returns not-found', async () => {
  mockEraseContact.mockResolvedValue('not-found');
  render(<PrivacyScreen role="admin" />, wrap('admin'));
  fireEvent.change(screen.getByTestId('erase-ref-input'), { target: { value: 'H999' } });
  fireEvent.submit(screen.getByTestId('erase-form'));
  await waitFor(() => screen.getByTestId('erase-result'));
  expect(screen.getByTestId('erase-result').textContent).toContain('not found');
});

test('purge-btn calls purgeExpired and shows deleted count', async () => {
  mockPurgeExpired.mockResolvedValue({ deleted: 5 });
  render(<PrivacyScreen role="admin" />, wrap('admin'));
  fireEvent.click(screen.getByTestId('purge-btn'));
  await waitFor(() => screen.getByTestId('purge-result'));
  expect(screen.getByTestId('purge-result').textContent).toContain('5');
});
