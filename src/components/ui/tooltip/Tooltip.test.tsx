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

  test('anchors to a point instead of its child, for a hover target it does not wrap', () => {
    render(
      <Tooltip
        content="Sep 1 · 400 tokens"
        position={{
          x: 12,
          y: 34,
        }}
        open
      >
        <span aria-hidden />
      </Tooltip>,
    );

    const trigger = document.querySelector('button');

    expect(trigger?.style.left).toBe('12px');
    expect(trigger?.style.top).toBe('34px');
    expect(screen.getByRole('tooltip').textContent).toBe('Sep 1 · 400 tokens');
  });

  test('a position-anchored caller can also say it is closed', () => {
    render(
      <Tooltip
        content="Sep 1 · 400 tokens"
        position={{
          x: 12,
          y: 34,
        }}
        open={false}
      >
        <span aria-hidden />
      </Tooltip>,
    );

    expect(screen.queryByRole('tooltip')).toBeNull();
  });
});
