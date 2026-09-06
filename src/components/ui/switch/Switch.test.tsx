import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  describe,
  expect,
  test,
  vi,
} from 'vitest';

import { Switch } from './Switch';

describe('Switch', () => {
  test('reports its state through the switch role', () => {
    render(<Switch checked label="Retention" onChange={vi.fn()} />);

    expect(screen.getByRole('switch', { name: 'Retention' }).getAttribute('aria-checked'))
      .toBe('true');
  });

  test('sends the next state when clicked', async () => {
    const onChange = vi.fn();

    render(<Switch checked={false} label="Retention" onChange={onChange} />);
    await userEvent.click(screen.getByRole('switch'));

    expect(onChange).toHaveBeenCalledWith(true);
  });

  test('toggles from the keyboard', async () => {
    const onChange = vi.fn();

    render(<Switch checked={false} label="Retention" onChange={onChange} />);
    await userEvent.tab();
    await userEvent.keyboard(' ');

    expect(onChange).toHaveBeenCalledWith(true);
  });

  test('stays put while disabled', async () => {
    const onChange = vi.fn();

    render(<Switch checked disabled label="Retention" onChange={onChange} />);
    await userEvent.click(screen.getByRole('switch'));

    expect(onChange).not.toHaveBeenCalled();
  });
});
