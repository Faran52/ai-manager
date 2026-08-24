import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

import { MenuCheckboxItem } from './MenuCheckboxItem';

test('renders and toggles a reusable checked menu action', async () => {
  const onClick = vi.fn();

  render(<MenuCheckboxItem checked onClick={onClick}>Tool activity</MenuCheckboxItem>);
  const item = screen.getByRole('menuitemcheckbox', { name: 'Tool activity' });

  expect(item.getAttribute('aria-checked')).toBe('true');
  await userEvent.click(item);
  expect(onClick).toHaveBeenCalledOnce();
});
