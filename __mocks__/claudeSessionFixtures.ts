import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { RawHistoryLine } from '@services/history/utils/claudeRawUtils';

/*
 * A transcript on disk where a Claude root expects one. Three specs each wrote
 * this, two of them identically; the path comes back so the caller that needs
 * it does not rebuild the join by hand.
 */
export const writeSession = async (
  dir: string,
  projectId: string,
  fileName: string,
  lines: readonly (RawHistoryLine | string)[],
): Promise<string> => {
  const projectDir = join(dir, 'projects', projectId);

  await mkdir(projectDir, { recursive: true });
  const filePath = join(projectDir, fileName);

  await writeFile(filePath, lines.map((line) => {
    return JSON.stringify(line);
  }).join('\n'), 'utf8');

  return filePath;
};
