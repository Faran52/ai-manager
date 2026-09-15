import type { SessionSummary } from '@services/history/historyService';

// A session is named by whatever it carries, and every agent carries a different one of these.
export const titleOf = (session: SessionSummary): string => {
  return session.title ?? session.summary ?? session.preview ?? session.id;
};

/*
 * The line under the title, only when there is a distinct first message to
 * show: if the row is already named by its summary or preview, printing it
 * twice says nothing.
 */
export const previewOf = (session: SessionSummary): string | null => {
  const line = session.summary ?? session.preview;

  return line == null || line === titleOf(session) ? null : line;
};
