import {
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  describe,
  expect,
  test,
  vi,
} from 'vitest';

import { fixtureContext, fixtureRow } from '@mocks/sessionRowFixtures';

import { SessionList } from './SessionList';

import type { SessionListProps } from './SessionList';

const base: Omit<SessionListProps, 'groups'> = {
  collapsedGroups: [],
  onToggleGroup: () => {
    return undefined;
  },
  context: fixtureContext(),
  collapse: { duration: 0 },
  status: 'ready',
  scoped: true,
  total: 1,
  visible: 1,
  filtering: false,
};

describe('SessionList', () => {
  test('lists rows under their recency heading and lets the heading fold them away', async () => {
    const onToggleGroup = vi.fn();
    const groups = [{
      bucket: 'today' as const,
      rows: [fixtureRow('a'), fixtureRow('b', { partCount: 2 })],
      count: 2,
    }];
    const { rerender } = render(<SessionList {...base} groups={groups} onToggleGroup={onToggleGroup} />);

    expect(screen.getByText('Session a')).toBeDefined();
    await userEvent.click(screen.getByRole('button', { name: /Today/ }));
    expect(onToggleGroup).toHaveBeenCalledWith('today');

    rerender(<SessionList {...base} groups={groups} collapsedGroups={['today']} />);
    await waitFor(() => {
      expect(screen.queryByText('Session a')).toBeNull();
    });
  });

  test('explains an empty list by what is missing', () => {
    const { rerender } = render(<SessionList {...base} groups={[]} status="loading" />);

    expect(screen.getByRole('status')).toBeDefined();

    rerender(<SessionList {...base} groups={[]} scoped={false} />);
    expect(screen.getByText('Select a project')).toBeDefined();

    rerender(<SessionList {...base} groups={[]} total={0} visible={0} />);
    expect(screen.getByText('No sessions yet')).toBeDefined();

    rerender(<SessionList {...base} groups={[]} total={0} visible={0} filtering />);
    expect(screen.getByText('No sessions match')).toBeDefined();
  });
});
