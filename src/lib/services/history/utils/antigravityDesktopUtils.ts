/**
 * Antigravity desktop, whose store is `~/.gemini/antigravity/` and whose shape
 * is reverse engineered rather than documented by the vendor.
 *
 * ```text
 * ~/.gemini/antigravity/
 * ├── brain/<session-id>/        task.md, implementation_plan.md, walkthrough.md
 * │   └── manifest.json          stepCount
 * └── conversations/<id>.pb      protobuf, tool names readable as plain ASCII
 * ```
 *
 * There is no decryption and no `.proto` here. The session's own artifacts are
 * markdown, and the `.pb` carries its tool phrases as printable bytes, so
 * replacing everything unprintable with a space and matching the phrases reads
 * them without a schema. What this cannot give is a turn-by-turn transcript:
 * the store keeps the artifacts a session produced, not the conversation that
 * produced them, so a session reads as its task, its plan and its walkthrough.
 *
 * No desktop store exists on the dev machine, so this is written to the layout
 * above rather than checked against real data; see PLAN.md.
 */
import {
  readdir,
  readFile,
  stat,
} from 'node:fs/promises';
import { basename, join } from 'node:path';

import { appConfig } from '@config/appConfig';

import { isJsonObject, parseJsonContainer } from '@utils/jsonUtils';
import { humanPreview } from '@utils/titleUtils';

import { conversationMessageCount } from './outcomeUtils';

import type { AgentId } from '@config/agents';
import type {
  AssistantBlock,
  HistoryEntry,
  ProjectSummary,
  SessionSummary,
} from '../types';

interface DesktopSession {
  readonly id: string;
  readonly dir: string;
  readonly entries: readonly HistoryEntry[];
  readonly title: string | undefined;
  readonly preview: string;
  readonly timestampMs: number;
  readonly sizeBytes: number;
  readonly workspace: string | undefined;
}

interface Artifact {
  readonly name: string;
  readonly text: string;
  readonly modifiedMs: number;
}

const BRAIN = 'brain';
const CONVERSATIONS = 'conversations';
const MANIFEST = 'manifest.json';
const TASK = 'task.md';
const UNPLACED = 'unplaced';

/* Read in this order: the first heading found is the session's label. */
const ARTIFACTS = ['task.md', 'implementation_plan.md', 'walkthrough.md'];

/*
 * The tool phrases Antigravity writes into a conversation's protobuf as plain
 * text. The phrase is the handle: the enum around it has no published schema,
 * so there is nothing to decode it against.
 */
const TOOL_PHRASES: readonly (readonly [string, string])[] = [
  ['opening url', 'BrowserOpenUrl'],
  ['getting dom', 'BrowserGetDom'],
  ['getting console logs', 'BrowserGetConsoleLogs'],
  ['clicking', 'BrowserClick'],
  ['taking screenshot', 'BrowserScreenshot'],
  ['scrolling mouse wheel', 'BrowserScrollMouseWheel'],
];

const PRINTABLE_MIN = 32;
const PRINTABLE_MAX = 126;
const SPACE = 32;
const KEPT = new Set([9, 10, 13]);

const readable = (bytes: Uint8Array): string => {
  const cleaned = bytes.map((byte) => {
    return (byte >= PRINTABLE_MIN && byte <= PRINTABLE_MAX) || KEPT.has(byte) ? byte : SPACE;
  });

  return Buffer.from(cleaned).toString('latin1').toLowerCase();
};

const occurrences = (text: string, phrase: string): number => {
  return text.split(phrase).length - 1;
};

const toolBlocks = async (root: string, id: string): Promise<readonly AssistantBlock[]> => {
  try {
    const text = readable(await readFile(join(root, CONVERSATIONS, `${id}.pb`)));

    return TOOL_PHRASES.flatMap(([phrase, name]) => {
      return Array.from({ length: occurrences(text, phrase) }, (_unused, index) => {
        return {
          blockType: 'tool-use',
          call: {
            id: `${id}-${name}-${String(index)}`,
            name,
            input: {
              kind: 'generic',
              title: name,
              rows: [],
            },
          },
        } satisfies AssistantBlock;
      });
    });
  }
  catch {
    return [];
  }
};

const headingOf = (text: string): string | undefined => {
  for (const line of text.split('\n')) {
    const trimmed = line.trim();

    if (trimmed.startsWith('#')) {
      const heading = trimmed.replace(/^#+/, '').trim();

      if (heading.length > 0) {
        return heading;
      }
    }
  }

  return undefined;
};

const artifactsOf = async (dir: string): Promise<readonly Artifact[]> => {
  const read = await Promise.all(ARTIFACTS.map(async (name) => {
    try {
      const path = join(dir, name);
      const [text, info] = await Promise.all([readFile(path, 'utf8'), stat(path)]);
      const trimmed = text.trim();

      return trimmed.length === 0
        ? undefined
        : {
            name,
            text: trimmed,
            modifiedMs: info.mtimeMs,
          };
    }
    catch {
      return undefined;
    }
  }));

  return read.filter((artifact): artifact is Artifact => {
    return artifact != null;
  });
};

const workspaceOf = async (dir: string): Promise<string | undefined> => {
  try {
    const parsed = parseJsonContainer(await readFile(join(dir, MANIFEST), 'utf8'));
    const workspace = isJsonObject(parsed) ? parsed.workspace ?? parsed.workspacePath : undefined;

    return typeof workspace === 'string' && workspace.length > 0 ? workspace : undefined;
  }
  catch {
    return undefined;
  }
};

/*
 * The task is what the user asked for and the rest is what the agent produced,
 * which is the only division the artifacts support.
 */
const entriesOf = (
  id: string,
  artifacts: readonly Artifact[],
  tools: readonly AssistantBlock[],
  timestampMs: number,
): readonly HistoryEntry[] => {
  const timestamp = new Date(timestampMs).toISOString();
  const task = artifacts.find((artifact) => {
    return artifact.name === TASK;
  });
  const produced = artifacts.filter((artifact) => {
    return artifact.name !== TASK;
  });
  const blocks: readonly AssistantBlock[] = [
    ...produced.map((artifact) => {
      return {
        blockType: 'text',
        text: artifact.text,
      } satisfies AssistantBlock;
    }),
    ...tools,
  ];

  return [
    ...(task == null
      ? []
      : [{
        kind: 'user',
        uuid: `${id}-task`,
        timestamp,
        sidechain: false,
        meta: false,
        text: task.text,
        outcomes: [],
      } satisfies HistoryEntry]),
    ...(blocks.length === 0
      ? []
      : [{
        kind: 'assistant',
        uuid: `${id}-work`,
        timestamp,
        sidechain: false,
        blocks,
      } satisfies HistoryEntry]),
  ];
};

const sessionOf = async (root: string, id: string): Promise<DesktopSession | undefined> => {
  const dir = join(root, BRAIN, id);
  const [artifacts, tools, workspace] = await Promise.all([
    artifactsOf(dir),
    toolBlocks(root, id),
    workspaceOf(dir),
  ]);

  if (artifacts.length === 0) {
    return undefined;
  }

  // An artifact is written when the session does the work, so the newest is its clock.
  const timestampMs = artifacts.reduce((latest, artifact) => {
    return Math.max(latest, artifact.modifiedMs);
  }, 0);
  const entries = entriesOf(id, artifacts, tools, timestampMs);

  return {
    id,
    dir,
    entries,
    title: artifacts.reduce<string | undefined>((found, artifact) => {
      return found ?? headingOf(artifact.text);
    }, undefined),
    preview: artifacts.map((artifact) => {
      return artifact.text;
    }).join('\n\n'),
    timestampMs,
    sizeBytes: artifacts.reduce((total, artifact) => {
      return total + artifact.text.length;
    }, 0),
    workspace,
  };
};

const scan = async (roots: readonly string[]): Promise<readonly DesktopSession[]> => {
  const found = await Promise.all(roots.map(async (root) => {
    try {
      const dirs = await readdir(join(root, BRAIN), { withFileTypes: true });

      return await Promise.all(dirs.filter((dir) => {
        return dir.isDirectory();
      }).map(async (dir) => {
        return sessionOf(root, dir.name);
      }));
    }
    catch {
      return [];
    }
  }));

  return found.flat().filter((session): session is DesktopSession => {
    return session != null;
  });
};

const projectIdOf = (session: DesktopSession): string => {
  return session.workspace ?? UNPLACED;
};

export const listAntigravityDesktopSessions = async (
  agent: AgentId,
  roots: readonly string[],
  projectId?: string,
): Promise<readonly SessionSummary[]> => {
  const sessions = await scan(roots);

  return sessions.filter((session) => {
    return projectId == null || projectIdOf(session) === projectId;
  }).map((session) => {
    return {
      agent,
      id: session.id,
      actualSessionId: session.id,
      filePath: session.dir,
      projectId: projectIdOf(session),
      title: session.title,
      preview: humanPreview(session.preview, appConfig.previewLength),
      messageCount: conversationMessageCount(session.entries),
      firstTimestampMs: session.timestampMs,
      lastTimestampMs: session.timestampMs,
      modifiedMs: session.timestampMs,
      sizeBytes: session.sizeBytes,
      cwd: session.workspace,
    } satisfies SessionSummary;
  });
};

export const listAntigravityDesktopProjects = async (
  agent: AgentId,
  roots: readonly string[],
): Promise<readonly ProjectSummary[]> => {
  const sessions = await scan(roots);
  const byProject = new Map<string, DesktopSession[]>();

  for (const session of sessions) {
    const id = projectIdOf(session);
    const bucket = byProject.get(id) ?? [];

    bucket.push(session);
    byProject.set(id, bucket);
  }

  return [...byProject.entries()].map(([id, values]) => {
    const workspace = values.find((value) => {
      return value.workspace != null;
    })?.workspace;

    return {
      agent,
      id,
      name: workspace == null ? 'Unplaced conversations' : basename(workspace),
      actualPath: workspace,
      sessionCount: values.length,
      messageCount: values.reduce((total, value) => {
        return total + conversationMessageCount(value.entries);
      }, 0),
      lastActivityMs: values.reduce((latest, value) => {
        return Math.max(latest, value.timestampMs);
      }, 0),
    } satisfies ProjectSummary;
  });
};

// A desktop session is a directory of artifacts, where a CLI session is one file.
export const loadAntigravityDesktopEntries = async (
  dirPath: string,
): Promise<readonly HistoryEntry[] | undefined> => {
  try {
    if (!(await stat(dirPath)).isDirectory()) {
      return undefined;
    }
  }
  catch {
    return undefined;
  }

  // Artifacts are what makes a session, so one that reads at all has entries.
  return (await sessionOf(join(dirPath, '..', '..'), basename(dirPath)))?.entries;
};
