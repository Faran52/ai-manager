import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  describe,
  expect,
  test,
} from 'vitest';

import { ThinkingCard } from './ThinkingCard';

describe('ThinkingCard', () => {
  test('reveals the reasoning on toggle', async () => {
    render(<ThinkingCard thinking="secret reasoning" />);

    const trigger = screen.getByRole('button', { name: /thinking/i });

    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByText('secret reasoning')).toBeNull();

    await userEvent.click(trigger);

    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText('secret reasoning')).toBeDefined();
  });

  test('renders the reasoning as markdown', async () => {
    render(<ThinkingCard thinking={'**Planning the change**\n\nweigh the options'} />);

    await userEvent.click(screen.getByRole('button', { name: /thinking/i }));

    expect(screen.getByText('Planning the change').tagName).toBe('STRONG');
  });
});
