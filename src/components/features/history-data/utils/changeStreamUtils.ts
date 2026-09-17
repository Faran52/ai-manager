/**
 * Says when the open conversation grew, for as long as it is open.
 *
 * One connection, for the one file being read. Everything else the page shows
 * is read once and refreshed by hand, so nothing here outlives the session it
 * was opened for.
 */
export const subscribeToSessionChanges = (
  filePath: string,
  onChange: () => void,
): (() => void) => {
  const source = new EventSource(`/api/changes?file=${encodeURIComponent(filePath)}`);

  source.addEventListener('changed', onChange);

  return () => {
    source.close();
  };
};
