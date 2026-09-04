import type { HistoryEntry, ToolStatus } from '../history/types';

export interface ExportMeta {
  readonly title: string;
  readonly project: string;
  readonly exportedAtMs: number;
}

// Picks a fence longer than any backtick run in the body so tool output cannot terminate it early.
const fence = (language: string, body: string): string => {
  const longestRun = body.match(/`+/gu)?.reduce((best, run) => {
    return Math.max(best, run.length);
  }, 0) ?? 0;
  const marker = '`'.repeat(Math.max(3, longestRun + 1));

  return `${marker}${language}\n${body}\n${marker}`;
};

const userLines = (entry: Extract<HistoryEntry, { kind: 'user' }>): readonly string[] => {
  const lines: string[] = [];

  if (entry.command != null) {
    lines.push('### 🧑 Command', '', fence('bash', entry.command), '');
  }

  if (entry.text.length > 0) {
    lines.push('### 🧑 User', '', entry.text, '');
  }

  for (const outcome of entry.outcomes) {
    lines.push(`**tool result**${outcomeSuffix(outcome.status)}`, '');

    if (outcome.text != null) {
      lines.push(fence('text', outcome.text), '');
    }

    if (outcome.stderr != null) {
      lines.push('**stderr**', '', fence('text', outcome.stderr), '');
    }
  }

  return lines;
};

const outcomeSuffix = (status: ToolStatus): string => {
  return status === 'ok' ? '' : ` (${status})`;
};

const assistantLines = (entry: Extract<HistoryEntry, { kind: 'assistant' }>): readonly string[] => {
  return entry.blocks.flatMap((block) => {
    if (block.blockType === 'text') {
      return ['', '### 🤖 Assistant', '', block.text];
    }

    if (block.blockType === 'thinking') {
      return ['', '<details><summary>Thinking</summary>', '', block.thinking, '', '</details>'];
    }

    if (block.blockType === 'redacted') {
      return ['', '### 🤖 Assistant', '', '_redacted thinking_'];
    }

    return ['', `**tool: ${block.call.name}**`, '', fence('json', JSON.stringify(block.call.input, null, 2))];
  });
};

const entryLines = (entry: HistoryEntry): readonly string[] => {
  switch (entry.kind) {
    case 'user':
      return userLines(entry);
    case 'assistant':
      return assistantLines(entry);
    case 'system':
      return ['### ⚙️ System', '', entry.text];
    case 'summary':
      return [`> Summary: ${entry.text}`];
  }
};

export const entriesToMarkdown = (meta: ExportMeta, entries: readonly HistoryEntry[]): string => {
  const header = [
    `# ${meta.title}`,
    '',
    `- Project: ${meta.project}`,
    `- Exported: ${new Date(meta.exportedAtMs).toISOString()}`,
    `- Entries: ${String(entries.length)}`,
  ];

  const body = entries.flatMap((entry) => {
    return entryLines(entry);
  });

  return [...header, ...body, ''].join('\n');
};

export const entriesToJson = (entries: readonly HistoryEntry[]): string => {
  return JSON.stringify(entries, null, 2);
};

/*
 * Transcript text is arbitrary: it carries the HTML, script tags and quotes
 * that were discussed inside the session. Every value in the document goes
 * through here so none of it can become live markup. The ampersand is replaced
 * first, or it would re-encode the entities the later passes introduce.
 */
const escapeHtml = (value: string): string => {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
};

/*
 * Body text is written out as-is inside a pre-wrap block rather than parsed as
 * markdown. A parser would be a second renderer to keep in step with the one in
 * the app, and a faithful copy of what the transcript holds is what an export
 * is for.
 */
const block = (text: string): string => {
  return `<div class="body">${escapeHtml(text)}</div>`;
};

const pre = (text: string): string => {
  return `<pre>${escapeHtml(text)}</pre>`;
};

const DOCUMENT_STYLE = `
  :root { color-scheme: light dark; --fg: #1a1c20; --bg: #fbfbfa; --muted: #6b6862;
    --line: #e6e4e0; --card: #fff; --accent: #1f7a6d; --warn: #b26a15; }
  @media (prefers-color-scheme: dark) {
    :root { --fg: #e8e6e3; --bg: #16181c; --muted: #9a9691;
      --line: #2a2e35; --card: #1d2026; --accent: #2f9e8f; --warn: #d98a2b; }
  }
  * { box-sizing: border-box; }
  body { margin: 0 auto; padding: 2rem 1.25rem 4rem; max-width: 52rem; background: var(--bg);
    color: var(--fg); font: 15px/1.6 ui-sans-serif, system-ui, sans-serif; }
  h1 { font-size: 1.35rem; margin: 0 0 .75rem; }
  h2 { font-size: .7rem; letter-spacing: .08em; text-transform: uppercase;
    color: var(--muted); margin: 0 0 .4rem; font-weight: 600; }
  dl { display: grid; grid-template-columns: max-content 1fr; gap: .15rem .75rem;
    margin: 0 0 2rem; font-size: .8rem; color: var(--muted); }
  dt { font-weight: 600; }
  dd { margin: 0; }
  .turn { border-top: 1px solid var(--line); padding: 1.1rem 0; }
  .turn.assistant { }
  .body { white-space: pre-wrap; overflow-wrap: anywhere; }
  pre { background: var(--card); border: 1px solid var(--line); border-radius: .375rem;
    padding: .6rem .7rem; overflow-x: auto; font: 12.5px/1.5 ui-monospace, monospace; margin: .5rem 0; }
  details { margin: .5rem 0; }
  summary { cursor: pointer; color: var(--muted); font-size: .8rem; }
  .tool { color: var(--accent); font-size: .8rem; font-weight: 600; margin: .6rem 0 0; }
  .status { color: var(--warn); font-size: .75rem; }
  .summary-line { color: var(--muted); font-style: italic; }
`;

const userHtml = (entry: Extract<HistoryEntry, { kind: 'user' }>): readonly string[] => {
  const parts: string[] = ['<h2>User</h2>'];

  if (entry.command != null) {
    parts.push(pre(entry.command));
  }

  if (entry.text.length > 0) {
    parts.push(block(entry.text));
  }

  for (const outcome of entry.outcomes) {
    const suffix = escapeHtml(outcomeSuffix(outcome.status));

    parts.push(`<p class="tool">Tool result<span class="status">${suffix}</span></p>`);

    if (outcome.text != null) {
      parts.push(pre(outcome.text));
    }

    if (outcome.stderr != null) {
      parts.push('<p class="status">stderr</p>', pre(outcome.stderr));
    }
  }

  return parts;
};

const assistantHtml = (
  entry: Extract<HistoryEntry, { kind: 'assistant' }>,
): readonly string[] => {
  return entry.blocks.flatMap((entryBlock) => {
    if (entryBlock.blockType === 'text') {
      return ['<h2>Assistant</h2>', block(entryBlock.text)];
    }

    if (entryBlock.blockType === 'thinking') {
      return [`<details><summary>Thinking</summary>${block(entryBlock.thinking)}</details>`];
    }

    if (entryBlock.blockType === 'redacted') {
      return ['<h2>Assistant</h2>', '<p class="status">redacted thinking</p>'];
    }

    return [
      `<p class="tool">${escapeHtml(entryBlock.call.name)}</p>`,
      pre(JSON.stringify(entryBlock.call.input, null, 2)),
    ];
  });
};

const entryHtml = (entry: HistoryEntry): string => {
  switch (entry.kind) {
    case 'user':
      return `<article class="turn user">${userHtml(entry).join('')}</article>`;
    case 'assistant':
      return `<article class="turn assistant">${assistantHtml(entry).join('')}</article>`;
    case 'system':
      return `<article class="turn system"><h2>System</h2>${block(entry.text)}</article>`;
    case 'summary':
      return `<article class="turn"><p class="summary-line">${escapeHtml(entry.text)}</p></article>`;
  }
};

// One file that opens in a browser with no assets beside it, so a transcript
// can be read or sent on without the app that produced it.
export const entriesToHtml = (meta: ExportMeta, entries: readonly HistoryEntry[]): string => {
  return [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${escapeHtml(meta.title)}</title>`,
    `<style>${DOCUMENT_STYLE}</style>`,
    '</head>',
    '<body>',
    `<h1>${escapeHtml(meta.title)}</h1>`,
    '<dl>',
    `<dt>Project</dt><dd>${escapeHtml(meta.project)}</dd>`,
    `<dt>Exported</dt><dd>${new Date(meta.exportedAtMs).toISOString()}</dd>`,
    `<dt>Entries</dt><dd>${String(entries.length)}</dd>`,
    '</dl>',
    '<main>',
    ...entries.map((entry) => {
      return entryHtml(entry);
    }),
    '</main>',
    '</body>',
    '</html>',
    '',
  ].join('\n');
};
