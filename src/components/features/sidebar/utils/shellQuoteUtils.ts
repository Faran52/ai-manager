// Wraps a value so a POSIX shell treats it as one word.
export const shellQuote = (value: string): string => {
  return `'${value.replaceAll("'", "'\\''")}'`;
};
