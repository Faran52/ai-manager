export interface WidthRange {
  readonly min: number;
  readonly max: number;
  readonly fallback: number;
}

// A remembered pane width, or the fallback when nothing usable was stored.
export const storedWidth = (key: string, range: WidthRange): number => {
  const stored = Number(localStorage.getItem(key));

  return Number.isFinite(stored) && stored >= range.min ? Math.min(stored, range.max) : range.fallback;
};
