export const slugOf = (title: string): string => {
  const dashed = title.toLowerCase().replace(/[^a-z0-9]+/gu, '-').slice(0, 40);
  const trimmed = dashed.replace(/^-|-$/gu, '');

  return trimmed.length > 0 ? trimmed : 'session';
};
