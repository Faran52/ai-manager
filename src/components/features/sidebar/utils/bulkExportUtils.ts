import { fetchMessages } from '@lib/apis/apiClient';
import { entriesToMarkdown } from '@services/export/exportService';

import type { HistoryEntry, SessionSummary } from '@services/history/historyService';

export interface BulkExport {
  readonly markdown: string;
  // Sessions whose transcript could not be read, so the file says what is missing.
  readonly failed: number;
}

/**
 * A transcript arrives a page at a time and an export wants all of it, so this
 * walks the pages. The ceiling stops one runaway session from hanging an export
 * of twenty: past it the session is written out truncated rather than dropped.
 */
const MAX_PAGES = 20;
const PAGE_SIZE = 400;

const allEntries = async (session: SessionSummary): Promise<readonly HistoryEntry[]> => {
  const collected: HistoryEntry[] = [];
  let offset = 0;

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const result = await fetchMessages({
      filePath: session.filePath,
      agent: session.agent,
      offset,
      limit: PAGE_SIZE,
    });

    collected.push(...result.entries);

    if (!result.hasMore) {
      break;
    }

    offset = result.nextOffset;
  }

  return collected;
};

export const exportSessions = async (
  sessions: readonly SessionSummary[],
  projectLabel: string,
  exportedAtMs: number,
): Promise<BulkExport> => {
  const documents: string[] = [];
  let failed = 0;

  for (const session of sessions) {
    try {
      const entries = await allEntries(session);

      documents.push(entriesToMarkdown({
        project: projectLabel,
        title: session.title ?? session.summary ?? session.preview ?? session.id,
        exportedAtMs,
      }, entries));
    }
    catch {
      failed += 1;
    }
  }

  return {
    markdown: documents.join('\n\n---\n\n'),
    failed,
  };
};
