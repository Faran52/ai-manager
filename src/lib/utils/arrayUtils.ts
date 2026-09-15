/*
 * Adds a value or removes it, which is what every multi-select in the app does
 * to its own state: selected sessions, the agent filter, expanded threads,
 * collapsed groups. Appends rather than inserting, so the order is the order
 * the reader picked them in.
 */
export const toggleInArray = <T>(values: readonly T[], value: T): readonly T[] => {
  return values.includes(value)
    ? values.filter((entry) => {
        return entry !== value;
      })
    : [...values, value];
};
