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
  listStructuredProjects,
  listStructuredSessions,
  loadStructuredEntries,
  parseStructuredHistory,
  scanStructuredSessions,
} from './structuredUtils';

const stamp = Date.parse('2026-01-01T00:00:00Z');

describe('parseStructuredHistory', () => {
  test('parses nested JSON roles, content shapes, ids, models, and timestamps', () => {
    const entries = parseStructuredHistory(JSON.stringify({
      conversation: {
        messages: [
          {
            id: 'u',
            sender: 'human',
            content: [{ text: 'Hello' }],
            created_at: 1_700_000_000,
          },
          {
            messageId: 'a',
            author: 'bot',
            message: { content: { value: 'Hi' } },
            modelId: 'm',
          },
          {
            uuid: 's',
            type: 'system_notice',
            text: 'Notice',
            date: '2026-01-02T00:00:00Z',
          },
          {
            role: 'unknown',
            text: 'skip',
          },
          {
            role: 'user',
            content: '',
          },
          {
            role: 'user',
            message: { text: 'Nested text' },
          },
          {
            role: 'user',
            content: { parts: ['Object parts'] },
          },
          {
            role: 'user',
            content: 42,
          },
        ],
      },
    }), '.json', stamp);

    expect(entries).toHaveLength(5);
    expect(entries[0]).toMatchObject({
      kind: 'user',
      uuid: 'u',
      text: 'Hello',
    });
    expect(entries[1]).toMatchObject({
      kind: 'assistant',
      uuid: 'a',
      model: 'm',
    });
    expect(entries[2]).toMatchObject({
      kind: 'system',
      uuid: 's',
      text: 'Notice',
    });
    expect(entries[3]).toMatchObject({
      kind: 'user',
      text: 'Nested text',
    });
    expect(entries[4]).toMatchObject({
      kind: 'user',
      text: 'Object parts',
    });
  });

  test('parses JSONL while skipping malformed and unrelated values', () => {
    const content = [
      '',
      '{bad',
      JSON.stringify(null),
      JSON.stringify({
        entries: [{
          role: 'model',
          parts: ['answer'],
          time: 1_800_000_000_000,
        }],
      }),
    ].join('\n');

    expect(parseStructuredHistory(content, '.jsonl', stamp)).toMatchObject([
      {
        kind: 'assistant',
        blocks: [{ text: 'answer' }],
      },
    ]);
    expect(parseStructuredHistory('{bad', '.json', stamp)).toEqual([]);
    expect(parseStructuredHistory(JSON.stringify({ other: [] }), '.json', stamp)).toEqual([]);
    expect(parseStructuredHistory(JSON.stringify({
      messages: [],
      items: [{
        role: 'user',
        text: 'later',
      }],
    }),
    '.json', stamp)).toHaveLength(1);
    expect(parseStructuredHistory(JSON.stringify({
      count: 1,
      broken: '{bad',
      payload: {
        unknown: [{
          role: 'user',
          text: 'deep value',
        }],
      },
    }), '.json', stamp)).toHaveLength(1);
  });

  test('parses labelled Markdown and falls back to a user entry', () => {
    const labelled = parseStructuredHistory('# Human\nQuestion\n## Assistant\nAnswer', '.md', stamp);

    expect(labelled).toMatchObject([
      {
        kind: 'user',
        text: 'Question',
      },
      {
        kind: 'assistant',
        blocks: [{ text: 'Answer' }],
      },
    ]);
    expect(parseStructuredHistory('plain transcript', '.txt', stamp)).toMatchObject([{ kind: 'user' }]);
    expect(parseStructuredHistory('   ', '.md', stamp)).toEqual([]);
    expect(parseStructuredHistory('# User', '.md', stamp)).toEqual([]);
  });
});

describe('structured history discovery', () => {
  test('discovers, groups, sorts, and loads supported files', async () => {
    const root = await mkdtemp(join(tmpdir(), 'structured-'));
    const project = join(root, 'workspace');
    const content = JSON.stringify({
      messages: [{
        role: 'user',
        content: 'Prompt',
      }],
    });

    await mkdir(join(project, 'nested'), { recursive: true });
    await mkdir(join(root, 'node_modules', 'ignored'), { recursive: true });
    await mkdir(join(root, '.git'), { recursive: true });
    await writeFile(join(project, 'chat.json'), content);
    await writeFile(join(project, 'chat-two.json'), content);
    await writeFile(join(project, 'nested', 'chat.ndjson'), JSON.stringify({
      role: 'assistant',
      content: 'Answer',
    }));
    await writeFile(join(project, 'empty.json'), '{}');
    const unreadable = join(project, 'unreadable.json');

    await writeFile(unreadable, content);
    await chmod(unreadable, 0o000);
    await writeFile(join(project, 'skip.bin'), content);
    await writeFile(join(root, 'node_modules', 'ignored', 'chat.json'), content);
    await writeFile(join(root, '.git', 'chat.json'), content);

    const scanned = await scanStructuredSessions('continue', [root, '/missing']);
    const projects = await listStructuredProjects('continue', [root]);
    const sessions = await listStructuredSessions('continue', [root], 'workspace');

    expect(scanned).toHaveLength(3);
    expect(projects).toHaveLength(2);
    expect(sessions).toHaveLength(2);
    expect(await loadStructuredEntries(sessions[0]?.filePath ?? '')).toHaveLength(1);
    expect(await loadStructuredEntries('/missing')).toBeUndefined();
    expect(await listStructuredSessions('continue', [root], 'missing')).toEqual([]);

    await chmod(unreadable, 0o600);
  });

  test('reads Copilot chats and names the project from the VS Code workspace record', async () => {
    const root = await mkdtemp(join(tmpdir(), 'copilot-'));
    const hash = join(root, '9fa0945785b814c4270202c4499da08f');
    const transcripts = join(hash, 'GitHub.copilot-chat', 'transcripts');

    await mkdir(transcripts, { recursive: true });
    await mkdir(join(hash, 'chatSessions'), { recursive: true });
    await mkdir(join(hash, 'GitHub.copilot-chat', 'chat-session-resources'), { recursive: true });
    await writeFile(join(hash, 'workspace.json'), JSON.stringify({ folder: 'file:///Users/dev/my-app' }));
    await writeFile(join(transcripts, 'chat.jsonl'), [
      JSON.stringify({
        type: 'session.start',
        data: { sessionId: 'a' },
      }),
      JSON.stringify({
        type: 'user.message',
        data: { content: 'Ship it' },
      }),
      JSON.stringify({
        type: 'assistant.message',
        data: { content: 'Done' },
      }),
      JSON.stringify({
        type: 'tool.execution_start',
        data: { name: 'read' },
      }),
    ].join('\n'));
    await writeFile(
      join(hash, 'chatSessions', 'panel.jsonl'),
      JSON.stringify({
        role: 'user',
        content: 'From the panel',
      }),
    );
    await writeFile(
      join(hash, 'GitHub.copilot-chat', 'chat-session-resources', 'blob.jsonl'),
      JSON.stringify({
        role: 'user',
        content: 'An attachment, not a chat',
      }),
    );

    const scanned = await scanStructuredSessions('copilot', [root]);
    const projects = await listStructuredProjects('copilot', [root]);

    expect(scanned).toHaveLength(2);
    expect(projects.map((project) => {
      return project.name;
    })).toEqual(['my-app', 'my-app']);
    expect(scanned.flatMap((session) => {
      return session.entries.map((entry) => {
        return entry.kind === 'assistant' ? `assistant:${JSON.stringify(entry.blocks)}` : `${entry.kind}:${entry.text}`;
      });
    })).toEqual([
      'user:Ship it',
      'assistant:[{"blockType":"text","text":"Done"}]',
      'user:From the panel',
    ]);
  });

  test('falls back to the containing folder when the workspace record is unusable', async () => {
    const root = await mkdtemp(join(tmpdir(), 'copilot-bare-'));
    const transcripts = join(root, 'hash', 'GitHub.copilot-chat', 'transcripts');

    await mkdir(transcripts, { recursive: true });
    await writeFile(join(root, 'hash', 'GitHub.copilot-chat', 'workspace.json'), '[]');
    await writeFile(join(root, 'hash', 'workspace.json'), JSON.stringify({ folder: 42 }));
    await writeFile(
      join(transcripts, 'chat.jsonl'),
      JSON.stringify({
        type: 'user.message',
        data: { content: 'Orphan' },
      }),
    );

    const scanned = await scanStructuredSessions('copilot', [root]);

    expect(scanned[0]?.summary.cwd).toBe(transcripts);
  });

  test('supports a direct file root and Aider filename filtering', async () => {
    const root = await mkdtemp(join(tmpdir(), 'aider-'));
    const accepted = join(root, '.aider.chat.history.md');

    await writeFile(accepted, '# User\nFix it');
    await writeFile(join(root, '.aider.history.jsonl'), JSON.stringify({
      role: 'user',
      content: 'JSONL',
    }));
    await writeFile(join(root, 'other.md'), '# User\nIgnore it');

    expect(await scanStructuredSessions('aider', [accepted])).toHaveLength(1);
    expect(await scanStructuredSessions('aider', [root])).toHaveLength(2);
    expect(await scanStructuredSessions('aider', [join(root, 'other.md')])).toEqual([]);
  });
});
