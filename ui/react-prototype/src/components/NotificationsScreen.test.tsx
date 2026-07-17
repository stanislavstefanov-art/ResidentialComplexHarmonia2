import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { createTheme, ThemeProvider } from '@mui/material';
import NotificationsScreen from './NotificationsScreen';
import * as api from '../api/notifications';

jest.mock('../api/notifications');
const mockGetHistory       = api.getHistory       as jest.Mock;
const mockSendAnnouncement = api.sendAnnouncement as jest.Mock;

const theme = createTheme();
const wrap = (role: 'resident' | 'admin' = 'resident') => ({
  wrapper: ({ children }: { children: React.ReactNode }) => (
    <ThemeProvider theme={theme}>{children}</ThemeProvider>
  ),
});

const NOTIFICATION = { id: 'n1', title: 'Test notice', sentAt: '2026-07-17T10:00:00Z', channel: 'web-push' };

beforeEach(() => {
  jest.clearAllMocks();
  mockGetHistory.mockResolvedValue([]);
  mockSendAnnouncement.mockResolvedValue(undefined);
});

test('renders notification rows from getHistory', async () => {
  mockGetHistory.mockResolvedValue([NOTIFICATION]);
  render(<NotificationsScreen role="resident" />, wrap('resident'));
  await waitFor(() => screen.getByTestId('notification-row-n1'));
  expect(screen.getByTestId('notification-row-n1').textContent).toContain('Test notice');
});

test('shows announce form for admin role', async () => {
  render(<NotificationsScreen role="admin" />, wrap('admin'));
  await waitFor(() => screen.getByTestId('announce-form'));
  expect(screen.getByTestId('announce-form')).toBeInTheDocument();
});

test('hides announce form for resident role', async () => {
  render(<NotificationsScreen role="resident" />, wrap('resident'));
  await waitFor(() => expect(mockGetHistory).toHaveBeenCalled());
  expect(screen.queryByTestId('announce-form')).not.toBeInTheDocument();
});

test('submit calls sendAnnouncement and reloads list', async () => {
  mockGetHistory.mockResolvedValue([NOTIFICATION]);
  render(<NotificationsScreen role="admin" />, wrap('admin'));
  await waitFor(() => screen.getByTestId('announce-form'));
  fireEvent.change(screen.getByLabelText(/Title/i), { target: { value: 'Test Title' } });
  fireEvent.change(screen.getByLabelText(/Body/i), { target: { value: 'Test body text' } });
  fireEvent.submit(screen.getByTestId('announce-form'));
  await waitFor(() => expect(mockSendAnnouncement).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(mockGetHistory).toHaveBeenCalledTimes(2));
  expect(screen.getByTestId('submit-success')).toBeInTheDocument();
});
