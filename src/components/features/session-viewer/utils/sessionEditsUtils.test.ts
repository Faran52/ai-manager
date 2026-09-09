import { editsInSession } from './sessionEditsUtils';

import type { EditedFile, EditKind } from '@services/edits/editsService';

const NOW = Date.parse('2026-08-28T12:00:00Z');

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
