/*
 * happy-dom ships no EventSource at all, so anything watching the change stream
 * throws on construction. This one connects to nothing and delivers only what a
 * test hands it through `emitChange()`, which is the moment a live list exists
 * to exercise.
 */
type Listener = () => void;

const listeners = new Set<Listener>();

class TestEventSource {
  public readonly url: string;

  private readonly own = new Set<Listener>();

  public constructor(url: string) {
    this.url = url;
  }

  public addEventListener(name: string, listener: Listener): void {
    if (name !== 'changed') {
      return;
    }

    this.own.add(listener);
    listeners.add(listener);
  }

  public close(): void {
    for (const listener of this.own) {
      listeners.delete(listener);
    }

    this.own.clear();
  }
}

// Every list currently watching reloads, the way a write on disk would make it.
export const emitChange = (): void => {
  for (const listener of [...listeners]) {
    listener();
  }
};

export const installEventSource = (): void => {
  Object.defineProperty(globalThis, 'EventSource', {
    configurable: true,
    writable: true,
    value: TestEventSource,
  });
};
