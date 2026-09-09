// "Claude Code" reads as CC and "OpenCode" as OC, so the capitals are the mark
// wherever there are two. A folder name has none, and keeps its first letters.
export const initialsOf = (label: string): string => {
  const capitals = label.replace(/[^\p{Lu}]/gu, '');

  return (capitals.length > 1 ? capitals : label).slice(0, 2);
};
