import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import LanguageSwitcher from './LanguageSwitcher';
import i18n, { LANG_STORAGE_KEY } from '../i18n';

afterEach(() => { i18n.changeLanguage('en'); });

test('opens the menu and lists all three languages', () => {
  render(<LanguageSwitcher />);
  fireEvent.click(screen.getByLabelText(/language/i));
  const menu = screen.getByRole('menu');
  expect(within(menu).getByText('Български')).toBeInTheDocument();
  expect(within(menu).getByText('Русский')).toBeInTheDocument();
  expect(within(menu).getByText('English')).toBeInTheDocument();
});

test('selecting a language changes i18n and persists it', () => {
  render(<LanguageSwitcher />);
  fireEvent.click(screen.getByLabelText(/language/i));
  fireEvent.click(within(screen.getByRole('menu')).getByText('Русский'));
  expect(i18n.language).toBe('ru');
  expect(localStorage.getItem(LANG_STORAGE_KEY)).toBe('ru');
});
