export interface StoredSetting<T extends string> {
  readonly subscribe: (notify: () => void) => () => void;
  readonly read: () => T;
  readonly write: (value: T) => void;
}

/*
 * A preference that outlives the page, shared by every window showing it.
 *
 * The browser tells the other documents of an origin when storage moves, so a
 * second window of this app changing the theme is heard here rather than
 * leaving each window on whatever it read at startup. That only holds while
 * the app keeps one origin, which is why the desktop shell pins its port.
 */
export const storedSetting = <T extends string>(
  key: string,
  read: () => T,
  apply?: (value: T) => void,
): StoredSetting<T> => {
  const listeners = new Set<() => void>();

  const subscribe = (notify: () => void): (() => void) => {
    const onStorage = (event: StorageEvent): void => {
      if (event.key !== key) {
        return;
      }

      apply?.(read());
      notify();
    };

    listeners.add(notify);
    window.addEventListener('storage', onStorage);

    return () => {
      listeners.delete(notify);
      window.removeEventListener('storage', onStorage);
    };
  };

  return {
    subscribe,
    read,
    write: (value: T): void => {
      localStorage.setItem(key, value);
      apply?.(value);

      // The window that made the change hears nothing from the browser.
      for (const notify of listeners) {
        notify();
      }
    },
  };
};
