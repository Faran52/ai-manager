import {
  readdir,
  readFile,
  stat,
} from 'node:fs/promises';
import { basename, join } from 'node:path';

import { appConfig } from '@config/appConfig';

import { LruCache } from '@utils/lruCacheUtils';
import { humanPreview, humanTitle } from '@utils/titleUtils';

import { parseHistoryLine } from '../../session/utils/parserUtils';
import {
  ASSISTANT_MARKER,
  CWD_PREFIX,
  JSONL_SUFFIX,
  SIDECHAIN_MARKER,
  SUMMARY_MARKER,
  TIMESTAMP_PREFIX,
  TITLE_MARKER,
  USER_MARKER,
} from '../constants';

import type { Dirent } from 'node:fs';
import type { ProjectSummary, SessionSummary } from '../types';

interface SessionMeta {
  readonly customTitle?: string | undefined;
  readonly summary?: string | undefined;
  readonly preview?: string | undefined;
  readonly messageCount: number;
  readonly firstTimestampMs: number;
  readonly lastTimestampMs: number;
  readonly cwd?: string | undefined;
}

interface FileFacts {
  readonly mtimeMs: number;
  readonly sizeBytes: number;
}

interface CacheEntry {
  readonly facts: FileFacts;
  readonly meta: SessionMeta;
}

interface RawTitleLine {
  readonly customTitle?: string | undefined;
}

interface MetaScan {
  messageCount: number;
  firstTimestampMs: number;
  lastTimestampMs: number;
  summary?: string | undefined;
  customTitle?: string | undefined;
  preview?: string | undefined;
  cwd?: string | undefined;
}

const isRawLine = (value: unknown): value is RawTitleLine => {
  return typeof value === 'object' && value !== null;
};

const cache = new LruCache<CacheEntry>(512);

const truncateCwd = (cwd: string | undefined): string | undefined => {
  return cwd != null && cwd.length > 0 ? cwd : undefined;
};

const fallbackProjectName = (projectId: string): string => {
  const lastSegment = projectId.replace(/^-/, '').split('-').at(-1);

  return lastSegment != null && lastSegment.length > 0 ? lastSegment : projectId;
};

const fileFacts = async (filePath: string): Promise<FileFacts | undefined> => {
  try {
    const info = await stat(filePath);

    return {
      mtimeMs: info.mtimeMs,
      sizeBytes: info.size,
    };
  }
  catch {
    return undefined;
  }
};

const quotedValue = (line: string, prefix: string): string | undefined => {
  const start = line.indexOf(prefix);

  if (start < 0) {
    return undefined;
  }

  const from = start + prefix.length;
  const end = line.indexOf('"', from);

  return end < 0 ? undefined : line.slice(from, end);
};

const newScan = (): MetaScan => {
  return {
    messageCount: 0,
    firstTimestampMs: Number.POSITIVE_INFINITY,
    lastTimestampMs: 0,
  };
};

const updateStamps = (scan: MetaScan, rawLine: string): void => {
  const stampValue = quotedValue(rawLine, TIMESTAMP_PREFIX);

  if (stampValue == null) {
    return;
  }

  const stamp = Date.parse(stampValue);

  if (Number.isNaN(stamp)) {
    return;
  }

  scan.firstTimestampMs = Math.min(scan.firstTimestampMs, stamp);
  scan.lastTimestampMs = Math.max(scan.lastTimestampMs, stamp);
};

const titleFromLine = (rawLine: string): string | undefined => {
  try {
    const value: unknown = JSON.parse(rawLine);

    // v8 ignore next -- unreachable by construction
    return isRawLine(value) ? humanTitle(value.customTitle) : undefined;
  }
  catch {
    return undefined;
  }
};

const isTurnLine = (rawLine: string): boolean => {
  return rawLine.includes(USER_MARKER) || rawLine.includes(ASSISTANT_MARKER);
};

const absorbLine = (scan: MetaScan, rawLine: string): void => {
  if (rawLine.length === 0) {
    return;
  }

  updateStamps(scan, rawLine);
  scan.cwd ??= quotedValue(rawLine, CWD_PREFIX);

  if (rawLine.includes(SUMMARY_MARKER)) {
    const entry = parseHistoryLine(rawLine);

    // v8 ignore next -- unreachable by construction
    if (entry?.kind === 'summary') {
      scan.summary = humanTitle(entry.text);
    }

    return;
  }

  if (rawLine.includes(TITLE_MARKER)) {
    scan.customTitle ??= titleFromLine(rawLine);
    return;
  }

  if (!isTurnLine(rawLine) || rawLine.includes(SIDECHAIN_MARKER)) {
    return;
  }

  scan.messageCount += 1;

  if (scan.preview == null && rawLine.includes(USER_MARKER)) {
    scan.preview = genuineUserPreview(rawLine);
  }
};

const extractSessionMeta = (content: string): SessionMeta => {
  const scan = newScan();

  for (const rawLine of content.split('\n')) {
    absorbLine(scan, rawLine);
  }

  return {
    customTitle: scan.customTitle,
    summary: scan.summary,
    preview: scan.preview,
    messageCount: scan.messageCount,
    firstTimestampMs: Number.isFinite(scan.firstTimestampMs) ? scan.firstTimestampMs : 0,
    lastTimestampMs: scan.lastTimestampMs,
    cwd: truncateCwd(scan.cwd),
  };
};

const genuineUserPreview = (rawLine: string): string | undefined => {
  const entry = parseHistoryLine(rawLine);

  if (entry?.kind !== 'user' || entry.meta || entry.command != null) {
    return undefined;
  }

  const text = entry.text.trim();

  if (text.length === 0 || text.startsWith('<') || text.startsWith('/') || text.startsWith('!')) {
    return undefined;
  }

  return humanPreview(text.replace(/\s+/gu, ' '), appConfig.previewLength);
};

const sessionMetaFor = async (filePath: string): Promise<SessionMeta | undefined> => {
  const facts = await fileFacts(filePath);

  if (facts == null) {
    return undefined;
  }

  const cached: CacheEntry | undefined = cache.get(filePath);

  if (cached?.facts.mtimeMs === facts.mtimeMs && cached.facts.sizeBytes === facts.sizeBytes) {
    return cached.meta;
  }

  let content = '';

  try {
    content = await readFile(filePath, 'utf8');
  }
  catch {
    return undefined;
  }

  const meta = extractSessionMeta(content);

  cache.set(filePath, {
    facts,
    meta,
  });

  return meta;
};

export const listSessions = async (
  claudeDir: string,
  projectId: string,
): Promise<readonly SessionSummary[]> => {
  const projectDir = join(claudeDir, 'projects', projectId);
  const summaries: SessionSummary[] = [];

  let files: readonly string[] = [];

  try {
    files = await readdir(projectDir);
  }
  catch {
    return summaries;
  }

  for (const fileName of files) {
    if (!fileName.endsWith(JSONL_SUFFIX)) {
      continue;
    }

    const filePath = join(projectDir, fileName);
    const meta = await sessionMetaFor(filePath);
    const facts = await fileFacts(filePath);

    if (meta == null || facts == null || meta.messageCount === 0) {
      continue;
    }

    summaries.push({
      agent: 'claude',
      actualSessionId: fileName.slice(0, -JSONL_SUFFIX.length),
      id: fileName.slice(0, -JSONL_SUFFIX.length),
      filePath,
      projectId,
      title: meta.customTitle,
      summary: meta.summary,
      preview: meta.preview,
      messageCount: meta.messageCount,
      firstTimestampMs: meta.firstTimestampMs,
      lastTimestampMs: Math.max(meta.lastTimestampMs, facts.mtimeMs),
      modifiedMs: facts.mtimeMs,
      sizeBytes: facts.sizeBytes,
      cwd: meta.cwd,
    });
  }

  return summaries.sort((left, right) => {
    return right.lastTimestampMs - left.lastTimestampMs;
  });
};

export const listProjects = async (claudeDir: string): Promise<readonly ProjectSummary[]> => {
  const projectsDir = join(claudeDir, 'projects');
  const summaries: ProjectSummary[] = [];

  let dirents: Dirent[] = [];

  try {
    dirents = await readdir(projectsDir, { withFileTypes: true });
  }
  catch {
    return summaries;
  }

  const projectIds = dirents.filter((dirent) => {
    return dirent.isDirectory();
  }).map((dirent) => {
    return dirent.name;
  });

  for (const projectId of projectIds) {
    const sessions = await listSessions(claudeDir, projectId);

    if (sessions.length === 0) {
      continue;
    }

    const actualPath = sessions.find((session) => {
      return session.cwd != null;
    })?.cwd;

    summaries.push({
      agent: 'claude',
      id: projectId,
      name: actualPath != null ? basename(actualPath) : fallbackProjectName(projectId),
      actualPath,
      sessionCount: sessions.length,
      messageCount: sessions.reduce((total, session) => {
        return total + session.messageCount;
      }, 0),
      lastActivityMs: sessions.reduce((latest, session) => {
        return Math.max(latest, session.lastTimestampMs);
      }, 0),
    });
  }

  return summaries.sort((left, right) => {
    return right.lastActivityMs - left.lastActivityMs;
  });
};
