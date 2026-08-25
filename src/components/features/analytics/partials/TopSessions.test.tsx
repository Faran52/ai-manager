import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

import { TopSessions } from './TopSessions';

import type { SessionTokenTotals } from '@services/stats/statsService';

const session: SessionTokenTotals = {
  filePath: '/a.jsonl',
  sessionId: 'a',
  title: undefined,
  tokens: 900,
  messages: 5,
  lastTimestampMs: 0,
};

test('opens a ranked session and falls back to its id', async () => {
  const onOpenSession = vi.fn();

  render(<TopSessions sessions={[session]} onOpenSession={onOpenSession} />);
  await userEvent.click(screen.getByRole('button', { name: /a/u }));

  expect(onOpenSession).toHaveBeenCalledWith(session);
});
