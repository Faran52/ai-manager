import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  describe,
  expect,
  test,
} from 'vitest';

import { Tooltip } from './Tooltip';

describe('Tooltip', () => {
  test('renders the control it describes', () => {
    render(
      <Tooltip content="Refresh">
        <button type="button">icon</button>
      </Tooltip>,
    );

    expect(screen.getByRole('button', { name: 'icon' })).toBeDefined();
  });

  test('appears for a keyboard user, which title never does', async () => {
    render(
      <Tooltip content="Refresh">
        <button type="button">icon</button>
      </Tooltip>,
    );
    await userEvent.tab();

    expect(await screen.findByRole('tooltip')).toBeDefined();
  });

  test('takes an explicit side', async () => {
    render(
      <Tooltip content="Reveal" side="right">
        <button type="button">icon</button>
      </Tooltip>,
    );
    await userEvent.tab();

    expect((await screen.findByRole('tooltip')).textContent).toBe('Reveal');
  });
});
