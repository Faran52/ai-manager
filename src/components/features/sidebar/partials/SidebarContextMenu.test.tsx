import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, vi } from 'vitest';

import { SidebarContextMenu } from './SidebarContextMenu';

import type { SessionSummary } from '@services/history/historyService';

afterEach(() => {
  vi.unstubAllGlobals();
});

test('renders only supported actions for the selected project', () => {
  const props = {
    position: {
      x: 0,
      y: 0,
    },
    onClose: vi.fn(),
    onCopied: vi.fn(),
    onDeleteProject: vi.fn(),
    onRenameSession: vi.fn(),
    onDeleteSession: vi.fn(),
  };
  const { rerender } = render(
    <SidebarContextMenu
      target={{
        kind: 'project',
        project: {
          agent: 'claude',
          id: 'p',
          name: 'Project',
          sessionCount: 1,
          messageCount: 2,
          lastActivityMs: 0,
        },
      }}
      {...props}
    />,
  );

  expect(screen.getByRole('menu', { name: 'Project actions' })).toBeDefined();
  expect(screen.getByRole('menuitem', { name: 'Copy project ID' })).toBeDefined();
  expect(screen.getByRole('menuitem', { name: 'Delete project history' })).toBeDefined();

  rerender(
    <SidebarContextMenu
      {...props}
      target={{
        kind: 'project',
        project: {
          agent: 'codex',
          id: '/repo',
          name: 'Repo',
          actualPath: '/repo',
          sessionCount: 1,
          messageCount: 2,
          lastActivityMs: 0,
        },
      }}
    />,
  );
  expect(screen.queryByText('Delete project history')).toBeNull();
});

test('runs Codex resume, rename, and delete actions', async () => {
  const writeText = vi.fn();
  const onRenameSession = vi.fn();
  const onDeleteSession = vi.fn();
  vi.stubGlobal('navigator', { clipboard: { writeText } });
  const target: SessionSummary = {
    agent: 'codex',
    actualSessionId: 'thread',
    id: '/rollout.jsonl',
    filePath: '/rollout.jsonl',
    projectId: '/repo',
    messageCount: 1,
    firstTimestampMs: 0,
    lastTimestampMs: 0,
    modifiedMs: 0,
    sizeBytes: 1,
  };
  const { rerender } = render(
    <SidebarContextMenu
      target={{
        kind: 'session',
        session: target,
      }}
      position={{
        x: 0,
        y: 0,
      }}
      onClose={vi.fn()}
      onCopied={vi.fn()}
      onDeleteProject={vi.fn()}
      onRenameSession={onRenameSession}
      onDeleteSession={onDeleteSession}
    />,
  );

  await userEvent.click(screen.getByText('Copy resume command'));
  expect(writeText).toHaveBeenCalledWith("codex resume 'thread'");

  rerender(
    <SidebarContextMenu
      target={{
        kind: 'session',
        session: target,
      }}
      position={{
        x: 0,
        y: 0,
      }}
      onClose={vi.fn()}
      onCopied={vi.fn()}
      onDeleteProject={vi.fn()}
      onRenameSession={onRenameSession}
      onDeleteSession={onDeleteSession}
    />,
  );
  await userEvent.click(screen.getByText('Rename session in Codex CLI'));
  expect(onRenameSession).toHaveBeenCalledWith(target);

  rerender(
    <SidebarContextMenu
      target={{
        kind: 'session',
        session: target,
      }}
      position={{
        x: 0,
        y: 0,
      }}
      onClose={vi.fn()}
      onCopied={vi.fn()}
      onDeleteProject={vi.fn()}
      onRenameSession={onRenameSession}
      onDeleteSession={onDeleteSession}
    />,
  );
  await userEvent.click(screen.getByText('Delete session'));
  expect(onDeleteSession).toHaveBeenCalledWith(target);
});

test('hides native mutation actions for read-only agents', () => {
  render(
    <SidebarContextMenu
      target={{
        kind: 'session',
        session: {
          agent: 'continue',
          actualSessionId: 'chat',
          id: 'chat',
          filePath: '/chat.json',
          projectId: '/repo',
          messageCount: 1,
          firstTimestampMs: 0,
          lastTimestampMs: 0,
          modifiedMs: 0,
          sizeBytes: 1,
        },
      }}
      position={{
        x: 0,
        y: 0,
      }}
      onClose={vi.fn()}
      onCopied={vi.fn()}
      onDeleteProject={vi.fn()}
      onRenameSession={vi.fn()}
      onDeleteSession={vi.fn()}
    />,
  );

  expect(screen.queryByText(/Rename session in/u)).toBeNull();
  expect(screen.queryByText('Delete session')).toBeNull();
  expect(screen.queryByText('Copy resume command')).toBeNull();
});
