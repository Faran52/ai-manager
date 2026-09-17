/**
 * One connection for the whole page, shared by every list watching the history.
 *
 * A browser allows six per origin, and a list per pane would spend them all, so
 * the stream is opened on the first subscriber and closed after the last one
 * leaves. EventSource rather than a socket: the server has news, the page never
 * answers, and reconnection is the browser's problem rather than ours.
 */
const listeners = new Set<() => void>();

let source: EventSource | undefined;

const open = (): void => {
  source = new EventSource('/api/changes');

  source.addEventListener('changed', () => {
    for (const listener of [...listeners]) {
      listener();
    }
  });
};

export const subscribeToChanges = (listener: () => void): (() => void) => {
  listeners.add(listener);

  if (source == null) {
    open();
  }

  return () => {
    listeners.delete(listener);

    if (listeners.size === 0) {
      source?.close();
      source = undefined;
    }
  };
};
