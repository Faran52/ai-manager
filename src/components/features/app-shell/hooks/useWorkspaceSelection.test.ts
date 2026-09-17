import { act, renderHook } from '@testing-library/react';
import {
  describe,
  expect,
  test,
  vi,
} from 'vitest';

import { useWorkspaceSelection } from './useWorkspaceSelection';

import type { ProjectSummary, SessionSummary } from '@services/history/historyService';

interface ShowSession {
  readonly showSession: ReturnType<typeof vi.fn>;
}

type Harness = ReturnType<typeof renderHook<ReturnType<typeof useWorkspaceSelection>, never>> & ShowSession;

const PROJECT: ProjectSummary = {
  agent: 'claude',
  id: 'p',
  name: 'webapp',
  sessionCount: 1,
  messageCount: 1,
  lastActivityMs: 0,
};

const SESSION: SessionSummary = {
  agent: 'claude',
  actualSessionId: 's',
  id: 's',
  filePath: '/r/s.jsonl',
  projectId: 'p',
  messageCount: 1,
  firstTimestampMs: 0,
  lastTimestampMs: 0,
  modifiedMs: 0,
  sizeBytes: 1,
};

const STAMP = Date.UTC(2026, 0, 2);

const setup = (): Harness => {
  const showSession = vi.fn();
  const hook = renderHook(() => {
    return useWorkspaceSelection([PROJECT], showSession);
  });

  return {
    ...hook,
    showSession,
  };
};

describe('useWorkspaceSelection', () => {
  test('a project, All Projects and a report agent each clear the other two', () => {
    const { result } = setup();

    act(() => {
      result.current.selectSession(SESSION);
    });
    expect(result.current.selectedProject).toEqual(PROJECT);
    expect(result.current.selectedFilePath).toBe(SESSION.filePath);

    act(() => {
      result.current.selectReportAgent('codex');
    });
    expect(result.current.selectedProject).toBeNull();
    expect(result.current.selectedFilePath).toBeNull();
    expect(result.current.reportScope).toEqual({
      agent: 'codex',
      profile: undefined,
    });

    act(() => {
      result.current.selectReportAgent('codex');
    });
    expect(result.current.reportScope).toBeNull();

    act(() => {
      result.current.selectReportAgent('claude', 'work');
      result.current.selectProject(PROJECT);
    });
    expect(result.current.reportScope).toBeNull();
    expect(result.current.selectedProject).toEqual(PROJECT);

    act(() => {
      result.current.selectAllProjects();
    });
    expect(result.current.selectedProject).toBeNull();
  });

  test('every way into a transcript lands on the Sessions view with its highlight', () => {
    const { result, showSession } = setup();

    act(() => {
      result.current.jumpToHit({
        agent: 'claude',
        filePath: '/r/s.jsonl',
        projectId: 'p',
        sessionId: 's',
        role: 'user',
        timestampMs: STAMP,
        before: '',
        match: 'x',
        after: '',
      });
    });
    expect(result.current.selectedProject).toEqual(PROJECT);
    expect(result.current.highlightTimestamp).toBe(new Date(STAMP).toISOString());

    act(() => {
      result.current.openEditedSession({
        kind: 'edit',
        sessionId: 's',
        sessionTitle: 'Edit',
        sessionFilePath: '/r/e.jsonl',
        timestampMs: STAMP,
        changes: 1,
      });
    });
    expect(result.current.selectedFilePath).toBe('/r/e.jsonl');

    act(() => {
      result.current.openStatsSession({
        filePath: '/r/t.jsonl',
        sessionId: 't',
        tokens: 1,
        messages: 1,
        lastTimestampMs: STAMP,
        projectId: 'missing',
        agent: 'claude',
      });
    });
    expect(result.current.selectedProject).toBeNull();
    expect(result.current.selectedFilePath).toBe('/r/t.jsonl');

    act(() => {
      result.current.openArchivedSession({
        agent: 'claude',
        projectId: 'p',
        projectName: 'webapp',
        actualSessionId: 's',
        title: 'Old',
        messageCount: 1,
        lastTimestampMs: 0,
        sizeBytes: 1,
        sourcePath: '/r/s.jsonl',
        archivePath: '/a/s.jsonl',
      });
    });
    expect(result.current.archivedSession?.title).toBe('Old');
    expect(result.current.selectedFilePath).toBe('/a/s.jsonl');
    expect(result.current.highlightTimestamp).toBeUndefined();
    expect(showSession).toHaveBeenCalledTimes(4);
  });
});
