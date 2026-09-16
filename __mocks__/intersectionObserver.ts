/*
 * happy-dom ships IntersectionObserver as a no-op: it accepts an observe() and
 * never calls back, so a component that waits on one never hears anything. Each
 * live observer is kept here and `intersect()` reports its targets, which is the
 * moment a lazy-loading test exists to exercise.
 */

type Report = (isIntersecting: boolean) => void;

const reports = new Set<Report>();

const entryFor = (target: Element, isIntersecting: boolean): IntersectionObserverEntry => {
  const rect = target.getBoundingClientRect();

  return {
    boundingClientRect: rect,
    intersectionRatio: isIntersecting ? 1 : 0,
    intersectionRect: rect,
    isIntersecting,
    rootBounds: null,
    target,
    time: 0,
  };
};

class TestIntersectionObserver implements IntersectionObserver {
  public readonly root: Element | Document | null;

  public readonly rootMargin: string;

  public readonly scrollMargin = '';

  public readonly thresholds: readonly number[] = [];

  private readonly targets = new Set<Element>();

  private readonly report: Report;

  public constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
    this.root = options?.root ?? null;
    this.rootMargin = options?.rootMargin ?? '';

    this.report = (isIntersecting) => {
      callback(
        [...this.targets].map((target) => {
          return entryFor(target, isIntersecting);
        }),
        this,
      );
    };

    reports.add(this.report);
  }

  public observe(target: Element): void {
    this.targets.add(target);
  }

  public unobserve(target: Element): void {
    this.targets.delete(target);
  }

  public disconnect(): void {
    this.targets.clear();
    reports.delete(this.report);
  }

  public takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

export const installIntersectionObserver = (): void => {
  globalThis.IntersectionObserver = TestIntersectionObserver;
};

// Reports every observed target as on screen, or off it.
export const intersect = (isIntersecting = true): void => {
  for (const report of [...reports]) {
    report(isIntersecting);
  }
};
