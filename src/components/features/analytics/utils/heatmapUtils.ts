export const IDLE_CLASS = 'bg-muted';

// Buckets a day's token total against the week's peak into 0–3 intensity levels.
export const levelFor = (tokens: number, peak: number): number => {
  if (tokens <= 0 || peak === 0) {
    return 0;
  }

  if (tokens < peak * 0.25) {
    return 1;
  }

  return tokens < peak * 0.6 ? 2 : 3;
};

export const levelClass = (tokens: number, peak: number): string => {
  switch (levelFor(tokens, peak)) {
    case 1:
      return 'bg-ok/40';
    case 2:
      return 'bg-ok/70';
    case 3:
      return 'bg-ok';
    default:
      return IDLE_CLASS;
  }
};
