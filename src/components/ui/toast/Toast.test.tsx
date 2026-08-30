import {
  render,
  screen,
  waitFor,
} from '@testing-library/react';

import { Toast } from './Toast';

test('announces its message through a permanent live region', async () => {
  const { rerender } = render(<Toast message="Updated" />);

  expect(screen.getByRole('status').textContent).toBe('Updated');

  rerender(<Toast message={null} />);

  expect(screen.getByRole('status')).toBeDefined();

  await waitFor(() => {
    expect(screen.queryByText('Updated')).toBeNull();
  });
});
