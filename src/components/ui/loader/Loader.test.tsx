import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';

import { Loader } from './Loader';

test('says what it waits on, as the stage text and the accessible name', () => {
  render(<Loader label="Reading sessions" />);

  expect(screen.getByRole('status')).toBeDefined();
  expect(screen.getByText('Reading sessions')).toBeDefined();
});

test('carries the glyph it is given', () => {
  render(<Loader icon={<svg data-testid="mark" />} label="Working" />);

  expect(screen.getByTestId('mark')).toBeDefined();
});
