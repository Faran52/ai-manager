import {
  describe,
  expect,
  test,
} from 'vitest';

import {
  entriesToHtml,
  entriesToJson,
  entriesToMarkdown,
} from './exportService';

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

describe('entriesToHtml', () => {
  const meta = {
    title: 'Login fixes',
    project: '/repo/app',
    exportedAtMs: Date.parse('2026-08-01T12:00:00Z'),
  };
  const everyKind: readonly HistoryEntry[] = [
    user,
    command,
    assistant,
    redacted,
    system,
    summary,
  ];

  test('writes one file that stands on its own', () => {
    const html = entriesToHtml(meta, everyKind);

    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('<title>Login fixes</title>');
    expect(html).toContain('<dt>Project</dt><dd>/repo/app</dd>');
    expect(html).toContain('<dd>2026-08-01T12:00:00.000Z</dd>');
    expect(html).toContain('<dt>Entries</dt><dd>6</dd>');
    // Nothing to fetch beside it, so the file opens anywhere it is sent.
    expect(html).toContain('<style>');
    expect(html).not.toContain('<link');
  });

  test('carries every kind of turn across', () => {
    const html = entriesToHtml(meta, everyKind);

    expect(html).toContain('fix the login bug');
    expect(html).toContain('stack trace body');
    expect(html).toContain('npm err!');
    expect(html).toContain('/compact');
    expect(html).toContain('considering auth flow');
    expect(html).toContain('Fixed the guard clause.');
    expect(html).toContain('redacted thinking');
    expect(html).toContain('hooks finished');
    expect(html).toContain('Session about login fixes');
    expect(html).toContain('Tool result<span class="status"> (error)</span>');
  });

  test('escapes what the transcript discussed so none of it becomes markup', () => {
    const opener = '<b>';
    const closer = '</b>';
    const html = entriesToHtml({
      ...meta,
      project: 'a & b',
    }, [
      {
        kind: 'user',
        uuid: 'u9',
        timestamp: '2026-08-01T10:00:00Z',
        sidechain: false,
        meta: false,
        text: `${opener}live${closer}`,
        outcomes: [],
      },
      {
        kind: 'summary',
        text: "it's fine",
      },
    ]);

    expect(html).not.toContain(opener);
    expect(html).toContain('&lt;b&gt;live&lt;/b&gt;');
    expect(html).toContain('it&#39;s fine');
    // The ampersand pass runs first, so an entity is never encoded twice.
    expect(html).toContain('a &amp; b');
    expect(html).not.toContain('&amp;amp;');
  });

  test('leaves out a command, a body and a stderr the turn never had', () => {
    const html = entriesToHtml(meta, [{
      kind: 'user',
      uuid: 'u8',
      timestamp: '2026-08-01T10:00:00Z',
      sidechain: false,
      meta: false,
      text: '',
      outcomes: [outcomeWith({ toolUseId: 'tu8' })],
    }]);

    expect(html).toContain('Tool result');
    expect(html).not.toContain('<pre>');
    expect(html).not.toContain('stderr');
  });
});
