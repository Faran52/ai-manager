import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  expect,
  test,
  vi,
} from 'vitest';

import { PromptHistoryPanel } from './PromptHistoryPanel';

import type { AsyncResource } from '@features/history-data';
import type { PromptHistory, PromptRecord } from '@services/prompts/promptsService';

const NOW = Date.parse('2026-08-28T12:00:00Z');

const noop = (): void => {
  return undefined;
};

const kept: PromptRecord = {
  text: 'fix the login bug',
  timestampMs: NOW - 60_000,
  projectPath: '/repo/alpha',
  projectName: 'alpha',
  sessionId: 's1',
  filePath: '/home/.claude/projects/-repo-alpha/s1.jsonl',
};

const lost: PromptRecord = {
  text: 'rewrite the parser',
  timestampMs: NOW - 600_000,
  projectPath: '/repo/gone',
  projectName: 'gone',
  sessionId: 's2',
  filePath: undefined,
};

const history: PromptHistory = {
  prompts: [kept, lost],
  projects: [
    {
      projectPath: '/repo/alpha',
      projectName: 'alpha',
      promptCount: 1,
      lastPromptMs: NOW - 60_000,
      orphaned: false,
    },
    {
      projectPath: '/repo/gone',
      projectName: 'gone',
      promptCount: 1,
      lastPromptMs: NOW - 600_000,
      orphaned: true,
    },
  ],
  total: 5_307,
};

const resource = (
  status: AsyncResource<PromptHistory>['status'],
  data: PromptHistory | undefined,
  error?: string,
): AsyncResource<PromptHistory> => {
  return {
    status,
    data,
    error,
    reload: noop,
  };
};

const renderPanel = (
  value: AsyncResource<PromptHistory> = resource('ready', history),
  onOpenPrompt = noop,
): void => {
  render(<PromptHistoryPanel history={value} nowMs={NOW} onOpenPrompt={onOpenPrompt} />);
};

test('counts every recorded prompt and the projects that lost their transcripts', () => {
  renderPanel();

  expect(screen.getByText('5307')).toBeDefined();
  expect(screen.getByText('2')).toBeDefined();
  expect(screen.getByText('1')).toBeDefined();
  expect(screen.getByText(/only the prompts remain/)).toBeDefined();
});

test('lists prompts and marks the ones whose session is gone', () => {
  renderPanel();

  expect(screen.getByText('fix the login bug')).toBeDefined();
  expect(screen.getByText('rewrite the parser')).toBeDefined();
  expect(screen.getByText('session deleted')).toBeDefined();
});

test('opens the session a surviving prompt points at', async () => {
  const onOpenPrompt = vi.fn();

  renderPanel(resource('ready', history), onOpenPrompt);
  await userEvent.click(screen.getByText('fix the login bug'));

  expect(onOpenPrompt).toHaveBeenCalledWith(kept.filePath, kept.timestampMs);
});

test('refuses to open a prompt whose session is gone', async () => {
  const onOpenPrompt = vi.fn();

  renderPanel(resource('ready', history), onOpenPrompt);
  await userEvent.click(screen.getByText('rewrite the parser'));

  expect(onOpenPrompt).not.toHaveBeenCalled();
});

test('filters by prompt text and by project, and says when nothing matches', async () => {
  renderPanel();

  const search = screen.getByLabelText('Search prompts');

  await userEvent.type(search, 'LOGIN');
  expect(screen.getByText('fix the login bug')).toBeDefined();
  expect(screen.queryByText('rewrite the parser')).toBeNull();

  await userEvent.clear(search);
  await userEvent.type(search, 'gone');
  expect(screen.getByText('rewrite the parser')).toBeDefined();

  await userEvent.clear(search);
  await userEvent.type(search, 'nothing here');
  expect(screen.getByText('No prompts match')).toBeDefined();
});

test('waits while loading and reports a failure', () => {
  const { unmount } = render(
    <PromptHistoryPanel history={resource('loading', undefined)} nowMs={NOW} onOpenPrompt={noop} />,
  );

  expect(screen.queryByLabelText('Search prompts')).toBeNull();
  unmount();

  renderPanel(resource('error', undefined, 'unreadable'));
  expect(screen.getByText('unreadable')).toBeDefined();
});
