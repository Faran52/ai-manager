// Empty parentheses read as a missing value rather than an absent one.
export const versionLine = (released: string, commit: string): string => {
  return commit.length === 0 ? released : `${released} (${commit})`;
};
