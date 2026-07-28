import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { createTheme, ThemeProvider } from '@mui/material';
import ResidentPendingScreen from './ResidentPendingScreen';

const theme = createTheme();
const wrap = () => ({
  wrapper: ({ children }: { children: React.ReactNode }) => (
    <ThemeProvider theme={theme}>{children}</ThemeProvider>
  ),
});

test('renders heading "Account pending approval"', () => {
  render(<ResidentPendingScreen onCheckAgain={jest.fn()} onSignOut={jest.fn()} />, wrap());
  expect(screen.getByTestId('pending-heading')).toHaveTextContent('Account pending approval');
});

test('renders body text mentioning building administrator', () => {
  render(<ResidentPendingScreen onCheckAgain={jest.fn()} onSignOut={jest.fn()} />, wrap());
  expect(screen.getByTestId('pending-body').textContent).toContain('building administrator');
});

test('"Check again" button calls onCheckAgain', async () => {
  const onCheckAgain = jest.fn().mockResolvedValue(undefined);
  render(<ResidentPendingScreen onCheckAgain={onCheckAgain} onSignOut={jest.fn()} />, wrap());
  fireEvent.click(screen.getByTestId('check-again-btn'));
  await waitFor(() => expect(onCheckAgain).toHaveBeenCalledTimes(1));
});

test('"Sign out" button calls onSignOut', () => {
  const onSignOut = jest.fn();
  render(
    <ResidentPendingScreen onCheckAgain={jest.fn().mockResolvedValue(undefined)} onSignOut={onSignOut} />,
    wrap(),
  );
  fireEvent.click(screen.getByTestId('sign-out-btn'));
  expect(onSignOut).toHaveBeenCalledTimes(1);
});
