import {
  attributeValue,
  boardAttributes,
  buildBoardModel,
  editsInSession,
} from './boardUtils';

import type { EditedFile, EditKind } from '@services/edits/editsService';
import type { SessionSummary } from '@services/history/historyService';

const NOW = Date.parse('2026-08-28T12:00:00Z');

const session = (
  id: string,
  overrides: Partial<SessionSummary> = {},
): SessionSummary => {
  return {
    agent: 'claude',
    actualSessionId: id,
    id,
    filePath: `/sessions/${id}.jsonl`,
    projectId: 'p',
    messageCount: 10,
    firstTimestampMs: NOW - 3_600_000,
    lastTimestampMs: NOW,
    modifiedMs: NOW,
    sizeBytes: 1_000,
    ...overrides,
  };
};

test('offers every attribute the board can colour by', () => {
  expect(boardAttributes).toEqual(['messages', 'size', 'duration', 'recency']);
});

test('reads each attribute off a session', () => {
  const target = session('a', {
    messageCount: 4,
    sizeBytes: 900,
    firstTimestampMs: NOW - 60_000,
    lastTimestampMs: NOW - 30_000,
  });

  expect(attributeValue(target, 'messages', NOW)).toBe(4);
  expect(attributeValue(target, 'size', NOW)).toBe(900);
  expect(attributeValue(target, 'duration', NOW)).toBe(30_000);
  expect(attributeValue(target, 'recency', NOW)).toBe(30_000);
});

test('clamps a duration and an age that run backwards', () => {
  const backwards = session('a', {
    firstTimestampMs: NOW,
    lastTimestampMs: NOW - 1_000,
  });

  expect(attributeValue(backwards, 'duration', NOW)).toBe(0);
  expect(attributeValue(session('b', { lastTimestampMs: NOW + 5_000 }), 'recency', NOW)).toBe(0);
});

test('scales cells against the busiest session and sorts newest first', () => {
  const model = buildBoardModel(
    [
      session('quiet', {
        messageCount: 5,
        lastTimestampMs: NOW - 10_000,
      }),
      session('busy', {
        messageCount: 20,
        lastTimestampMs: NOW,
      }),
    ],
    'messages',
    NOW,
  );

  expect(model.max).toBe(20);
  expect(model.cells.map((cell) => {
    return cell.session.id;
  })).toEqual(['busy', 'quiet']);
  expect(model.cells[0]?.intensity).toBe(1);
  expect(model.cells[1]?.intensity).toBe(0.25);
});

test('inverts recency so the freshest session is brightest', () => {
  const model = buildBoardModel(
    [
      session('old', { lastTimestampMs: NOW - 100_000 }),
      session('new', { lastTimestampMs: NOW }),
    ],
    'recency',
    NOW,
  );

  expect(model.cells[0]?.session.id).toBe('new');
  expect(model.cells[0]?.intensity).toBe(1);
  expect(model.cells[1]?.intensity).toBe(0);
});

test('keeps every cell flat when nothing has a value', () => {
  const model = buildBoardModel([session('a', { messageCount: 0 })], 'messages', NOW);

  expect(model.max).toBe(0);
  expect(model.cells[0]?.intensity).toBe(0);
});

test('counts sessions per day and skips ones with no timestamp', () => {
  const model = buildBoardModel(
    [
      session('a', { lastTimestampMs: Date.parse('2026-08-26T09:00:00Z') }),
      session('b', { lastTimestampMs: Date.parse('2026-08-26T20:00:00Z') }),
      session('c', { lastTimestampMs: Date.parse('2026-08-27T09:00:00Z') }),
      session('d', { lastTimestampMs: 0 }),
    ],
    'messages',
    NOW,
  );

  expect(model.days).toEqual([
    {
      date: '2026-08-26',
      sessions: 2,
      intensity: 1,
    },
    {
      date: '2026-08-27',
      sessions: 1,
      intensity: 0.5,
    },
  ]);
});

test('has no days without sessions', () => {
  expect(buildBoardModel([], 'messages', NOW).days).toEqual([]);
});

const edited = (kind: EditKind, sessionFilePath: string, changes: number) => {
  return {
    kind,
    sessionId: sessionFilePath,
    sessionTitle: sessionFilePath,
    sessionFilePath,
    timestampMs: NOW,
    changes,
  };
};

const editedFile: EditedFile = {
  path: '/repo/src/a.ts',
  edits: 7,
  writes: 2,
  sessionCount: 3,
  lastEditedMs: NOW + 1000,
  recent: [edited('edit', '/sessions/mine.jsonl', 3), edited('write', '/sessions/theirs.jsonl', 1)],
};

test('hands back every file when no session is open', () => {
  expect(editsInSession([editedFile], undefined)).toEqual([editedFile]);
});

test('keeps only what the open session changed and recounts it', () => {
  expect(editsInSession([editedFile], '/sessions/mine.jsonl')).toEqual([{
    ...editedFile,
    edits: 3,
    writes: 0,
    sessionCount: 1,
    lastEditedMs: NOW,
    recent: [edited('edit', '/sessions/mine.jsonl', 3)],
  }]);
});

test('drops a file the open session never touched', () => {
  expect(editsInSession([editedFile], '/sessions/nobody.jsonl')).toEqual([]);
});
