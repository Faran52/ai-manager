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
