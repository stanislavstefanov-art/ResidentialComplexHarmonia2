import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import App from './App';
import * as meApi from './api/me';

jest.mock('./api/me');
const mockGetMyStatus = meApi.getMyStatus as jest.Mock;

jest.mock('@azure/msal-react', () => ({
  ...jest.requireActual('@azure/msal-react'),
  AuthenticatedTemplate: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  UnauthenticatedTemplate: () => null,
  useMsal: () => ({
    instance: { logoutRedirect: jest.fn(), getAllAccounts: () => [{}] },
    accounts: [{ name: 'Test User', username: 'test@test.com' }],
    inProgress: 'none',
  }),
}));

beforeEach(() => jest.clearAllMocks());

test('shows pending screen when getMyStatus returns pending', async () => {
  mockGetMyStatus.mockResolvedValue({ status: 'pending' });
  render(<App />);
  await waitFor(() => screen.getByTestId('pending-heading'));
  expect(screen.getByTestId('pending-heading')).toBeInTheDocument();
});

test('shows main app tabs when getMyStatus returns ok', async () => {
  mockGetMyStatus.mockResolvedValue({ status: 'ok' });
  render(<App />);
  await waitFor(() => screen.getByRole('tablist'));
  expect(screen.queryByTestId('pending-heading')).not.toBeInTheDocument();
});

test('shows main app tabs when getMyStatus errors (fail-open)', async () => {
  mockGetMyStatus.mockRejectedValue(new Error('network error'));
  render(<App />);
  await waitFor(() => screen.getByRole('tablist'));
  expect(screen.queryByTestId('pending-heading')).not.toBeInTheDocument();
});

test('shows main app after Check Again returns ok', async () => {
  mockGetMyStatus
    .mockResolvedValueOnce({ status: 'pending' })
    .mockResolvedValueOnce({ status: 'ok' });
  render(<App />);
  await waitFor(() => screen.getByTestId('pending-heading'));
  fireEvent.click(screen.getByTestId('check-again-btn'));
  await waitFor(() => screen.getByRole('tablist'));
  expect(screen.queryByTestId('pending-heading')).not.toBeInTheDocument();
});
