const numericParts = (version: string): readonly number[] => {
  return version.replace(/^v/u, '').split('.').map((part) => {
    const value = Number.parseInt(part, 10);

    return Number.isFinite(value) ? value : 0;
  });
};

// Positive when candidate is newer, so a feed can never talk us into a downgrade.
export const compareVersions = (candidate: string, current: string): number => {
  const left = numericParts(candidate);
  const right = numericParts(current);
  const length = Math.max(left.length, right.length);

  for (let index = 0; index < length; index += 1) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0);

    if (difference !== 0) {
      return difference;
    }
  }

  return 0;
};
