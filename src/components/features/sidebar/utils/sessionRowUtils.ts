import { sessionLabel } from '@services/history/historyService';

import type { SessionSummary } from '@services/history/historyService';

// A session is named by whatever it carries, and every agent carries a different one of these.
export const titleOf = (session: SessionSummary): string => {
  return sessionLabel(session);
};

/*
 * The line under the title, only when the first message is distinct: a row already
 * named by its summary or preview would print it twice.
 */
export const previewOf = (session: SessionSummary): string | null => {
  const line = session.summary ?? session.preview;

  return line == null || line === titleOf(session) ? null : line;
};
