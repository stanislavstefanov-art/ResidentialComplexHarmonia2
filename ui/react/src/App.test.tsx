import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';

test('renders Harmonia app shell', () => {
  render(<App />);
  expect(screen.getByText(/Residence Harmonia/i)).toBeInTheDocument();
});
