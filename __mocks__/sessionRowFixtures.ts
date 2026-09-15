import type { SessionRowContext } from '@features/sidebar/partials/SessionListRow';
import type { SessionRow } from '@features/sidebar/utils/sessionThreadUtils';
import type { SessionSummary } from '@services/history/historyService';

// Shared by the row, thread group and list tests: one session, one row, one silent context.
export const fixtureSession = (id: string, overrides: Partial<SessionSummary> = {}): SessionSummary => {
  return {
    agent: 'claude',
    actualSessionId: id,
    id,
    filePath: `/r/${id}.jsonl`,
    projectId: 'p',
    title: `Session ${id}`,
    messageCount: 3,
    firstTimestampMs: 0,
    lastTimestampMs: Date.UTC(2026, 0, 2),
    modifiedMs: 0,
    sizeBytes: 8,
    ...overrides,
  };
};

export const fixtureRow = (id: string, overrides: Partial<SessionRow> = {}): SessionRow => {
  return {
    session: fixtureSession(id),
    threadKey: `thread-${id}`,
    partCount: 1,
    messageCount: 3,
    continuation: false,
    ...overrides,
  };
};

const noop = (): void => {
  return undefined;
};

export const fixtureContext = (overrides: Partial<SessionRowContext> = {}): SessionRowContext => {
  return {
    selectedFilePath: null,
    selecting: false,
    selectedPaths: [],
    expandedThreads: [],
    projectNames: null,
    nowMs: Date.UTC(2026, 0, 3),
    reduceMotion: true,
    onToggleThread: noop,
    onSelect: noop,
    onToggleSelection: noop,
    onOpenMenu: noop,
    ...overrides,
  };
};
