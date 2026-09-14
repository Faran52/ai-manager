import {
  chmod,
  mkdir,
  mkdtemp,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  describe,
  expect,
  test,
} from 'vitest';

import {
  listOpenHandsProjects,
  listOpenHandsSessions,
  loadOpenHandsEntries,
} from './openHandsUtils';

import type { JsonValue } from '@utils/jsonUtils';

// Filenames and event shapes match OpenHands' own docs verbatim (MessageEvent
// carries role/content at the top level; ActionEvent/ObservationEvent do not).
const messageEvent = (n: number, role: string, content: JsonValue): [string, string] => {
  return [`event-${String(n).padStart(5, '0')}-a.json`, JSON.stringify({
    type: 'MessageEvent',
    id: `evt_${String(n)}`,
    timestamp: 1_767_225_600 + n,
    source: role === 'user' ? 'user' : 'agent',
    role,
    content,
  })];
};

describe('OpenHands event-file discovery', () => {
  test('groups a conversation\'s event files into one session, oldest to newest', async () => {
    const root = await mkdtemp(join(tmpdir(), 'openhands-'));
    const eventsDir = join(root, 'conversations', 'abc123', 'events');

    await mkdir(eventsDir, { recursive: true });
    const [userName, userJson] = messageEvent(1, 'user', 'Question');
    const [replyName, replyJson] = messageEvent(2, 'assistant', [{
      type: 'text',
      text: 'Answer',
    }]);

    await writeFile(join(eventsDir, userName), userJson);
    await writeFile(join(eventsDir, replyName), replyJson);
    // An ActionEvent/ObservationEvent pair: real per OpenHands' docs, but
    // neither carries a role, so the generic reader drops both untouched.
    await writeFile(join(eventsDir, 'event-00003-a.json'), JSON.stringify({
      type: 'ActionEvent',
      id: 'evt_3',
      timestamp: 1_767_225_603,
      source: 'agent',
      tool_name: 'bash',
      tool_input: { command: 'ls' },
    }));
    await writeFile(join(eventsDir, 'base_state.json'), JSON.stringify({ ignored: true }));

    const projects = await listOpenHandsProjects('openhands', [root]);
    const sessions = await listOpenHandsSessions('openhands', [root]);
    const entries = await loadOpenHandsEntries(sessions[0]?.filePath ?? '', [root]);

    expect(projects).toMatchObject([{
      agent: 'openhands',
      id: 'unknown',
      sessionCount: 1,
    }]);
    expect(sessions).toMatchObject([{
      agent: 'openhands',
      actualSessionId: 'abc123',
      projectId: 'unknown',
    }]);
    expect(entries).toMatchObject([
      {
        kind: 'user',
        text: 'Question',
      },
      {
        kind: 'assistant',
        blocks: [{
          blockType: 'text',
          text: 'Answer',
        }],
      },
    ]);
  });

  test('reads the older sessions/<id>/events layout the same way', async () => {
    const root = await mkdtemp(join(tmpdir(), 'openhands-v0-'));
    const eventsDir = join(root, 'sessions', 'legacy-1', 'events');

    await mkdir(eventsDir, { recursive: true });
    const [name, json] = messageEvent(1, 'user', 'Legacy question');

    await writeFile(join(eventsDir, name), json);

    const sessions = await listOpenHandsSessions('openhands', [root]);

    expect(sessions).toMatchObject([{ actualSessionId: 'legacy-1' }]);
  });

  test('names no preview for a conversation with no user message', async () => {
    const root = await mkdtemp(join(tmpdir(), 'openhands-nopreview-'));
    const eventsDir = join(root, 'conversations', 'no-user', 'events');

    await mkdir(eventsDir, { recursive: true });
    const [name, json] = messageEvent(1, 'assistant', [{
      type: 'text',
      text: 'Unprompted',
    }]);

    await writeFile(join(eventsDir, name), json);

    const sessions = await listOpenHandsSessions('openhands', [root]);

    expect(sessions).toMatchObject([{ preview: undefined }]);
  });

  test('reports no project when no conversation has any readable message', async () => {
    const root = await mkdtemp(join(tmpdir(), 'openhands-empty-'));
    const eventsDir = join(root, 'conversations', 'empty-1', 'events');

    await mkdir(eventsDir, { recursive: true });
    await writeFile(join(eventsDir, 'event-00001-a.json'), JSON.stringify({
      type: 'ActionEvent',
      id: 'evt_1',
      source: 'agent',
      tool_name: 'bash',
    }));

    expect(await listOpenHandsProjects('openhands', [root])).toEqual([]);
    expect(await listOpenHandsSessions('openhands', [root])).toEqual([]);
  });

  test('separates two conversations into two sessions under one project', async () => {
    const root = await mkdtemp(join(tmpdir(), 'openhands-multi-'));
    const first = join(root, 'conversations', 'first', 'events');
    const second = join(root, 'conversations', 'second', 'events');

    await mkdir(first, { recursive: true });
    await mkdir(second, { recursive: true });
    const [name1, json1] = messageEvent(1, 'user', 'First');
    const [name2, json2] = messageEvent(1, 'user', 'Second');

    await writeFile(join(first, name1), json1);
    await writeFile(join(second, name2), json2);

    const sessions = await listOpenHandsSessions('openhands', [root]);

    expect(sessions.map((session) => {
      return session.actualSessionId;
    }).sort((left, right) => {
      return left.localeCompare(right);
    })).toEqual(['first', 'second']);
  });

  test('answers nothing for a project id other than the one it uses', async () => {
    const root = await mkdtemp(join(tmpdir(), 'openhands-scope-'));

    expect(await listOpenHandsSessions('openhands', [root], 'some-other-project')).toEqual([]);
  });

  test('refuses to load entries from outside the allowed roots', async () => {
    const root = await mkdtemp(join(tmpdir(), 'openhands-outside-'));
    const outside = await mkdtemp(join(tmpdir(), 'openhands-elsewhere-'));
    const eventsDir = join(outside, 'conversations', 'abc', 'events');

    await mkdir(eventsDir, { recursive: true });
    const [name, json] = messageEvent(1, 'user', 'Question');

    await writeFile(join(eventsDir, name), json);

    expect(await loadOpenHandsEntries(join(eventsDir, name), [root])).toBeUndefined();
  });

  test('rejects a reference into an events directory with no matching files', async () => {
    const root = await mkdtemp(join(tmpdir(), 'openhands-nogroup-'));
    const eventsDir = join(root, 'conversations', 'ghost', 'events');
    const stray = join(eventsDir, 'not-an-event.json');

    await mkdir(eventsDir, { recursive: true });
    // Exists (so the allowed-roots check passes) but does not match the
    // event-NNNNN-<uuid>.json pattern, so eventGroups finds nothing for it.
    await writeFile(stray, '{}');

    expect(await loadOpenHandsEntries(stray, [root])).toBeUndefined();
  });

  test('rejects a path that is not inside an events directory', async () => {
    const root = await mkdtemp(join(tmpdir(), 'openhands-notevents-'));

    await writeFile(join(root, 'stray.json'), '{}');

    expect(await loadOpenHandsEntries(join(root, 'stray.json'), [root])).toBeUndefined();
  });

  test('tolerates a malformed event file', async () => {
    const root = await mkdtemp(join(tmpdir(), 'openhands-malformed-'));
    const eventsDir = join(root, 'conversations', 'bad', 'events');

    await mkdir(eventsDir, { recursive: true });
    const [name, json] = messageEvent(1, 'user', 'Question');

    await writeFile(join(eventsDir, name), json);
    await writeFile(join(eventsDir, 'event-00002-a.json'), 'not json');

    const sessions = await listOpenHandsSessions('openhands', [root]);

    expect(sessions).toMatchObject([{ actualSessionId: 'bad' }]);
  });

  test('tolerates an event file that cannot be read', async () => {
    const root = await mkdtemp(join(tmpdir(), 'openhands-unreadable-'));
    const eventsDir = join(root, 'conversations', 'locked', 'events');

    await mkdir(eventsDir, { recursive: true });
    const [name, json] = messageEvent(1, 'user', 'Question');
    const [name2, json2] = messageEvent(2, 'user', 'Locked out');
    const unreadable = join(eventsDir, name2);

    await writeFile(join(eventsDir, name), json);
    await writeFile(unreadable, json2);
    await chmod(unreadable, 0o000);

    const sessions = await listOpenHandsSessions('openhands', [root]);

    await chmod(unreadable, 0o600);
    expect(sessions).toMatchObject([{ actualSessionId: 'locked' }]);
  });
});
