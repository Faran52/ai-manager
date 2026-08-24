import { render, screen } from '@testing-library/react';

import { BashToolBody } from './BashToolBody';

test('renders a command with an optional description', () => {
  const { rerender } = render(<BashToolBody command="pnpm check" description="Verify" />);

  expect(screen.getByText('Verify')).toBeDefined();
  expect(screen.getByText('pnpm check')).toBeDefined();

  rerender(<BashToolBody command="pnpm test" />);
  expect(screen.queryByText('Verify')).toBeNull();
});
