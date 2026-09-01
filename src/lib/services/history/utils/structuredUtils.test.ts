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
            message: { text: 'Nested text\n<environment_context>hidden</environment_context>' },
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
      injectedText: '<environment_context>hidden</environment_context>',
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
    const lockedDir = join(root, 'locked');

    await writeFile(unreadable, content);
    await chmod(unreadable, 0o000);
    await mkdir(lockedDir, { recursive: true });
    await writeFile(join(lockedDir, 'chat.json'), content);
    await chmod(lockedDir, 0o000);
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
    await chmod(lockedDir, 0o700);
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

  test('reads one session per Cline task and names the extension that wrote it', async () => {
    const home = await mkdtemp(join(tmpdir(), 'cline-'));
    const root = join(home, 'saoudrizwan.claude-dev', 'tasks');
    const task = join(root, '1767225600000');

    await mkdir(task, { recursive: true });
    await writeFile(join(task, 'api_conversation_history.json'), JSON.stringify([
      {
        role: 'user',
        content: [{
          type: 'text',
          text: 'Rename the module',
        }],
      },
      {
        role: 'assistant',
        content: [{
          type: 'text',
          text: 'Renamed it',
        }],
      },
    ]));
    await writeFile(join(task, 'ui_messages.json'), JSON.stringify([
      {
        ts: 1_767_225_600_000,
        type: 'say',
        say: 'text',
        text: 'Rename the module',
      },
    ]));
    await writeFile(join(task, 'task_metadata.json'), JSON.stringify({ files_in_context: [] }));

    const sessions = await listStructuredSessions('cline', [root], 'saoudrizwan.claude-dev');
    const projects = await listStructuredProjects('cline', [root]);

    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.id).toBe('1767225600000');
    expect(sessions[0]?.preview).toBe('Rename the module');
    expect(projects).toHaveLength(1);
    expect(projects[0]?.name).toBe('Cline');
  });

  test('keeps each Cline fork as its own project', async () => {
    const home = await mkdtemp(join(tmpdir(), 'forks-'));
    const transcript = JSON.stringify([{
      role: 'user',
      content: 'Hello',
    }]);

    const roots: string[] = [];

    for (const extension of ['rooveterinaryinc.roo-cline', 'kilocode.kilo-code']) {
      const root = join(home, extension, 'tasks');
      const task = join(root, '1767225600001');

      await mkdir(task, { recursive: true });
      await writeFile(join(task, 'api_conversation_history.json'), transcript);
      roots.push(root);
    }

    const projects = await listStructuredProjects('cline', roots);

    expect(projects.map((project) => {
      return project.name;
    }).sort((left, right) => {
      return left.localeCompare(right);
    })).toEqual(['Kilo Code', 'Roo Code']);
  });
});
