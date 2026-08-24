import { render, screen } from '@testing-library/react';
import {
  describe,
  expect,
  test,
} from 'vitest';

import { EmptyState } from './EmptyState';

describe('EmptyState', () => {
  test('shows title always and hint only when present', () => {
    const { rerender } = render(<EmptyState icon={<i>x</i>} title="Nothing here" />);

    expect(screen.getByText('Nothing here')).toBeDefined();
    expect(screen.queryByText('A hint')).toBeNull();

    rerender(<EmptyState icon={<i>x</i>} title="Nothing here" hint="A hint" />);

    expect(screen.getByText('A hint')).toBeDefined();
  });
});
