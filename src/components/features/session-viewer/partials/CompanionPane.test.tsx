import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  expect,
  test,
  vi,
} from 'vitest';

import { CompanionPane } from './CompanionPane';

import type { EditedFile } from '@services/edits/editsService';
import type { HistoryEntry } from '@services/history/historyService';
import type { MessageFilters } from '../utils/messageFilterUtils';
import type { CompanionPaneProps } from './CompanionPane';

const filters: MessageFilters = {
  roles: {
    human: true,
    ai: true,
  },
  content: {
    text: true,
    thinking: true,
    tools: true,
    commands: true,
  },
};

const files: readonly EditedFile[] = [{
  path: '/repo/alpha/src/a.ts',
  edits: 1,
  writes: 0,
  sessionCount: 1,
  lastEditedMs: 1,
  recent: [{
    kind: 'edit',
    sessionId: 's1',
    sessionTitle: 'Login fix',
    sessionFilePath: '/r/alpha/s1.jsonl',
    timestampMs: 1,
    changes: 2,
  }],
}];

const pane = (overrides: Partial<CompanionPaneProps> = {}): void => {
  render(
    <CompanionPane
      panel="edits"
      width={280}
      agent="claude"
      entries={[]}
      filters={filters}
      editedFiles={files}
      projectPath="/repo/alpha"
      nowMs={2}
      onResize={vi.fn()}
      onNavigate={vi.fn()}
      onOpenEdit={vi.fn()}
      onClose={vi.fn()}
      editsStatus="ready"
      {...overrides}
    />,
  );
};

test('draws nothing at all when no panel is open', () => {
  pane({ panel: 'none' });

  expect(screen.queryByRole('complementary')).toBeNull();
});

test('shows the edits this session made', () => {
  pane();

  expect(screen.getByRole('complementary', { name: 'File edits' })).toBeDefined();
  expect(screen.getByText('a.ts')).toBeDefined();
  expect(screen.getByText('src')).toBeDefined();
});

/*
 * One panel at a time. Both want the same strip of width, so the navigator and
 * the edits never share it.
 */
test('shows the navigator instead, never both', () => {
  pane({ panel: 'navigator' });

  expect(screen.getByRole('complementary', { name: 'Message navigator' })).toBeDefined();
  expect(screen.queryByRole('complementary', { name: 'File edits' })).toBeNull();
});

test('passes the profile through to the navigator', () => {
  const entries: readonly HistoryEntry[] = [{
    kind: 'assistant',
    uuid: 'a1',
    timestamp: 't1',
    sidechain: false,
    blocks: [{
      blockType: 'text',
      text: 'answer',
    }],
  }];

  pane({
    panel: 'navigator',
    entries,
    profile: 'Personal',
  });

  expect(screen.getByLabelText('Claude Code Personal 1')).toBeDefined();
});

test('says so when the session changed no files', () => {
  pane({ editedFiles: [] });

  expect(screen.getByText('This session edited no files.')).toBeDefined();
});

test('opens the edit that made a change', async () => {
  const onOpenEdit = vi.fn();

  pane({ onOpenEdit });
  await userEvent.click(screen.getByText('a.ts'));
  await userEvent.click(screen.getByText('Login fix'));

  expect(onOpenEdit).toHaveBeenCalledTimes(1);
});

/*
 * A scan still running must not read as a session that changed nothing, which
 * is what an empty list on its own would say.
 */
test('waits for the edit scan rather than claiming nothing changed', () => {
  pane({
    editedFiles: [],
    editsStatus: 'loading',
  });

  expect(screen.queryByText('This session edited no files.')).toBeNull();
});

test('reports a failed edit scan', () => {
  pane({
    editedFiles: [],
    editsStatus: 'error',
    editsError: 'transcripts unreadable',
  });

  expect(screen.getByText('transcripts unreadable')).toBeDefined();
});

// Nothing shortens a path that lies outside the project, so it keeps its whole
// directory and only the name is lifted out of it.
test('keeps the whole directory of a path outside the project', () => {
  pane({ projectPath: undefined });

  expect(screen.getByText('/repo/alpha/src')).toBeDefined();
});
