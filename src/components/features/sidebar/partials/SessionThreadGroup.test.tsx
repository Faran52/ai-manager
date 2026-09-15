import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';

import { fixtureContext, fixtureRow } from '@mocks/sessionRowFixtures';

import { SessionThreadGroup } from './SessionThreadGroup';

test('shows the parts only while the thread is expanded', () => {
  const head = fixtureRow('a', { partCount: 2 });
  const parts = [fixtureRow('b', {
    threadKey: 'thread-a',
    continuation: true,
  })];
  const { rerender } = render(
    <ul>
      <SessionThreadGroup head={head} parts={parts} context={fixtureContext()} collapse={{ duration: 0 }} />
    </ul>,
  );

  expect(screen.queryByText('Session b')).toBeNull();

  rerender(
    <ul>
      <SessionThreadGroup
        head={head}
        parts={parts}
        context={fixtureContext({ expandedThreads: ['thread-a'] })}
        collapse={{ duration: 0 }}
      />
    </ul>,
  );

  expect(screen.getByText('Session b')).toBeDefined();
});
