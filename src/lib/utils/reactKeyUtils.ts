// Duplicate-safe list keys derived from item identity, so keyed lists never
// lean on array position even when items repeat verbatim.
export const uniqueKeys = <T>(
  items: readonly T[],
  identityOf: (item: T) => string,
): readonly string[] => {
  const counts = new Map<string, number>();

  return items.map((item) => {
    const identity = identityOf(item);
    const seen = counts.get(identity) ?? 0;

    counts.set(identity, seen + 1);

    return seen === 0 ? identity : `${identity}-${String(seen)}`;
  });
};
