// Capacity is total weight; the default weight of one makes it a count.
export class LruCache<V> {
  private readonly store = new Map<string, V>();

  private readonly capacity: number;

  private readonly weigh: (value: V) => number;

  private carried = 0;

  constructor(capacity: number, weigh?: (value: V) => number) {
    if (capacity < 1) {
      throw new Error('LruCache capacity must be at least 1');
    }

    this.capacity = capacity;
    this.weigh = weigh ?? ((): number => {
      return 1;
    });
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
    this.drop(key);

    const added = this.weigh(value);

    while (this.store.size > 0 && this.carried + added > this.capacity) {
      const oldest = this.store.keys().next();

      // v8 ignore next -- unreachable by construction
      if (oldest.done === true) {
        break;
      }

      this.drop(oldest.value);
    }

    this.store.set(key, value);
    this.carried += added;
  }

  has(key: string): boolean {
    return this.store.has(key);
  }

  private drop(key: string): void {
    const held = this.store.get(key);

    if (held !== undefined) {
      this.carried -= this.weigh(held);
      this.store.delete(key);
    }
  }
}
