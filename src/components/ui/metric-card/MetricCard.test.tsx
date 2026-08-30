import { render, screen } from '@testing-library/react';
import {
  describe,
  expect,
  test,
} from 'vitest';

import { MetricCard } from './MetricCard';

describe('MetricCard', () => {
  test('renders value with optional hint and icon', () => {
    const { rerender } = render(<MetricCard label="Sessions" value="7" />);

    expect(screen.getByText('Sessions')).toBeDefined();
    expect(screen.getByText('7')).toBeDefined();
    expect(screen.queryByText('extra')).toBeNull();

    rerender(
      <MetricCard label="Sessions" value="7" hint="extra" icon={<b>i</b>} />,
    );

    expect(screen.getByText('extra')).toBeDefined();
    expect(screen.getByText('i')).toBeDefined();
  });
});
