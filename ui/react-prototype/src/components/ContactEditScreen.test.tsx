import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { createTheme, ThemeProvider } from '@mui/material';
import ContactEditScreen from './ContactEditScreen';
import * as api from '../api/contactEdit';

jest.mock('../api/contactEdit');
const mockUpdateMyContact = api.updateMyContact as jest.Mock;
const mockUpdateContact   = api.updateContact   as jest.Mock;
const mockUpdateNotes     = api.updateNotes     as jest.Mock;

const theme = createTheme();
const wrap = () => ({
  wrapper: ({ children }: { children: React.ReactNode }) => (
    <ThemeProvider theme={theme}>{children}</ThemeProvider>
  ),
});

beforeEach(() => {
  jest.clearAllMocks();
  mockUpdateMyContact.mockResolvedValue(undefined);
  mockUpdateContact.mockResolvedValue(undefined);
  mockUpdateNotes.mockResolvedValue(undefined);
});

test('shows my-contact-form for resident', () => {
  render(<ContactEditScreen role="resident" />, wrap());
  expect(screen.getByTestId('my-contact-form')).toBeInTheDocument();
});

test('hides admin forms for resident', () => {
  render(<ContactEditScreen role="resident" />, wrap());
  expect(screen.queryByTestId('admin-contact-form')).not.toBeInTheDocument();
  expect(screen.queryByTestId('notes-form')).not.toBeInTheDocument();
});

test('shows admin forms for admin', () => {
  render(<ContactEditScreen role="admin" />, wrap());
  expect(screen.getByTestId('admin-contact-form')).toBeInTheDocument();
  expect(screen.getByTestId('notes-form')).toBeInTheDocument();
});

test('my-contact-form calls updateMyContact and shows success', async () => {
  render(<ContactEditScreen role="resident" />, wrap());
  fireEvent.change(screen.getByTestId('my-name-input'), { target: { value: 'Ada Lovelace' } });
  fireEvent.submit(screen.getByTestId('my-contact-form'));
  await waitFor(() => screen.getByTestId('my-contact-success'));
  expect(mockUpdateMyContact).toHaveBeenCalledTimes(1);
});

test('admin-contact-form calls updateContact and shows success', async () => {
  render(<ContactEditScreen role="admin" />, wrap());
  fireEvent.change(screen.getByTestId('admin-ref-input'), { target: { value: 'H001' } });
  fireEvent.change(screen.getByTestId('admin-name-input'), { target: { value: 'Board Edit' } });
  fireEvent.submit(screen.getByTestId('admin-contact-form'));
  await waitFor(() => screen.getByTestId('admin-contact-success'));
  expect(mockUpdateContact).toHaveBeenCalledTimes(1);
  expect(mockUpdateContact).toHaveBeenCalledWith('H001', expect.objectContaining({ displayName: 'Board Edit' }));
});

test('notes-form calls updateNotes and shows success', async () => {
  render(<ContactEditScreen role="admin" />, wrap());
  fireEvent.change(screen.getByTestId('notes-ref-input'), { target: { value: 'H001' } });
  fireEvent.change(screen.getByTestId('notes-text-input'), { target: { value: 'Board note' } });
  fireEvent.submit(screen.getByTestId('notes-form'));
  await waitFor(() => screen.getByTestId('notes-success'));
  expect(mockUpdateNotes).toHaveBeenCalledTimes(1);
  expect(mockUpdateNotes).toHaveBeenCalledWith('H001', 'Board note');
});

test('my-contact-form shows error on failure', async () => {
  mockUpdateMyContact.mockRejectedValue(new Error('network'));
  render(<ContactEditScreen role="resident" />, wrap());
  fireEvent.submit(screen.getByTestId('my-contact-form'));
  await waitFor(() => screen.getByTestId('my-contact-error'));
  expect(screen.getByTestId('my-contact-error')).toBeInTheDocument();
});
