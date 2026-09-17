export const slugOf = (title: string): string => {
  const dashed = title.toLowerCase().replace(/[^a-z0-9]+/gu, '-').slice(0, 40);
  const slug = dashed.startsWith('-') ? dashed.slice(1) : dashed;
  const trimmed = slug.endsWith('-') ? slug.slice(0, -1) : slug;

  return trimmed.length > 0 ? trimmed : 'session';
};
