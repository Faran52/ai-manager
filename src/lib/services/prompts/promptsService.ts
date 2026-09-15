import {
  readFile,
  rename,
  writeFile,
} from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

import { isJsonObject, parseJsonContainer } from '@utils/jsonUtils';

interface RawPrompt {
  readonly sessionId: string;
}

/**
 * Claude Code appends every prompt here and never prunes it, so it outlives the
 * transcripts themselves. Reading it is Search's job now, over the transcripts;
 * what is left here is keeping the record honest when one is deleted.
 */
const HISTORY_FILE = 'history.jsonl';

const claudeHome = (home: string = homedir()): string => {
  return join(home, '.claude');
};

const promptFrom = (line: string): RawPrompt | undefined => {
  const parsed = parseJsonContainer(line);

  if (!isJsonObject(parsed)
    || typeof parsed.display !== 'string' || parsed.display.length === 0
    || typeof parsed.project !== 'string'
    || typeof parsed.sessionId !== 'string'
    || typeof parsed.timestamp !== 'number') {
    return undefined;
  }

  return { sessionId: parsed.sessionId };
};

/*
 * A record outliving its transcript is the point where an agent pruned it, and
 * an orphan where someone deleted it on purpose. The rewrite goes through a
 * neighbouring file and a rename: a half-written record is worse than a stale one.
 */
export const forgetSessionPrompts = async (
  sessionId: string,
  home?: string,
): Promise<number> => {
  const path = join(claudeHome(home), HISTORY_FILE);
  let content: string;

  try {
    content = await readFile(path, 'utf8');
  }
  catch {
    return 0;
  }

  const lines = content.split('\n');
  const kept = lines.filter((line) => {
    const prompt = promptFrom(line);

    return prompt?.sessionId !== sessionId;
  });

  if (kept.length === lines.length) {
    return 0;
  }

  const pending = `${path}.rewriting`;

  await writeFile(pending, kept.join('\n'), 'utf8');
  await rename(pending, path);

  return lines.length - kept.length;
};
