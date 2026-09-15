import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';

import { KeyChips } from './KeyChips';

test('shows one chip per key, under a label when given one', () => {
  const { rerender } = render(<KeyChips keys={['hooks', 'statusLine']} />);

  expect(screen.getByText('hooks')).toBeDefined();
  expect(screen.getByText('statusLine')).toBeDefined();
  expect(screen.queryByText('Areas')).toBeNull();

  rerender(<KeyChips keys={['hooks']} label="Areas" />);
  expect(screen.getByText('Areas')).toBeDefined();
});
