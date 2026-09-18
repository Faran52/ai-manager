// Appends rather than inserting, so the order is the order the reader picked
// them in. es-toolkit has no equivalent.
export const toggleInArray = <T>(values: readonly T[], value: T): readonly T[] => {
  return values.includes(value)
    ? values.filter((entry) => {
        return entry !== value;
      })
    : [...values, value];
};

// The largest picked value, or zero for an empty list. A reduce rather than a
// spread into Math.max, which a long history could overflow the stack with.
export const maxOf = <T>(values: readonly T[], pick: (value: T) => number): number => {
  return values.reduce((best, value) => {
    return Math.max(best, pick(value));
  }, 0);
};

// The smallest picked value, or zero for an empty list, for the same reason as
// maxOf. Empty reads as zero rather than Infinity, which no caller can render.
export const minOf = <T>(values: readonly T[], pick: (value: T) => number): number => {
  return values.length === 0
    ? 0
    : values.reduce((best, value) => {
        return Math.min(best, pick(value));
      }, Number.POSITIVE_INFINITY);
};
