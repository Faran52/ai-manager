import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  describe,
  expect,
  test,
} from 'vitest';

import { ThinkingCard } from './ThinkingCard';

describe('ThinkingCard', () => {
  test('toggles its body through the native details state', async () => {
    render(<ThinkingCard thinking="secret reasoning" />);

    const card = document.querySelector('details[data-thinking]');

    expect(card?.hasAttribute('open')).toBe(false);
    expect(screen.getByText('secret reasoning')).toBeDefined();

    await userEvent.click(screen.getByText('Thinking'));

    expect(card?.hasAttribute('open')).toBe(true);
  });
});
