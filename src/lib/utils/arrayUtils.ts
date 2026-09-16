// Appends rather than inserting, so the order is the order the reader picked
// them in. es-toolkit has no equivalent.
export const toggleInArray = <T>(values: readonly T[], value: T): readonly T[] => {
  return values.includes(value)
    ? values.filter((entry) => {
        return entry !== value;
      })
    : [...values, value];
};
