import {
  describe,
  expect,
  test,
} from 'vitest';

import { entriesToJson, entriesToMarkdown } from './exportService';

import type { HistoryEntry, ToolOutcome } from '../history/types';

const user: HistoryEntry = {
  kind: 'user',
  uuid: 'u1',
  timestamp: '2026-08-01T10:00:00Z',
  sidechain: false,
  meta: false,
  text: 'fix the login bug',
  outcomes: [
    {
      toolUseId: 'tu1',
      status: 'error',
      text: 'stack trace body',
      images: [],
      stderr: 'npm err!',
    },
  ],
};

const command: HistoryEntry = {
  kind: 'user',
  uuid: 'u2',
  timestamp: '2026-08-01T10:01:00Z',
  sidechain: false,
  meta: true,
  text: '',
  command: '/compact',
  outcomes: [],
};

const outcomeWith = (overrides: Partial<ToolOutcome> & { readonly toolUseId: string }): ToolOutcome => {
  return {
    status: 'ok',
    images: [],
    ...overrides,
  };
};

const assistant: HistoryEntry = {
  kind: 'assistant',
  uuid: 'a1',
  timestamp: '2026-08-01T10:02:00Z',
  sidechain: false,
  model: 'claude-sonnet-5',
  blocks: [
    {
      blockType: 'thinking',
      thinking: 'considering auth flow',
    },
    {
      blockType: 'text',
      text: 'Fixed the guard clause.',
    },
    {
      blockType: 'tool-use',
      call: {
        id: 'tu2',
        name: 'Edit',
        input: {
          kind: 'file-read',
          path: '/x.ts',
        },
      },
    },
  ],
};

const redacted: HistoryEntry = {
  kind: 'assistant',
  uuid: 'a2',
  timestamp: '2026-08-01T10:03:00Z',
  sidechain: false,
  blocks: [{ blockType: 'redacted' }],
};

const system: HistoryEntry = {
  kind: 'system',
  uuid: 's1',
  timestamp: '2026-08-01T10:04:00Z',
  sidechain: false,
  level: 'info',
  subtype: 'hook',
  text: 'hooks finished',
};

const summary: HistoryEntry = {
  kind: 'summary',
  text: 'Session about login fixes',
};

describe('entriesToMarkdown', () => {
  test('renders every entry kind into markdown sections', () => {
    const markdown = entriesToMarkdown(
      {
        title: 'Login fix',
        project: 'webapp',
        exportedAtMs: Date.UTC(2026, 0, 1),
      },
      [user, command, assistant, redacted, system, summary],
    );

    expect(markdown).toContain('# Login fix');
    expect(markdown).toContain('- Project: webapp');
    expect(markdown).toContain('- Exported: 2026-01-01T00:00:00.000Z');
    expect(markdown).toContain('### 🧑 User');
    expect(markdown).toContain('fix the login bug');
    expect(markdown).toContain('**tool result** (error)');
    expect(markdown).toContain('**stderr**');
    expect(markdown).toContain('### 🧑 Command');
    expect(markdown).toContain('```bash\n/compact\n```');
    expect(markdown).toContain('<details><summary>Thinking</summary>');
    expect(markdown).toContain('### 🤖 Assistant');
    expect(markdown).toContain('_redacted thinking_');
    expect(markdown).toContain('**tool: Edit**');
    expect(markdown).toContain('```json');
    expect(markdown).toContain('### ⚙️ System');
    expect(markdown).toContain('> Summary: Session about login fixes');
  });

  test('marks successful tool results without a status suffix', () => {
    const markdown = entriesToMarkdown(
      {
        title: 't',
        project: 'p',
        exportedAtMs: 0,
      },
      [{
        ...user,
        outcomes: [outcomeWith({
          toolUseId: 'tu1',
          text: 'stack trace body',
          stderr: 'npm err!',
        })],
      }],
    );

    expect(markdown).toContain('**tool result**\n');
    expect(markdown).not.toContain('(error)');
  });

  test('omits the user heading for result-only turns', () => {
    const markdown = entriesToMarkdown(
      {
        title: 't',
        project: 'p',
        exportedAtMs: 0,
      },
      [{
        ...user,
        text: '',
      }],
    );

    expect(markdown).not.toContain('### 🧑 User');
    expect(markdown).toContain('**tool result** (error)');
  });
});

describe('entriesToJson', () => {
  test('serialises entries as pretty JSON that parses back to the input', () => {
    const json = entriesToJson([user, summary]);
    const parsed: unknown = JSON.parse(json);

    expect(parsed).toEqual([user, summary]);
    expect(json.split('\n')[0]).toBe('[');
  });
});

describe('outcome-less tool results in markdown', () => {
  test('emits the status line even without payload text', () => {
    const bareOutcome: ToolOutcome = {
      toolUseId: 'tu1',
      status: 'error',
      images: [],
    };

    const markdown = entriesToMarkdown(
      {
        title: 't',
        project: 'p',
        exportedAtMs: 0,
      },
      [{
        ...user,
        outcomes: [bareOutcome],
      }],
    );

    expect(markdown).toContain('**tool result** (error)');
    expect(markdown).not.toContain('```text');
  });
});

describe('fence collisions and combined content', () => {
  test('lengthens the fence when tool output itself contains fences', () => {
    const markdown = entriesToMarkdown(
      {
        title: 't',
        project: 'p',
        exportedAtMs: 0,
      },
      [{
        ...user,
        outcomes: [outcomeWith({
          toolUseId: 'tu1',
          text: '```\nnested\n```',
        })],
      }],
    );

    expect(markdown).toContain('````text');
    expect(markdown).toContain('```\nnested\n```');
  });

  test('emits both the command and typed text for a command turn', () => {
    const markdown = entriesToMarkdown(
      {
        title: 't',
        project: 'p',
        exportedAtMs: 0,
      },
      [{
        ...command,
        text: 'fix the login bug',
      }],
    );

    expect(markdown).toContain('### 🧑 Command');
    expect(markdown).toContain('```bash\n/compact\n```');
    expect(markdown).toContain('### 🧑 User');
    expect(markdown).toContain('fix the login bug');
  });
});
