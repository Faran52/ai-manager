export class LruCache<V> {
  private readonly store = new Map<string, V>();

  private readonly capacity: number;

  constructor(capacity: number) {
    if (capacity < 1) {
      throw new Error('LruCache capacity must be at least 1');
    }

    this.capacity = capacity;
  }

  get size(): number {
    return this.store.size;
  }

  get(key: string): V | undefined {
    const value = this.store.get(key);

    if (value !== undefined) {
      this.store.delete(key);
      this.store.set(key, value);
    }

    return value;
  }

  set(key: string, value: V): void {
    this.store.delete(key);

    if (this.store.size >= this.capacity) {
      const oldest = this.store.keys().next();

      // v8 ignore next -- unreachable by construction
      if (oldest.done !== true) {
        this.store.delete(oldest.value);
      }
    }

    this.store.set(key, value);
  }

  has(key: string): boolean {
    return this.store.has(key);
  }
}
