import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  describe,
  expect,
  test,
  vi,
} from 'vitest';

import { IconButton } from './IconButton';

describe('IconButton', () => {
  test('names itself for a keyboard and reports the click', async () => {
    const onClick = vi.fn();

    render(<IconButton label="Hide projects" icon={<span>x</span>} onClick={onClick} />);
    await userEvent.click(screen.getByRole('button', { name: 'Hide projects' }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  test('announces a pressed toggle', () => {
    render(<IconButton label="Navigator" icon={<span>n</span>} onClick={vi.fn()} pressed variant="segment" />);

    expect(screen.getByRole('button', { name: 'Navigator' }).getAttribute('aria-pressed')).toBe('true');
  });
});
