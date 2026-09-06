import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  describe,
  expect,
  test,
  vi,
} from 'vitest';

import { CollapsedStrip } from './CollapsedStrip';

import type { StripItem } from './CollapsedStrip';

const item = (overrides: Partial<StripItem> = {}): StripItem => {
  return {
    id: 'p1',
    label: 'webapp',
    selected: false,
    onSelect: () => {
      return undefined;
    },
    ...overrides,
  };
};

describe('CollapsedStrip', () => {
  test('unfolds the column it stands in for', async () => {
    const onExpand = vi.fn();

    render(
      <CollapsedStrip
        expandLabel="Show projects"
        listLabel="Projects"
        items={[]}
        onExpand={onExpand}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Show projects' }));

    expect(onExpand).toHaveBeenCalledTimes(1);
  });

  test('keeps the selection on the mark and moves on a click', async () => {
    const onSelect = vi.fn();

    render(
      <CollapsedStrip
        expandLabel="Show projects"
        listLabel="Projects"
        items={[item({
          selected: true,
          onSelect,
        })]}
        onExpand={() => {
          return undefined;
        }}
      />,
    );

    const tile = screen.getByRole('button', { name: 'webapp' });

    expect(tile.getAttribute('aria-current')).toBe('true');
    expect(screen.getByText('we')).toBeDefined();

    await userEvent.click(tile);

    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  test('marks a session with the capitals of the agent that recorded it', () => {
    render(
      <CollapsedStrip
        expandLabel="Show sessions"
        listLabel="Sessions"
        items={[item({
          label: 'Login fix',
          agent: 'claude',
        })]}
        onExpand={() => {
          return undefined;
        }}
      />,
    );

    expect(screen.getByText('CC')).toBeDefined();
  });

  test('takes a mark of its own over the initials', () => {
    render(
      <CollapsedStrip
        expandLabel="Show projects"
        listLabel="Projects"
        items={[item({ mark: 'ZZ' })]}
        onExpand={() => {
          return undefined;
        }}
      />,
    );

    expect(screen.getByText('ZZ')).toBeDefined();
    expect(screen.queryByText('we')).toBeNull();
  });
});
